from __future__ import annotations

from typing import Dict, Any, Optional
import numpy as np


def downsample_curve(curve: np.ndarray, bins: int = 64) -> list[float]:
    if curve.size == 0:
        return []
    L = curve.size
    if L <= bins:
        # pad to bins
        pad = np.pad(curve, (0, bins - L), mode="edge")
        return pad.astype(float).tolist()
    # average pooling
    edges = np.linspace(0, L, bins + 1, dtype=int)
    pooled = [float(curve[edges[i]:edges[i + 1]].mean()) for i in range(bins)]
    return pooled


def normalize_curve(curve: np.ndarray) -> np.ndarray:
    if curve.size == 0:
        return curve
    cmin, cmax = float(curve.min()), float(curve.max())
    if cmax <= cmin + 1e-12:
        return np.zeros_like(curve)
    return (curve - cmin) / (cmax - cmin)


def extract_audio_features(audio_path: str, *, fallback_bpm: Optional[float] = None) -> Dict[str, Any]:
    """Extract lightweight features with librosa if available.

    Returns a dict with optional keys; callers should handle absence gracefully.
    """
    try:
        import librosa
        y, sr = librosa.load(audio_path, sr=None, mono=True)
        # Tempo: do not recompute if provided (e.g., from Mixed In Key)
        if fallback_bpm is not None:
            tempo = float(fallback_bpm)
        else:
            oenv = librosa.onset.onset_strength(y=y, sr=sr)
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr, onset_envelope=oenv)
        # Energy (RMS) curve
        rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512).flatten()
        rms_norm = normalize_curve(rms)
        energy_profile = downsample_curve(rms_norm, bins=64)
        # Spectral features
        spec_centroid = librosa.feature.spectral_centroid(y=y, sr=sr).mean()
        spec_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr).mean()
        # Chroma (averaged)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = chroma.mean(axis=1).astype(float).tolist()
        # Simple novelty for structure boundaries
        novelty = librosa.onset.onset_strength_multi(S=librosa.stft(y=y), sr=sr)
        novelty = normalize_curve(novelty)
        bounds = np.linspace(0, len(y) / sr, num=6)  # coarse 5 segments as fallback
        try:
            # Attempt to detect boundaries using novelty peaks
            peaks = np.argwhere((novelty[1:-1] > novelty[:-2]) & (novelty[1:-1] > novelty[2:])).flatten() + 1
            times = librosa.frames_to_time(peaks, sr=sr, hop_length=512)
            if times.size >= 3:
                # pick up to 5 segments
                t = np.clip(times, 0, len(y) / sr)
                t = np.unique(np.concatenate([[0.0], t, [len(y) / sr]])).tolist()
                bounds = np.linspace(0, len(y) / sr, num=min(len(t), 6))
        except Exception:
            pass
        segments = [(float(bounds[i]), float(bounds[i + 1])) for i in range(len(bounds) - 1)]
        return {
            "tempo": float(tempo),
            "energy_profile": energy_profile,
            "spectral_centroid": float(spec_centroid),
            "spectral_bandwidth": float(spec_bandwidth),
            "chroma_mean": chroma_mean,
            "segments": segments,
        }
    except Exception:
        # librosa not available or extraction failed
        return {
            "tempo": None,
            "energy_profile": [],
            "spectral_centroid": None,
            "spectral_bandwidth": None,
            "chroma_mean": [],
            "segments": [],
        }
