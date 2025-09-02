#!/usr/bin/env python3
"""
SQLite migration for Music Analyzer Pro DB (idempotent).

Adds/updates schema incrementally:
- tracks: analyzer feature columns + camelot_key (with backfill)
- playlists/playlist_tracks: metadata columns for smart playlists
- ai_analysis: table for AI results (genre/mood/etc.)
- indices for performance

Usage:
  python scripts/migrate_db.py                  # uses ~/.music_player_qt/music_library.db
  python scripts/migrate_db.py --db path/to.db  # custom path
  python scripts/migrate_db.py --dry-run        # report only
"""

import argparse
import shutil
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Iterable, Tuple


# Track-level analyzer columns (existing set)
REQUIRED_TRACK_COLUMNS = [
    ("danceability", "REAL"),
    ("valence", "REAL"),
    ("acousticness", "REAL"),
    ("instrumentalness", "REAL"),
    ("tempo_stability", "REAL"),
]

# Additional columns (this migration)
EXTRA_TRACK_COLUMNS = [
    ("camelot_key", "TEXT"),
    ("release_date", "TEXT"),
]

# Playlist metadata columns (extend existing tables)
PLAYLIST_COLUMNS = [
    ("type", "TEXT"),
    ("duration_minutes", "INTEGER"),
    ("generation_method", "TEXT"),
    ("parameters", "TEXT"),  # JSON
]

PLAYLIST_TRACK_COLUMNS = [
    ("transition_score", "REAL"),
]


def _ensure_columns(conn: sqlite3.Connection, table: str, columns: Iterable[Tuple[str, str]]) -> list:
    cur = conn.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cur.fetchall()}
    added: list[str] = []
    for col, col_type in columns:
        if col not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
            added.append(col)
    return added


def ensure_tracks_columns(conn: sqlite3.Connection) -> dict:
    added1 = _ensure_columns(conn, "tracks", REQUIRED_TRACK_COLUMNS)
    added2 = _ensure_columns(conn, "tracks", EXTRA_TRACK_COLUMNS)
    conn.commit()
    return {"added": added1 + added2}


def ensure_playlists_columns(conn: sqlite3.Connection) -> dict:
    added = _ensure_columns(conn, "playlists", PLAYLIST_COLUMNS)
    conn.commit()
    return {"added": added}


def ensure_playlist_tracks_columns(conn: sqlite3.Connection) -> dict:
    added = _ensure_columns(conn, "playlist_tracks", PLAYLIST_TRACK_COLUMNS)
    conn.commit()
    return {"added": added}


def ensure_ai_analysis_table(conn: sqlite3.Connection) -> bool:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_analysis (
            track_id INTEGER PRIMARY KEY,
            genre TEXT,
            subgenre TEXT,
            mood TEXT,
            energy_profile TEXT,  -- JSON
            structure TEXT,       -- JSON
            lyrics_context TEXT,  -- JSON
            similar_tracks TEXT,  -- JSON
            analysis_date TIMESTAMP,
            ai_version TEXT,
            FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
        )
        """
    )
    conn.commit()
    return True


def ensure_indices(conn: sqlite3.Connection) -> None:
    # tracks
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tracks_camelot ON tracks(camelot_key)")
    # playlist_tracks order index
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_playlist_tracks_order ON playlist_tracks(playlist_id, position)"
    )
    # ai_analysis filters
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ai_genre ON ai_analysis(genre)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ai_mood ON ai_analysis(mood)")
    conn.commit()


def ensure_ai_analysis_columns(conn: sqlite3.Connection) -> list:
    """Add additional ai_analysis columns for LLM outputs if missing."""
    cur = conn.execute("PRAGMA table_info(ai_analysis)")
    existing = {row[1] for row in cur.fetchall()}
    to_add = []
    extra = [
        ("language", "TEXT"),
        ("explicit", "INTEGER"),
        ("era", "TEXT"),
        ("year_estimate", "INTEGER"),
        ("tags", "TEXT"),  # JSON array
        ("quality_metrics", "TEXT"),  # JSON (integrated_loudness_est, peak_dbfs, crest, clipping)
        ("context_tags", "TEXT"),     # JSON (situation, daypart, season, audience)
    ]
    for col, col_type in extra:
        if col not in existing:
            conn.execute(f"ALTER TABLE ai_analysis ADD COLUMN {col} {col_type}")
            to_add.append(col)
    conn.commit()
    return to_add


# --- Camelot backfill helpers (minimal, self-contained) ---
def _is_camelot(code: str) -> bool:
    if not isinstance(code, str):
        return False
    k = code.strip().upper()
    if len(k) < 2:
        return False
    num, let = k[:-1], k[-1]
    return num.isdigit() and 1 <= int(num) <= 12 and let in ("A", "B")


KEY_TO_CAMELOT = {
    "C": "8B", "AM": "8A",  # using upper-case for lookup
    "G": "9B", "EM": "9A",
    "D": "10B", "BM": "10A",
    "A": "11B", "F#M": "11A", "G♭M": "11A",
    "E": "12B", "C#M": "12A", "D♭M": "12A",
    "B": "1B", "G#M": "1A", "A♭M": "1A",
    "F#": "2B", "E♭M": "2A",  # Gb/Ebm
    "DB": "3B", "BBM": "3A",
    "AB": "4B", "FM": "4A",
    "EB": "5B", "CM": "5A",
    "BB": "6B", "GM": "6A",
    "F": "7B", "DM": "7A",
}


def _to_camelot(key: str) -> str:
    if not key:
        return "8B"
    k = str(key).strip()
    if _is_camelot(k):
        return k.upper()
    return KEY_TO_CAMELOT.get(k.upper(), "8B")


def backfill_camelot(conn: sqlite3.Connection, *, dry_run: bool = False, verbose: bool = False) -> int:
    cur = conn.execute(
        "SELECT id, initial_key, camelot_key FROM tracks WHERE (camelot_key IS NULL OR camelot_key = '')"
    )
    rows = cur.fetchall()
    updated = 0
    for row in rows:
        tid = row[0]
        ikey = row[1]
        if not ikey:
            continue
        camel = _to_camelot(ikey)
        if verbose:
            print(f"Track {tid}: initial_key={ikey!r} -> camelot_key={camel!r}")
        if not dry_run:
            conn.execute("UPDATE tracks SET camelot_key = ? WHERE id = ?", (camel, tid))
            updated += 1
    if not dry_run:
        conn.commit()
    return updated


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db",
        type=Path,
        default=Path.home() / ".music_player_qt" / "music_library.db",
        help="Path to SQLite database",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report planned changes only")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()

    db_path: Path = args.db
    if not db_path.exists():
        print(f"⚠️ DB not found: {db_path}")
        return 1

    # Backup
    backup = db_path.with_suffix(
        db_path.suffix + ".bak." + datetime.now().strftime("%Y%m%d%H%M%S")
    )
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(db_path, backup)
    print(f"📦 Backup created: {backup}")

    conn = sqlite3.connect(str(db_path))
    try:
        # Wrap in a transaction for atomicity
        conn.execute("BEGIN")
        added_tracks = ensure_tracks_columns(conn)["added"]
        added_playlists = ensure_playlists_columns(conn)["added"]
        added_pl_tracks = ensure_playlist_tracks_columns(conn)["added"]
        ensure_ai_analysis_table(conn)
        added_ai_cols = ensure_ai_analysis_columns(conn)
        ensure_indices(conn)
        # Backfill camelot_key
        updated = backfill_camelot(conn, dry_run=args.dry_run, verbose=args.verbose)
        # Report
        if added_tracks:
            print(f"✅ tracks: added columns: {', '.join(added_tracks)}")
        if added_playlists:
            print(f"✅ playlists: added columns: {', '.join(added_playlists)}")
        if added_pl_tracks:
            print(f"✅ playlist_tracks: added columns: {', '.join(added_pl_tracks)}")
        if added_ai_cols:
            print(f"✅ ai_analysis: added columns: {', '.join(added_ai_cols)}")
        if updated:
            action = "would update" if args.dry_run else "updated"
            print(f"✅ {action} camelot_key for {updated} tracks")
        if not any([added_tracks, added_playlists, added_pl_tracks, updated]):
            print("ℹ️ No changes. Schema up to date.")
    finally:
        conn.close()
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
