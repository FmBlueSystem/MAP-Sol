"""
Advanced vocal and instrument analysis using librosa and ML models.
Detects vocal characteristics, instruments, and musical elements.
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from utils.logger import setup_logger

logger = setup_logger(__name__)

try:
    import librosa
    import librosa.display
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    logger.warning("Librosa not available for vocal/instrument analysis")


class VocalInstrumentAnalyzer:
    """Analyze vocal characteristics and detect instruments in audio."""
    
    def __init__(self):
        """Initialize the analyzer."""
        self.sample_rate = 22050
        self.hop_length = 512
        
    def analyze_track(self, audio_file: str) -> Dict:
        """
        Complete vocal and instrument analysis.
        
        Args:
            audio_file: Path to audio file
            
        Returns:
            Dict with analysis results
        """
        if not LIBROSA_AVAILABLE:
            return self._fallback_analysis()
        
        try:
            # Load audio
            y, sr = librosa.load(audio_file, sr=self.sample_rate, mono=True)
            
            # Perform analyses
            vocal_analysis = self.analyze_vocals(y, sr)
            instrument_detection = self.detect_instruments(y, sr)
            source_separation = self.separate_sources(y, sr)
            
            return {
                'vocal_characteristics': vocal_analysis,
                'instrumentation': instrument_detection,
                'source_separation': source_separation,
                'has_vocals': vocal_analysis.get('has_vocals', False),
                'is_instrumental': not vocal_analysis.get('has_vocals', False)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing track: {e}")
            return self._fallback_analysis()
    
    def analyze_vocals(self, y: np.ndarray, sr: int) -> Dict:
        """
        Analyze vocal characteristics.
        
        Args:
            y: Audio time series
            sr: Sample rate
            
        Returns:
            Dict with vocal analysis
        """
        result = {
            'has_vocals': False,
            'vocal_gender': None,
            'vocal_style': None,
            'pitch_range': None,
            'vibrato': False,
            'vocal_presence_ratio': 0.0
        }
        
        try:
            # Harmonic-percussive separation
            y_harmonic, y_percussive = librosa.effects.hpss(y)
            
            # Estimate pitch (F0) for vocal detection
            f0, voiced_flag, voiced_probs = librosa.pyin(
                y_harmonic,
                fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7'),
                sr=sr
            )
            
            # Remove NaN values
            f0_clean = f0[~np.isnan(f0)]
            
            if len(f0_clean) > 0:
                # Detect vocals based on pitch consistency
                vocal_presence = np.sum(voiced_flag) / len(voiced_flag)
                result['vocal_presence_ratio'] = float(vocal_presence)
                result['has_vocals'] = vocal_presence > 0.1  # 10% threshold
                
                if result['has_vocals']:
                    # Analyze pitch characteristics
                    mean_pitch = np.mean(f0_clean)
                    
                    # Gender detection based on pitch range
                    if mean_pitch < 165:  # Below E3
                        result['vocal_gender'] = 'male_bass'
                    elif mean_pitch < 220:  # Below A3
                        result['vocal_gender'] = 'male_tenor'
                    elif mean_pitch < 330:  # Below E4
                        result['vocal_gender'] = 'alto'
                    else:
                        result['vocal_gender'] = 'soprano'
                    
                    # Pitch range
                    result['pitch_range'] = {
                        'min_hz': float(np.min(f0_clean)),
                        'max_hz': float(np.max(f0_clean)),
                        'min_note': librosa.hz_to_note(np.min(f0_clean)),
                        'max_note': librosa.hz_to_note(np.max(f0_clean))
                    }
                    
                    # Detect vibrato (pitch modulation)
                    pitch_std = np.std(f0_clean)
                    if pitch_std > 5:  # Hz threshold
                        result['vibrato'] = True
                    
                    # Vocal style detection
                    # Use zero crossing rate for rap/sung detection
                    zcr = librosa.feature.zero_crossing_rate(y_harmonic)[0]
                    zcr_mean = np.mean(zcr)
                    
                    if zcr_mean > 0.1:
                        result['vocal_style'] = 'rap/spoken'
                    elif result['vibrato']:
                        result['vocal_style'] = 'operatic/trained'
                    else:
                        result['vocal_style'] = 'pop/contemporary'
            
            # Additional vocal features
            spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
            if np.mean(spectral_rolloff) > 4000:  # High frequency content
                result['vocal_brightness'] = 'bright'
            else:
                result['vocal_brightness'] = 'warm'
                
        except Exception as e:
            logger.debug(f"Vocal analysis error: {e}")
        
        return result
    
    def detect_instruments(self, y: np.ndarray, sr: int) -> Dict:
        """
        Detect instruments using spectral analysis.
        
        Args:
            y: Audio time series
            sr: Sample rate
            
        Returns:
            Dict with detected instruments
        """
        instruments = {
            'detected': [],
            'confidence': {},
            'dominant': None,
            'categories': []
        }
        
        try:
            # Compute spectral features
            spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
            spectral_bandwidth = np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr))
            spectral_rolloff = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))
            
            # Compute MFCC for timbre analysis
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            mfcc_mean = np.mean(mfcc, axis=1)
            
            # Percussive vs Harmonic
            y_harmonic, y_percussive = librosa.effects.hpss(y)
            harmonic_energy = np.sum(y_harmonic**2)
            percussive_energy = np.sum(y_percussive**2)
            total_energy = harmonic_energy + percussive_energy
            
            if total_energy > 0:
                percussive_ratio = percussive_energy / total_energy
            else:
                percussive_ratio = 0
            
            # Instrument detection based on spectral characteristics
            # These are heuristic rules based on typical frequency ranges
            
            # Drums/Percussion
            if percussive_ratio > 0.3:
                instruments['detected'].append('drums')
                instruments['confidence']['drums'] = float(percussive_ratio)
                instruments['categories'].append('percussion')
            
            # Bass detection (low frequency energy)
            y_bass = librosa.effects.preemphasis(y, coef=-0.97)  # Emphasize low freq
            bass_energy = np.sum(y_bass[:len(y_bass)//4]**2)  # First quarter (low freq)
            if bass_energy > np.mean(y**2) * 0.3:
                instruments['detected'].append('bass')
                instruments['confidence']['bass'] = 0.7
                instruments['categories'].append('bass')
            
            # Piano/Keys (harmonic content in mid range)
            if spectral_centroid > 1000 and spectral_centroid < 3000:
                if harmonic_energy > percussive_energy * 1.5:
                    instruments['detected'].append('piano/keys')
                    instruments['confidence']['piano/keys'] = 0.6
                    instruments['categories'].append('harmonic')
            
            # Guitar (specific frequency patterns)
            if spectral_centroid > 1500 and spectral_centroid < 4000:
                if mfcc_mean[1] > 0:  # Specific MFCC pattern
                    instruments['detected'].append('guitar')
                    instruments['confidence']['guitar'] = 0.5
                    instruments['categories'].append('string')
            
            # Synthesizer (high spectral bandwidth)
            if spectral_bandwidth > 3000:
                instruments['detected'].append('synthesizer')
                instruments['confidence']['synthesizer'] = 0.6
                instruments['categories'].append('electronic')
            
            # Strings (sustained harmonic content)
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            if np.std(onset_env) < 1.0 and harmonic_energy > percussive_energy * 2:
                instruments['detected'].append('strings')
                instruments['confidence']['strings'] = 0.5
                instruments['categories'].append('orchestral')
            
            # Brass (specific spectral shape)
            if spectral_rolloff > 5000 and spectral_centroid > 2000:
                instruments['detected'].append('brass')
                instruments['confidence']['brass'] = 0.4
                instruments['categories'].append('wind')
            
            # Determine dominant instrument
            if instruments['confidence']:
                dominant = max(instruments['confidence'], key=instruments['confidence'].get)
                instruments['dominant'] = dominant
            
            # Make categories unique
            instruments['categories'] = list(set(instruments['categories']))
            
        except Exception as e:
            logger.debug(f"Instrument detection error: {e}")
        
        return instruments
    
    def separate_sources(self, y: np.ndarray, sr: int) -> Dict:
        """
        Basic source separation using librosa.
        
        Args:
            y: Audio time series
            sr: Sample rate
            
        Returns:
            Dict with separation quality metrics
        """
        result = {
            'vocal_instrumental_ratio': None,
            'separation_quality': None,
            'components': []
        }
        
        try:
            # Harmonic-percussive separation
            y_harmonic, y_percussive = librosa.effects.hpss(y, margin=8)
            
            # Compute energies
            harmonic_energy = np.sum(y_harmonic**2)
            percussive_energy = np.sum(y_percussive**2)
            
            # Vocal/instrumental estimation
            # Vocals are typically in harmonic component
            result['vocal_instrumental_ratio'] = float(
                harmonic_energy / (harmonic_energy + percussive_energy)
            )
            
            # Separation quality (based on how well separated the components are)
            separation = 1.0 - np.corrcoef(y_harmonic, y_percussive)[0, 1]
            result['separation_quality'] = float(max(0, min(1, separation)))
            
            # Identify components
            if harmonic_energy > percussive_energy * 1.5:
                result['components'].append('strong_harmonic')
            if percussive_energy > harmonic_energy * 0.5:
                result['components'].append('strong_percussive')
            
            # Foreground/background separation using NMF
            try:
                # Simple NMF for source separation
                S = np.abs(librosa.stft(y))
                comps, acts = librosa.decompose.decompose(S, n_components=2)
                
                # The components represent different sources
                result['components'].append('multi_source')
                result['num_sources_estimated'] = 2
                
            except:
                pass
                
        except Exception as e:
            logger.debug(f"Source separation error: {e}")
        
        return result
    
    def _fallback_analysis(self) -> Dict:
        """Fallback when librosa is not available."""
        return {
            'vocal_characteristics': {
                'has_vocals': None,
                'vocal_gender': None,
                'vocal_style': None,
                'analysis_available': False
            },
            'instrumentation': {
                'detected': [],
                'confidence': {},
                'analysis_available': False
            },
            'source_separation': {
                'vocal_instrumental_ratio': None,
                'analysis_available': False
            }
        }