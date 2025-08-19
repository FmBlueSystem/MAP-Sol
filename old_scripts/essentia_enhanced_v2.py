#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Essentia Enhanced v2
--------------------
Analizador de audio con estrategias de extracción configurables ("smart60" | "first60" | "full"),
métricas robustas (BPM, tonalidad, loudness LUFS, energía, etc.), validación de rangos,
soporte de caché, metadatos vía Mutagen y persistencia en SQLite.

Novedades v2:
- Nuevo parámetro `extract_strategy`: "smart60" (predeterminado), "first60" o "full".
- Registro de `windows_used` (parámetros de ventanas/frames) y `notes` por pista.
- `save_to_db` crea/migra tablas si no existen e incluye nuevas columnas.
- CLI mejorada: `--strategy`, `--duration`, `--json`, `--save-db`, `--verbose`.
- Manejo más seguro de errores y mensajes claros para Apple Silicon (M1/M2/M3).
"""
from __future__ import annotations

import os
import sys
import json
import math
import logging
import warnings
import sqlite3
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, List

import numpy as np

# ===== Logging & Warnings ====================================================
LOG_LEVEL = os.environ.get("ESSANALYZER_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("essentia_enhanced_v2")
warnings.filterwarnings("ignore")

# ===== Optional deps (Essentia / Mutagen) ===================================
try:
    import essentia
    import essentia.standard as es
    # Silenciar logging de Essentia
    essentia.log.warningActive = False
    essentia.log.infoActive = False
    essentia.log.errorActive = False
    _ESSENTIA_AVAILABLE = True
except Exception as e:
    _ESSENTIA_AVAILABLE = False
    es = None  # type: ignore
    logger.warning("Essentia no está disponible: %s", e)

try:
    from mutagen import File as MutagenFile
except Exception:
    MutagenFile = None  # type: ignore

# ===== Config dataclass ======================================================
@dataclass
class AnalysisConfig:
    sample_rate: int = 44100
    extract_strategy: str = "smart60"  # "smart60" | "first60" | "full"
    duration_sec: int = 60
    use_cache: bool = True

    # Parámetros de análisis (se registran como windows_used)
    frame_size: int = 2048
    hop_size: int = 1024
    onset_frame: int = 1024
    onset_hop: int = 512

    def as_windows_dict(self) -> Dict[str, Any]:
        return {
            "sample_rate": self.sample_rate,
            "frame_size": self.frame_size,
            "hop_size": self.hop_size,
            "onset_frame": self.onset_frame,
            "onset_hop": self.onset_hop,
        }


# ===== Utilidades ============================================================
_VALID_RANGES = {
    "energy": (0.0, 1.0),
    "danceability": (0.0, 1.0),
    "valence": (0.0, 1.0),
    "acousticness": (0.0, 1.0),
    "instrumentalness": (0.0, 1.0),
    "liveness": (0.0, 1.0),
    "speechiness": (0.0, 1.0),
    "bpm": (40.0, 220.0),
    "loudness": (-60.0, 0.0),
    "bpm_confidence": (0.0, 1.0),
    "key_confidence": (0.0, 1.0),
}

def _clip(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(value)))

def _safe_div(a: float, b: float, default: float = 0.0) -> float:
    return a / b if b else default


# ===== Núcleo del analizador =================================================
class EssentiaEnhancedV2:
    def __init__(self, cfg: AnalysisConfig):
        self.cfg = cfg
        self.cache: Dict[str, Dict[str, Any]] = {}

        if not _ESSENTIA_AVAILABLE:
            logger.error(
                "Essentia no está disponible. Instale la librería (por ejemplo, "
                "`brew install --HEAD mtg/essentia/essentia`) y asegúrese de que el "
                "entorno coincide con su arquitectura (Apple Silicon -> ARM64)."
            )
        logger.info(
            "Inicializado (SR=%d, strategy=%s, duration=%ds, cache=%s)",
            cfg.sample_rate, cfg.extract_strategy, cfg.duration_sec, cfg.use_cache
        )

    # ---- Carga de audio con estrategias ------------------------------------
    def _load_audio(self, path: str) -> Tuple[np.ndarray, List[str]]:
        """
        Carga audio como vector mono a `cfg.sample_rate`.
        Devuelve (audio, notes).
        """
        notes: List[str] = []
        if not _ESSENTIA_AVAILABLE:
            raise RuntimeError("Essentia no disponible para cargar audio.")

        try:
            # EasyLoader solo retorna el audio array
            loader = es.EasyLoader(filename=path, sampleRate=self.cfg.sample_rate)
            audio = loader()
            
            # Convertir a mono si es necesario
            if audio.ndim > 1:
                audio = np.mean(audio, axis=0)
            total_dur = len(audio) / self.cfg.sample_rate
        except Exception as e:
            raise RuntimeError(f"Error cargando audio: {e}")

        # Estrategia de recorte
        if self.cfg.extract_strategy == "full":
            # No recortar
            return audio, notes

        max_samples = self.cfg.duration_sec * self.cfg.sample_rate

        if total_dur <= self.cfg.duration_sec:
            # Pista corta: centramos si es ligeramente mayor, o tal cual si menor/igual.
            if len(audio) > max_samples:
                start = (len(audio) - max_samples) // 2
                audio = audio[start:start + max_samples]
                notes.append("Pista ligera >60s, centrada.")
            return audio, notes

        if self.cfg.extract_strategy == "first60":
            audio = audio[:max_samples]
            notes.append("Estrategia first60.")
            return audio, notes

        # smart60: saltar 10s de intro/outro si la pista es larga y tomar del centro
        skip = int(10 * self.cfg.sample_rate)
        start = skip
        end = len(audio) - skip
        avail = end - start
        if avail >= max_samples:
            start = start + (avail - max_samples) // 2
            segment = audio[start:start + max_samples]
            notes.append("Estrategia smart60: centro sin intro/outro.")
        else:
            # Si no alcanza, tomar centro de la pista completa
            start = (len(audio) - max_samples) // 2
            segment = audio[start:start + max_samples]
            notes.append("Estrategia smart60: centro (pista corta).")

        return segment, notes

    # ---- Features -----------------------------------------------------------
    def _loudness_features(self, audio: np.ndarray) -> Dict[str, float]:
        try:
            # LoudnessEBUR128 requiere 2 canales: duplicamos mono
            audio_st = np.vstack([audio, audio])
            lcalc = es.LoudnessEBUR128(startAtZero=True)
            momentary, shortterm, integrated, lrange = lcalc(audio_st)
            dyn = float(np.max(momentary) - np.min(momentary))
            return {
                "loudness": _clip(float(integrated), *_VALID_RANGES["loudness"]),
                "loudness_range": round(float(lrange), 2),
                "dynamic_range": round(dyn, 2),
            }
        except Exception:
            # Respaldo vía RMS
            rms = float(es.RMS()(audio)) if _ESSENTIA_AVAILABLE else float(np.sqrt(np.mean(audio**2)))
            lufs = 20 * math.log10(max(rms, 1e-10))
            return {
                "loudness": _clip(lufs, *_VALID_RANGES["loudness"]),
                "loudness_range": 0.0,
                "dynamic_range": 0.0,
            }

    def _rhythm_features(self, audio: np.ndarray) -> Dict[str, float]:
        # RhythmExtractor2013 devuelve bpm, beats, beats_confidence, bpm_intervals, ticks
        rx = es.RhythmExtractor2013(method="degara")
        try:
            bpm, beats, beats_conf, _, _ = rx(audio)
        except Exception:
            # Fallback más simple
            rx2 = es.RhythmExtractor2013(method="multifeature")
            bpm, beats, beats_conf, _, _ = rx2(audio)
        bpm = float(bpm)
        beats_conf = float(beats_conf)
        return {
            "bpm": _clip(bpm, *_VALID_RANGES["bpm"]),
            "bpm_confidence": _clip(beats_conf, *_VALID_RANGES["bpm_confidence"]),
        }

    def _key_features(self, audio: np.ndarray) -> Dict[str, Any]:
        # KeyExtractor: devuelve key, scale, strength
        kx = es.KeyExtractor()
        key, scale, strength = kx(audio)
        # Opcional: fuerza a mayúscula tipo "C#" y escala mayor/menor
        key_str = f"{key} {scale}".strip()
        return {
            "key": key_str,
            "key_confidence": _clip(float(strength), *_VALID_RANGES["key_confidence"]),
        }

    def _energy(self, audio: np.ndarray) -> float:
        # Energía normalizada en [0,1] a partir de RMS
        rms = float(es.RMS()(audio)) if _ESSENTIA_AVAILABLE else float(np.sqrt(np.mean(audio**2)))
        # Escalado log simple a [0,1]
        norm = (20 * math.log10(max(rms, 1e-10)) + 60.0) / 60.0
        return _clip(norm, 0.0, 1.0)

    def _spectral_profile_scores(self, audio: np.ndarray) -> Dict[str, float]:
        """
        Heurísticas simples para acousticness / instrumentalness / liveness / speechiness / valence.
        NOTA: Son aproximaciones. Para precisión avanzada combine con un modelo ML.
        """
        w = es.Windowing(type="hann", size=self.cfg.frame_size)
        sp = es.Spectrum()
        mfcc = es.MFCC(numberCoefficients=13)
        zcr = es.ZeroCrossingRate()
        spec_centroid = es.Centroid()
        rolloff = es.RollOff()

        hop = self.cfg.hop_size
        frames = es.FrameGenerator(audio, frameSize=self.cfg.frame_size, hopSize=hop, startFromZero=True)

        mfcc_means = []
        zcr_vals = []
        centroid_vals = []
        rolloff_vals = []

        for frame in frames:
            win = w(frame)
            mag = sp(win)
            _, mfcc_bands = mfcc(mag)
            mfcc_means.append(float(np.mean(mfcc_bands)))
            zcr_vals.append(float(zcr(frame)))
            centroid_vals.append(float(spec_centroid(mag)))
            rolloff_vals.append(float(rolloff(mag)))

        # Normalizaciones heurísticas
        zcr_m = float(np.mean(zcr_vals)) if zcr_vals else 0.0
        mfcc_m = float(np.mean(mfcc_means)) if mfcc_means else 0.0
        cent_m = float(np.mean(centroid_vals)) if centroid_vals else 0.0
        roll_m = float(np.mean(rolloff_vals)) if rolloff_vals else 0.0

        # Heurísticas: más centróide/rolloff -> menos acoustic; más ZCR-> speechiness
        acousticness = _clip(1.0 - (cent_m * 2), 0.0, 1.0)
        instrumentalness = _clip(1.0 - (zcr_m * 5), 0.0, 1.0)
        liveness = _clip((roll_m * 2), 0.0, 1.0)
        speechiness = _clip(zcr_m * 4, 0.0, 1.0)

        # Valence aproximada con media MFCC
        valence = _clip(0.5 + mfcc_m * 0.1, 0.0, 1.0)

        return {
            "acousticness": acousticness,
            "instrumentalness": instrumentalness,
            "liveness": liveness,
            "speechiness": speechiness,
            "valence": valence,
        }

    def _danceability(self, audio: np.ndarray, bpm: float) -> float:
        # Heurística simple: máxima bailabilidad entre 110..130 BPM
        if bpm <= 0:
            return 0.0
        peak = 120.0
        span = 40.0
        score = math.exp(-((bpm - peak) ** 2) / (2 * (span / 2.355) ** 2))
        return _clip(score, 0.0, 1.0)

    # ---- Validación ---------------------------------------------------------
    def _validate_ranges(self, feats: Dict[str, Any]) -> Dict[str, Any]:
        checked = dict(feats)
        for k, (lo, hi) in _VALID_RANGES.items():
            if k in checked and isinstance(checked[k], (float, int)):
                checked[k] = _clip(float(checked[k]), lo, hi)
        return checked

    # ---- Mutagen tags -------------------------------------------------------
    def _read_tags(self, path: str) -> Dict[str, Any]:
        md: Dict[str, Any] = {}
        if MutagenFile is None:
            return md
        try:
            f = MutagenFile(path, easy=True)
            if not f:
                return md
            def get1(key: str) -> Optional[str]:
                val = f.get(key)
                if not val: return None
                return str(val[0]) if isinstance(val, list) else str(val)
            md["artist"] = get1("artist")
            md["title"] = get1("title")
            md["album"] = get1("album")
            md["genre"] = get1("genre")
            md["year"] = get1("date")  # Mutagen usa 'date' pero BD usa 'year'
        except Exception:
            pass
        return md

    # ---- Proceso completo ---------------------------------------------------
    def process_file(self, path: str) -> Dict[str, Any]:
        path = str(Path(path).resolve())
        res: Dict[str, Any] = {
            "file_path": path,
            "file_name": Path(path).name,
            "status": "processing",
            "timestamp": datetime.now().isoformat(),
            "extract_strategy": self.cfg.extract_strategy,
            "windows_used": self.cfg.as_windows_dict(),
        }

        # Cache
        file_hash = ""
        if self.cfg.use_cache:
            try:
                st = os.stat(path)
                file_hash = f"{path}_{st.st_size}_{st.st_mtime}"
                file_hash = __import__("hashlib").md5(file_hash.encode()).hexdigest()
                if file_hash in self.cache:
                    cached = dict(self.cache[file_hash])
                    cached["status"] = "success"
                    cached["from_cache"] = True
                    return cached
            except Exception:
                pass

        # Carga y features
        try:
            audio, notes = self._load_audio(path)
            res["notes"] = "; ".join(notes) if notes else None
            res["duration_analyzed_sec"] = round(len(audio) / self.cfg.sample_rate, 3)
        except Exception as e:
            res["status"] = "error"
            res["error"] = f"{e}"
            return res

        try:
            feats: Dict[str, Any] = {}
            feats.update(self._loudness_features(audio))
            r = self._rhythm_features(audio)
            feats.update(r)
            feats.update(self._key_features(audio))
            feats["energy"] = self._energy(audio)
            feats["danceability"] = self._danceability(audio, feats.get("bpm", 0.0))
            feats.update(self._spectral_profile_scores(audio))
            feats = self._validate_ranges(feats)
            res["features"] = feats
        except Exception as e:
            res["status"] = "error"
            res["error"] = f"Error calculando features: {e}"
            return res

        # Metadatos
        res["metadata"] = self._read_tags(path)

        res["status"] = "success"
        if self.cfg.use_cache and file_hash:
            self.cache[file_hash] = dict(res)
        return res

    # ---- Persistencia en SQLite --------------------------------------------
    def save_to_db(self, result: Dict[str, Any], db_path: str = "music_analyzer.db") -> bool:
        """
        Guarda/actualiza resultados en SQLite.
        Crea tablas si no existen e incluye columnas nuevas: extract_strategy, windows_used, notes.
        """
        if result.get("status") != "success":
            return False

        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        # Crear tablas si no existen (usando esquema existente)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS audio_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT UNIQUE,
            file_name TEXT,
            duration REAL,
            artist TEXT, title TEXT, album TEXT, year TEXT, genre TEXT,
            created_at TEXT
        )""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS llm_metadata (
            file_id INTEGER UNIQUE,
            AI_LOUDNESS REAL, AI_BPM REAL, AI_KEY TEXT,
            AI_ENERGY REAL, AI_DANCEABILITY REAL, AI_ACOUSTICNESS REAL,
            AI_INSTRUMENTALNESS REAL, AI_LIVENESS REAL, AI_SPEECHINESS REAL,
            AI_VALENCE REAL, AI_TEMPO_CONFIDENCE REAL, AI_KEY_CONFIDENCE REAL,
            extract_strategy TEXT, windows_used TEXT, notes TEXT,
            FOREIGN KEY(file_id) REFERENCES audio_files(id)
        )""")

        # Migración ligera: asegurar columnas nuevas
        def ensure_col(table: str, col: str, decl: str) -> None:
            cur.execute(f"PRAGMA table_info({table})")
            cols = [r[1] for r in cur.fetchall()]
            if col not in cols:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")

        ensure_col("llm_metadata", "extract_strategy", "TEXT")
        ensure_col("llm_metadata", "windows_used", "TEXT")
        ensure_col("llm_metadata", "notes", "TEXT")

        try:
            # Upsert en audio_files
            md = result.get("metadata") or {}
            analyzed_sec = float(result.get("duration_analyzed_sec") or 0.0)
            cur.execute(
                "INSERT INTO audio_files (file_path, file_name, duration, artist, title, album, year, genre, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(file_path) DO UPDATE SET "
                "file_name=excluded.file_name, duration=excluded.duration, artist=excluded.artist, "
                "title=excluded.title, album=excluded.album, year=excluded.year, genre=excluded.genre",
                (
                    result["file_path"],
                    result["file_name"],
                    analyzed_sec,
                    md.get("artist"),
                    md.get("title"),
                    md.get("album"),
                    md.get("year"),
                    md.get("genre"),
                    datetime.now().isoformat(),
                ),
            )

            # Obtener id
            cur.execute("SELECT id FROM audio_files WHERE file_path = ?", (result["file_path"],))
            row = cur.fetchone()
            if not row:
                raise RuntimeError("No se pudo recuperar file_id.")
            file_id = int(row[0])

            f = result["features"]
            extract_strategy = str(result.get("extract_strategy") or "")
            windows_used = json.dumps(result.get("windows_used") or {})
            notes = result.get("notes")

            # Upsert en llm_metadata
            cur.execute("SELECT file_id FROM llm_metadata WHERE file_id = ?", (file_id,))
            if cur.fetchone():
                cur.execute("""
                UPDATE llm_metadata SET
                    AI_LOUDNESS=?, AI_BPM=?, AI_KEY=?,
                    AI_ENERGY=?, AI_DANCEABILITY=?, AI_ACOUSTICNESS=?,
                    AI_INSTRUMENTALNESS=?, AI_LIVENESS=?, AI_SPEECHINESS=?,
                    AI_VALENCE=?, AI_TEMPO_CONFIDENCE=?, AI_KEY_CONFIDENCE=?,
                    extract_strategy=?, windows_used=?, notes=?
                WHERE file_id=?
                """, (
                    float(f.get("loudness", 0.0)),
                    float(f.get("bpm", 0.0)),
                    str(f.get("key", "")),
                    float(f.get("energy", 0.0)),
                    float(f.get("danceability", 0.0)),
                    float(f.get("acousticness", 0.0)),
                    float(f.get("instrumentalness", 0.0)),
                    float(f.get("liveness", 0.0)),
                    float(f.get("speechiness", 0.0)),
                    float(f.get("valence", 0.0)),
                    float(f.get("bpm_confidence", 0.0)),
                    float(f.get("key_confidence", 0.0)),
                    extract_strategy, windows_used, notes, file_id
                ))
            else:
                cur.execute("""
                INSERT INTO llm_metadata (
                    file_id, AI_LOUDNESS, AI_BPM, AI_KEY,
                    AI_ENERGY, AI_DANCEABILITY, AI_ACOUSTICNESS,
                    AI_INSTRUMENTALNESS, AI_LIVENESS, AI_SPEECHINESS,
                    AI_VALENCE, AI_TEMPO_CONFIDENCE, AI_KEY_CONFIDENCE,
                    extract_strategy, windows_used, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    file_id,
                    float(f.get("loudness", 0.0)),
                    float(f.get("bpm", 0.0)),
                    str(f.get("key", "")),
                    float(f.get("energy", 0.0)),
                    float(f.get("danceability", 0.0)),
                    float(f.get("acousticness", 0.0)),
                    float(f.get("instrumentalness", 0.0)),
                    float(f.get("liveness", 0.0)),
                    float(f.get("speechiness", 0.0)),
                    float(f.get("valence", 0.0)),
                    float(f.get("bpm_confidence", 0.0)),
                    float(f.get("key_confidence", 0.0)),
                    extract_strategy, windows_used, notes
                ))

            conn.commit()
            logger.info("Guardado en BD: %s", result["file_name"])
            return True
        except Exception as e:
            logger.error("Error guardando en BD: %s", e)
            return False
        finally:
            conn.close()


# ===== CLI ===================================================================
def _build_arg_parser():
    import argparse
    p = argparse.ArgumentParser(
        description="Essentia Enhanced v2 - Análisis avanzado de audio"
    )
    p.add_argument("file", help="Archivo o directorio a procesar")
    p.add_argument("--strategy", default="smart60", choices=["smart60", "first60", "full"],
                   help="Estrategia de extracción de audio (default: smart60)")
    p.add_argument("--duration", type=int, default=60,
                   help="Duración en segundos a analizar (cuando aplique)")
    p.add_argument("--save-db", action="store_true", help="Guardar resultados en SQLite")
    p.add_argument("--db", default="music_analyzer.db", help="Ruta de la base SQLite")
    p.add_argument("--json", help="Ruta para exportar resultados en JSON")
    p.add_argument("--no-cache", action="store_true", help="Desactivar caché en memoria")
    p.add_argument("--verbose", action="store_true", help="Más logs")
    return p


def main():
    parser = _build_arg_parser()
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    cfg = AnalysisConfig(
        sample_rate=44100,
        extract_strategy=args.strategy,
        duration_sec=int(args.duration),
        use_cache=not args.no_cache,
    )
    analyzer = EssentiaEnhancedV2(cfg)

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"❌ No encontrado: {file_path}")
        sys.exit(1)

    results: List[Dict[str, Any]] = []

    def handle_one(fp: Path):
        res = analyzer.process_file(str(fp))
        if res.get("status") == "success":
            print(f"  ✅ {fp.name} | BPM={res['features'].get('bpm')} | Key={res['features'].get('key')}")
            if args.save_db:
                analyzer.save_to_db(res, db_path=args.db)
            results.append(res)
        else:
            print(f"  ❌ {fp.name} | {res.get('error')}")

    if file_path.is_file():
        print(f"🎵 Procesando archivo: {file_path.name}")
        handle_one(file_path)
    else:
        print(f"📁 Procesando directorio: {file_path}")
        audio_exts = (".mp3", ".m4a", ".flac", ".wav", ".ogg", ".aiff", ".aif")
        files = sorted([p for p in file_path.rglob("*") if p.suffix.lower() in audio_exts])
        total = len(files)
        if total == 0:
            print("No hay archivos de audio compatibles.")
        for i, fp in enumerate(files, 1):
            print(f"[{i}/{total}] {fp.name}")
            handle_one(fp)

    if args.json and results:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"📄 Exportado JSON: {args.json}")

    print(f"✅ Terminado. {len(results)} elemento(s) con éxito.")


if __name__ == "__main__":
    main()