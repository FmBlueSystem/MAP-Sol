#!/usr/bin/env python3
"""
Single-writer database worker for thread-safe writes with SQLite.
Enqueue write operations to serialize access and avoid contention.
"""

from PyQt6.QtCore import QThread, pyqtSignal
import sqlite3
from pathlib import Path
import json
import queue


class DBWriteWorker(QThread):
    """Background worker that serializes DB writes.

    Supports operations:
      - update_track_features: (track_id:int, features:dict)
      - update_track_artwork: (file_path:str, artwork_data:bytes, artwork_path:str|None)
      - save_hamms: (track_id:int, vector_12d:list[float], metadata:dict)
    """

    error = pyqtSignal(str)

    def __init__(self, db_path: str | Path, max_queue_size: int = 1000, busy_timeout_ms: int = 3000):
        super().__init__()
        self.db_path = str(db_path)
        self._queue: queue.Queue = queue.Queue(maxsize=max_queue_size)
        self._stop = False
        self._busy_timeout = int(busy_timeout_ms)

    def enqueue(self, op: str, *args):
        try:
            self._queue.put_nowait((op, args))
        except queue.Full:
            self.error.emit("DB queue is full; dropping operation")

    def stop(self):
        self._stop = True
        # Unblock queue
        try:
            self._queue.put_nowait(("__stop__", ()))
        except Exception:
            pass

    def run(self):
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                conn.execute('PRAGMA journal_mode=WAL')
                conn.execute('PRAGMA synchronous=NORMAL')
                conn.execute(f'PRAGMA busy_timeout={self._busy_timeout}')
                conn.execute('PRAGMA foreign_keys=ON')
            except sqlite3.Error:
                pass

            while not self._stop:
                op, args = self._queue.get()
                if op == "__stop__":
                    break
                try:
                    if op == 'update_track_features':
                        self._op_update_track_features(conn, *args)
                    elif op == 'update_track_artwork':
                        self._op_update_track_artwork(conn, *args)
                    elif op == 'save_hamms':
                        self._op_save_hamms(conn, *args)
                except Exception as e:
                    self.error.emit(str(e))
        finally:
            try:
                if conn:
                    conn.close()
            except Exception:
                pass

    def _op_update_track_features(self, conn: sqlite3.Connection, track_id: int, features: dict):
        with conn:
            conn.execute('''
                UPDATE tracks
                SET bpm = ?, initial_key = ?, energy_level = ?,
                    danceability = ?, valence = ?, acousticness = ?,
                    instrumentalness = ?, tempo_stability = ?
                WHERE id = ?
            ''', (
                features.get('bpm'),
                features.get('key'),
                features.get('energy_level'),
                features.get('danceability'),
                features.get('valence'),
                features.get('acousticness'),
                features.get('instrumentalness'),
                features.get('tempo_stability'),
                track_id
            ))

    def _op_update_track_artwork(self, conn: sqlite3.Connection, file_path: str, artwork_data: bytes | None, artwork_path: str | None):
        with conn:
            conn.execute('''
                UPDATE tracks
                SET artwork_data = ?, artwork_path = ?
                WHERE file_path = ?
            ''', (artwork_data, artwork_path, file_path))

    def _op_save_hamms(self, conn: sqlite3.Connection, track_id: int, vector_12d: list[float], metadata: dict):
        vector_json = json.dumps(vector_12d)
        energy_curve = json.dumps(metadata.get('energy_curve', []))
        transition_points = json.dumps(metadata.get('transition_points', []))
        # Build spectral features JSON if present
        spectral = {
            'centroid': metadata.get('spectral_centroid'),
            'rolloff': metadata.get('spectral_rolloff'),
            'flux': metadata.get('spectral_flux'),
            'brightness': metadata.get('brightness'),
            'zcr': metadata.get('zcr_mean') or metadata.get('rhythmic_pattern'),
            'mfcc_mean': metadata.get('mfcc_mean'),
            'onset_strength': metadata.get('onset_strength_mean'),
            'calc_time': metadata.get('calculated_time_sec'),
        }
        # Remove None values to keep JSON clean
        spectral = {k: v for k, v in spectral.items() if v is not None}
        spectral_json = json.dumps(spectral) if spectral else None
        with conn:
            conn.execute('''
                INSERT OR REPLACE INTO hamms_advanced (
                    file_id, vector_12d, spectral_features,
                    tempo_stability, harmonic_complexity, dynamic_range,
                    energy_curve, transition_points,
                    genre_cluster, ml_confidence
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                track_id,
                vector_json,
                spectral_json,
                metadata.get('tempo_stability', 0.7),
                metadata.get('harmonic_complexity', 0.5),
                metadata.get('dynamic_range', 0.5),
                energy_curve,
                transition_points,
                metadata.get('genre_cluster', 0),
                metadata.get('ml_confidence', 0.8)
            ))
