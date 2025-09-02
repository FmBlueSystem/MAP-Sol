from __future__ import annotations

import concurrent.futures
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import sqlite3

from utils.logger import setup_logger
from .features import extract_audio_features
from .classifier import infer_genre_mood
from hamms_analyzer import HAMMSAnalyzer


logger = setup_logger(__name__)


@dataclass
class AIResult:
    genre: Optional[str]
    subgenre: Optional[str]
    mood: Optional[str]
    energy_profile: List[float]
    structure: List[dict]
    lyrics_context: Optional[dict]
    similar_tracks: List[int]
    ai_version: str


class AIAnalysisProcessor:
    """IA post-import processor (lightweight backend).

    - Extracts audio features with librosa if available
    - Heuristically infers genre/mood
    - Summarizes energy profile and coarse structure
    - Computes similar tracks using HAMMS compatibility (no DB hamms vectors required)
    - Persists to `ai_analysis` (does not touch file tags)
    """

    def __init__(self, db_path: Optional[str] = None, max_parallel: int = 2) -> None:
        if db_path is None:
            try:
                db_path = str(Path.home() / ".music_player_qt" / "music_library.db")
            except Exception:
                db_path = str(Path.cwd() / ".music_player_qt" / "music_library.db")
        self.db_path = db_path
        self.max_parallel = max(1, int(max_parallel))

    def get_version(self) -> str:
        return "ai-lite-0.1"

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _persist(self, conn: sqlite3.Connection, track_id: int, data: Dict[str, Any]) -> None:
        conn.execute(
            """
            INSERT OR REPLACE INTO ai_analysis (
                track_id, genre, subgenre, mood, energy_profile, structure,
                lyrics_context, similar_tracks, analysis_date, ai_version,
                language, explicit, era, year_estimate, tags,
                quality_metrics, context_tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                track_id,
                data.get("genre"),
                data.get("subgenre"),
                data.get("mood"),
                data.get("energy_profile_json"),
                data.get("structure_json"),
                data.get("lyrics_context_json"),
                data.get("similar_tracks_json"),
                datetime.now().isoformat(timespec="seconds"),
                data.get("ai_version"),
                data.get("language"),
                data.get("explicit"),
                data.get("era"),
                data.get("year_estimate"),
                data.get("tags_json"),
                data.get("quality_metrics_json"),
                data.get("context_tags_json"),
            ),
        )

    def _compute_similars(self, conn: sqlite3.Connection, track_row: sqlite3.Row, limit: int = 10) -> List[int]:
        try:
            analyzer = HAMMSAnalyzer(db_path=self.db_path)
        except Exception:
            analyzer = None
        # Build candidate list from tracks table
        rows = conn.execute(
            "SELECT id, bpm, initial_key, energy_level FROM tracks WHERE id != ?",
            (track_row["id"],),
        ).fetchall()
        candidates = []
        base = {
            "id": track_row["id"],
            "bpm": track_row["bpm"] or 120,
            "key": track_row["initial_key"],
            "energy": (float(track_row["energy_level"]) / 10.0) if track_row["energy_level"] is not None else 0.5,
        }
        for r in rows:
            other = {
                "id": r["id"],
                "bpm": r["bpm"] or 120,
                "key": r["initial_key"],
                "energy": (float(r["energy_level"]) / 10.0) if r["energy_level"] is not None else 0.5,
            }
            try:
                if analyzer:
                    score = analyzer.calculate_mix_compatibility(base, other)["compatibility_score"]
                else:
                    # Fallback simple score
                    br = min(base["bpm"], other["bpm"]) / max(base["bpm"], other["bpm"]) if max(base["bpm"], other["bpm"]) > 0 else 0
                    e = 1.0 - abs(base["energy"] - other["energy"])  # [0..1]
                    score = 0.6 * br + 0.4 * e
            except Exception:
                score = 0.0
            candidates.append((other["id"], float(score)))
        candidates.sort(key=lambda x: x[1], reverse=True)
        return [cid for cid, _ in candidates[:limit]]

    def analyze_track(self, track_row: sqlite3.Row) -> Dict[str, Any]:
        audio_path = track_row["file_path"]
        # Respect precomputed tags (e.g., Mixed In Key): do not recompute BPM if present
        features = extract_audio_features(audio_path, fallback_bpm=track_row["bpm"]) 
        # Inference
        genre, mood = infer_genre_mood(features, fallback_bpm=track_row["bpm"], existing=None)
        # Structure: map segments to dicts
        structure = [
            {"start": float(a), "end": float(b)} for a, b in features.get("segments", [])
        ]
        # Heuristic quality metrics
        quality = {}
        try:
            import numpy as _np
            ep = _np.array(features.get("energy_profile") or [], dtype=float)
            if ep.size:
                avg = float(ep.mean())
                peak = float(ep.max())
                integrated_loudness_est = round(-24 + avg * 18, 2)  # ~[-24..-6] LUFS est.
                peak_dbfs = round(-12 + peak * 12, 2)               # ~[-12..0] dBFS est.
                crest = round((peak - avg), 3)
                clipping = 1 if peak > 0.98 else 0
                quality = {
                    "integrated_loudness_est": integrated_loudness_est,
                    "peak_dbfs_est": peak_dbfs,
                    "crest_est": crest,
                    "clipping_detected": clipping,
                }
        except Exception:
            pass
        # Basic explicit/tag/context heuristics
        language = None
        explicit_flag = None
        tags = []
        context = {}
        try:
            title = (track_row["title"] if "title" in track_row.keys() else None) or ""
            comment = (track_row["comment"] if "comment" in track_row.keys() else None) or ""
            if "explicit" in title.lower() or "explicit" in comment.lower():
                explicit_flag = 1
            # Daypart by avg energy
            try:
                import numpy as _np
                avg_e = float(_np.array(features.get("energy_profile") or [0.0]).mean())
            except Exception:
                avg_e = 0.0
            if avg_e >= 0.7:
                tags.append("peak-time"); context["daypart"] = "peak-time"
            elif avg_e <= 0.4:
                tags.append("warm-up"); context["daypart"] = "warm-up"
            # Situation by duration/energy
            dur = track_row["duration"] if "duration" in track_row.keys() else None
            if dur and dur < 120:
                context["situation"] = "radio"
            elif avg_e >= 0.6:
                context["situation"] = "club"
        except Exception:
            pass
        return {
            "genre": genre,
            "subgenre": None,
            "mood": mood,
            "energy_profile": features.get("energy_profile", []),
            "structure": structure,
            "lyrics_context": None,
            "quality_metrics": quality,
            "language": language,
            "explicit": explicit_flag,
            "tags": tags or None,
            "context_tags": context or None,
            "ai_version": self.get_version(),
        }

    def process_missing(self, limit: Optional[int] = None) -> int:
        """Analyze tracks that don't have an ai_analysis row yet.

        Returns the number of processed tracks.
        """
        conn = self._connect()
        try:
            q = (
                "SELECT t.* FROM tracks t "
                "LEFT JOIN ai_analysis a ON a.track_id = t.id "
                "WHERE a.track_id IS NULL"
            )
            if limit:
                q += f" LIMIT {int(limit)}"
            rows = conn.execute(q).fetchall()
            if not rows:
                return 0
            # Parallel processing of feature extraction/inference; DB writes are serialized
            def _job(row: sqlite3.Row):
                try:
                    return row["id"], self.analyze_track(row)
                except Exception as e:
                    logger.warning(f"AI analyze failed for {row['file_path']}: {e}")
                    return row["id"], None

            results: List[tuple[int, Optional[Dict[str, Any]]]] = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_parallel) as ex:
                futures = [ex.submit(_job, r) for r in rows]
                for f in concurrent.futures.as_completed(futures):
                    results.append(f.result())

            # Persist (and compute similars) sequentially
            for tid, res in results:
                if not res:
                    continue
                # Similar tracks (uses DB + HAMMS compatibility)
                try:
                    row = conn.execute("SELECT * FROM tracks WHERE id = ?", (tid,)).fetchone()
                    similars = self._compute_similars(conn, row, limit=10)
                except Exception:
                    similars = []

                import json
                # Derive year/era from track row if present (authoritative)
                try:
                    trow = conn.execute("SELECT year, release_date FROM tracks WHERE id = ?", (tid,)).fetchone()
                except Exception:
                    trow = None
                year_estimate = None
                era = None
                if trow is not None:
                    y = trow["year"] if "year" in trow.keys() else None
                    rd = trow["release_date"] if "release_date" in trow.keys() else None
                    if rd and isinstance(rd, str) and len(rd) >= 4 and rd[:4].isdigit():
                        year_estimate = int(rd[:4])
                    elif isinstance(y, int):
                        year_estimate = y
                    if year_estimate:
                        d = year_estimate
                        decade = (d // 10) * 10
                        era = f"{decade}s"
                payload = {
                    "genre": res["genre"],
                    "subgenre": res["subgenre"],
                    "mood": res["mood"],
                    "energy_profile_json": json.dumps(res["energy_profile"]),
                    "structure_json": json.dumps(res["structure"]),
                    "lyrics_context_json": json.dumps(res["lyrics_context"]) if res["lyrics_context"] is not None else None,
                    "similar_tracks_json": json.dumps(similars),
                    "ai_version": res["ai_version"],
                    "language": res.get("language"),
                    "explicit": res.get("explicit"),
                    "era": era,
                    "year_estimate": year_estimate,
                    "tags_json": json.dumps(res.get("tags")) if res.get("tags") is not None else None,
                }
                # Include optional quality/context JSON blobs if present
                qm = res.get("quality_metrics")
                if qm is not None:
                    payload["quality_metrics_json"] = json.dumps(qm)
                ct = res.get("context_tags")
                if ct is not None:
                    payload["context_tags_json"] = json.dumps(ct)
                self._persist(conn, tid, payload)
            conn.commit()
            return sum(1 for _, r in results if r is not None)
        finally:
            conn.close()

    def process_one(self, track_id: int) -> bool:
        """Analyze and persist AI metadata for a single track id.

        Returns True if persisted, False otherwise.
        """
        conn = self._connect()
        try:
            row = conn.execute("SELECT * FROM tracks WHERE id = ?", (track_id,)).fetchone()
            if not row:
                return False
            res = self.analyze_track(row)
            # Compute similars
            try:
                similars = self._compute_similars(conn, row, limit=10)
            except Exception:
                similars = []
            import json
            # Derive year/era
            y = row["year"] if "year" in row.keys() else None
            rd = row["release_date"] if "release_date" in row.keys() else None
            year_estimate = None
            era = None
            if rd and isinstance(rd, str) and len(rd) >= 4 and rd[:4].isdigit():
                year_estimate = int(rd[:4])
            elif isinstance(y, int):
                year_estimate = y
            if year_estimate:
                decade = (year_estimate // 10) * 10
                era = f"{decade}s"
            payload = {
                "genre": res["genre"],
                "subgenre": res["subgenre"],
                "mood": res["mood"],
                "energy_profile_json": json.dumps(res["energy_profile"]),
                "structure_json": json.dumps(res["structure"]),
                "lyrics_context_json": json.dumps(res["lyrics_context"]) if res["lyrics_context"] is not None else None,
                "similar_tracks_json": json.dumps(similars),
                "ai_version": res["ai_version"],
                "language": res.get("language"),
                "explicit": res.get("explicit"),
                "era": era,
                "year_estimate": year_estimate,
                "tags_json": json.dumps(res.get("tags")) if res.get("tags") is not None else None,
            }
            # Optional quality/context JSON blobs
            qm = res.get("quality_metrics")
            if qm is not None:
                payload["quality_metrics_json"] = json.dumps(qm)
            ct = res.get("context_tags")
            if ct is not None:
                payload["context_tags_json"] = json.dumps(ct)
            self._persist(conn, track_id, payload)
            conn.commit()
            return True
        except Exception as e:
            logger.warning(f"AI process_one failed for track {track_id}: {e}")
            return False
        finally:
            conn.close()
