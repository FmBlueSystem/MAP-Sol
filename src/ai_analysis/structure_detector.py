"""
Musical structure and mix point detection.
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
import json

try:
    import librosa
    HAS_LIBROSA = True
except ImportError:
    HAS_LIBROSA = False


class StructureDetector:
    """Detect musical structure segments and mix points."""
    
    def __init__(self, sr: int = 44100, hop_length: int = 512):
        """
        Initialize structure detector.
        
        Args:
            sr: Sample rate
            hop_length: Hop length for analysis
        """
        self.sr = sr
        self.hop_length = hop_length
    
    def analyze(self, filepath: str) -> dict:
        """
        Analyze musical structure of an audio file.
        
        Args:
            filepath: Path to audio file
            
        Returns:
            Dict with segments, transition_points, and energy_curve
        """
        if not HAS_LIBROSA:
            # Fallback without librosa
            return self._analyze_fallback(filepath)
        
        try:
            # Load audio
            y, sr = librosa.load(filepath, sr=self.sr, mono=True)
            
            if len(y) < sr:  # Less than 1 second
                return self._empty_result()
            
            # Calculate features
            onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=self.hop_length)
            tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=self.hop_length)
            
            # Energy curve (RMS)
            rms = librosa.feature.rms(y=y, hop_length=self.hop_length)[0]
            
            # Spectral features for novelty
            spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr, hop_length=self.hop_length)
            
            # Detect segment boundaries using novelty curve
            novelty = self._compute_novelty(spectral_contrast)
            boundaries = self._detect_boundaries(novelty, sr)
            
            # Create segments
            segments = self._create_segments(boundaries, rms, sr)
            
            # Detect transition points
            transition_points = self._detect_transition_points(y, sr, beats, segments)
            
            # Downsample energy curve for UI (2-4 Hz)
            energy_curve = self._downsample_energy(rms, sr)
            
            return {
                'segments': segments,
                'transition_points': transition_points,
                'energy_curve': energy_curve
            }
            
        except Exception as e:
            print(f"Structure analysis error: {e}")
            return self._empty_result()
    
    def _analyze_fallback(self, filepath: str) -> dict:
        """
        Fallback analysis without librosa.
        """
        try:
            import soundfile as sf
            
            # Read audio
            data, sr = sf.read(filepath)
            
            if len(data.shape) > 1:
                # Convert to mono
                data = np.mean(data, axis=1)
            
            duration = len(data) / sr
            
            if duration < 1:
                return self._empty_result()
            
            # Simple energy-based segmentation
            window_size = sr // 2  # 0.5 second windows
            n_windows = len(data) // window_size
            
            if n_windows < 4:
                # Too short for meaningful segmentation
                segments = [
                    {'label': 'full', 'start_sec': 0, 'end_sec': duration, 'energy_mean': 0.5}
                ]
            else:
                # Divide into 4 equal segments
                segment_duration = duration / 4
                segments = []
                labels = ['intro', 'verse', 'chorus', 'outro']
                
                for i, label in enumerate(labels):
                    start = i * segment_duration
                    end = (i + 1) * segment_duration if i < 3 else duration
                    
                    # Calculate mean energy for segment
                    start_idx = int(start * sr)
                    end_idx = int(end * sr)
                    segment_data = data[start_idx:end_idx]
                    energy = np.sqrt(np.mean(segment_data ** 2)) if len(segment_data) > 0 else 0
                    
                    segments.append({
                        'label': label,
                        'start_sec': start,
                        'end_sec': end,
                        'energy_mean': min(1.0, energy * 2)  # Normalize roughly
                    })
            
            # Simple transition points at segment boundaries
            transition_points = [seg['start_sec'] for seg in segments[1:]]
            
            # Simple energy curve (10 points)
            n_points = min(40, int(duration * 4))  # ~4Hz
            energy_curve = []
            for i in range(n_points):
                t = i * duration / n_points
                idx = int(t * sr)
                window_start = max(0, idx - window_size // 2)
                window_end = min(len(data), idx + window_size // 2)
                window_data = data[window_start:window_end]
                energy = np.sqrt(np.mean(window_data ** 2)) if len(window_data) > 0 else 0
                energy_curve.append(min(1.0, energy * 2))
            
            return {
                'segments': segments,
                'transition_points': transition_points,
                'energy_curve': energy_curve
            }
            
        except Exception as e:
            print(f"Fallback analysis error: {e}")
            return self._empty_result()
    
    def _empty_result(self) -> dict:
        """Return empty result structure."""
        return {
            'segments': [],
            'transition_points': [],
            'energy_curve': []
        }
    
    def _compute_novelty(self, features: np.ndarray) -> np.ndarray:
        """Compute novelty curve from spectral features."""
        # Simple novelty: difference between consecutive frames
        diff = np.diff(features, axis=1)
        novelty = np.sum(np.abs(diff), axis=0)
        
        # Smooth
        try:
            from scipy.ndimage import gaussian_filter1d
            novelty = gaussian_filter1d(novelty, sigma=4)
        except ImportError:
            # Simple moving average fallback
            window = 5
            smoothed = np.convolve(novelty, np.ones(window)/window, mode='same')
            novelty = smoothed
        
        return novelty
    
    def _detect_boundaries(self, novelty: np.ndarray, sr: int) -> List[float]:
        """Detect segment boundaries from novelty curve."""
        try:
            from scipy.signal import find_peaks
            
            # Find peaks in novelty
            peaks, properties = find_peaks(
                novelty,
                height=np.percentile(novelty, 75),
                distance=sr // self.hop_length * 2  # Minimum 2 seconds between boundaries
            )
            
            # Convert to seconds
            boundaries = [0.0]  # Start at 0
            for peak in peaks[:6]:  # Limit to 6 boundaries
                boundaries.append(peak * self.hop_length / sr)
            
        except ImportError:
            # Simple fallback: divide into equal segments
            duration = len(novelty) * self.hop_length / sr
            n_segments = min(4, int(duration / 30))  # One segment per 30 seconds
            boundaries = [i * duration / n_segments for i in range(n_segments + 1)]
        
        return boundaries
    
    def _create_segments(self, boundaries: List[float], rms: np.ndarray, sr: int) -> List[Dict]:
        """Create labeled segments from boundaries."""
        segments = []
        labels = ['intro', 'verse', 'chorus', 'break', 'drop', 'outro']
        
        for i in range(len(boundaries) - 1):
            start = boundaries[i]
            end = boundaries[i + 1]
            
            # Calculate mean energy for segment
            start_frame = int(start * sr / self.hop_length)
            end_frame = int(end * sr / self.hop_length)
            
            if start_frame < len(rms) and end_frame <= len(rms):
                segment_rms = rms[start_frame:end_frame]
                energy_mean = float(np.mean(segment_rms)) if len(segment_rms) > 0 else 0
            else:
                energy_mean = 0
            
            # Normalize energy to 0-1
            energy_mean = min(1.0, energy_mean * 4)
            
            # Assign label heuristically
            if i < len(labels):
                label = labels[i]
            else:
                label = 'section'
            
            segments.append({
                'label': label,
                'start_sec': float(start),
                'end_sec': float(end),
                'energy_mean': energy_mean
            })
        
        # Add final segment if needed
        if boundaries and len(rms) > 0:
            last_boundary = boundaries[-1]
            duration = len(rms) * self.hop_length / sr
            
            if duration - last_boundary > 1:  # More than 1 second remaining
                segments.append({
                    'label': 'outro',
                    'start_sec': float(last_boundary),
                    'end_sec': float(duration),
                    'energy_mean': 0.3
                })
        
        return segments
    
    def _detect_transition_points(self, y: np.ndarray, sr: int, beats: np.ndarray, 
                                   segments: List[Dict]) -> List[float]:
        """Detect optimal mix-in/mix-out points."""
        transition_points = []
        
        # Mix-in point: after intro or at first major segment
        if len(segments) >= 2:
            # Prefer end of intro
            for seg in segments:
                if seg['label'] == 'intro':
                    transition_points.append(seg['end_sec'])
                    break
            else:
                # Fallback to start of second segment
                transition_points.append(segments[1]['start_sec'])
        
        # Mix-out point: before outro or at last major segment
        if len(segments) >= 2:
            for seg in reversed(segments):
                if seg['label'] == 'outro':
                    transition_points.append(seg['start_sec'])
                    break
            else:
                # Fallback to start of last segment
                transition_points.append(segments[-1]['start_sec'])
        
        # Drop points: high energy segments
        for seg in segments:
            if seg['label'] in ['drop', 'chorus'] and seg['energy_mean'] > 0.7:
                mid_point = (seg['start_sec'] + seg['end_sec']) / 2
                if mid_point not in transition_points:
                    transition_points.append(mid_point)
        
        # Sort and deduplicate
        transition_points = sorted(list(set(transition_points)))
        
        return transition_points
    
    def _downsample_energy(self, rms: np.ndarray, sr: int) -> List[float]:
        """Downsample energy curve for UI display (2-4 Hz)."""
        # Target ~4 Hz sampling
        target_rate = 4
        frames_per_second = sr / self.hop_length
        downsample_factor = int(frames_per_second / target_rate)
        
        if downsample_factor < 1:
            downsample_factor = 1
        
        # Downsample
        downsampled = []
        for i in range(0, len(rms), downsample_factor):
            window = rms[i:i+downsample_factor]
            if len(window) > 0:
                # Normalize to 0-1
                value = float(np.mean(window))
                downsampled.append(min(1.0, value * 4))
        
        return downsampled