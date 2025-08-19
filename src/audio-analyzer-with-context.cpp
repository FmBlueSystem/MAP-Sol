/**
 * AUDIO ANALYZER WITH ESSENTIA - WITH CONTEXT
 * Usa BPM, Key y Energy existentes de MixedInKey para mejorar el análisis
 * Compilar: g++ -std=c++11 audio-analyzer-with-context.cpp -lessentia -lfftw3 -lyaml -lavcodec -lavformat -lavutil -lsamplerate -ltag -lchromaprint -o audio-analyzer-context
 */

#include <iostream>
#include <sstream>
#include <essentia/essentia.h>
#include <essentia/algorithmfactory.h>
#include <essentia/pool.h>

using namespace std;
using namespace essentia;
using namespace essentia::standard;

struct AudioContext {
    float existingBPM;      // From MixedInKey
    string existingKey;     // From MixedInKey (e.g., "4A", "12B")
    float existingEnergy;   // From MixedInKey (1-10 scale)
};

struct AudioFeatures {
    float loudness;         // LUFS integrado en dB [-60, 0]
    float danceability;     // 0-1
    float acousticness;     // 0-1
    float instrumentalness; // 0-1
    float liveness;         // 0-1
    float speechiness;      // 0-1
    float valence;          // 0-1
};

class ContextualAudioAnalyzer {
private:
    AlgorithmFactory& factory = AlgorithmFactory::instance();
    AudioContext context;
    
public:
    ContextualAudioAnalyzer(float bpm, const string& key, float energy) {
        essentia::init();
        context.existingBPM = bpm;
        context.existingKey = key;
        context.existingEnergy = energy / 10.0f; // Normalize to 0-1
    }
    
    ~ContextualAudioAnalyzer() {
        essentia::shutdown();
    }
    
    /**
     * 1. LOUDNESS - LUFS Integrado (EBU R128)
     */
    float calculateLoudness(const vector<Real>& audio, Real sampleRate) {
        Algorithm* loudness = factory.create("LoudnessEBUR128",
                                            "sampleRate", sampleRate);
        
        vector<Real> loudnessIntegrated;
        vector<Real> loudnessRange;
        vector<Real> loudnessMomentary;
        vector<Real> loudnessShortTerm;
        
        loudness->input("signal").set(audio);
        loudness->output("integratedLoudness").set(loudnessIntegrated);
        loudness->output("loudnessRange").set(loudnessRange);
        loudness->output("momentaryLoudness").set(loudnessMomentary);
        loudness->output("shortTermLoudness").set(loudnessShortTerm);
        
        loudness->compute();
        delete loudness;
        
        // Clamp to [-60, 0] dB
        float lufs = loudnessIntegrated[0];
        return max(-60.0f, min(0.0f, lufs));
    }
    
    /**
     * 2. DANCEABILITY - Enhanced with existing BPM
     */
    float calculateDanceability(const vector<Real>& audio, Real sampleRate) {
        // Use existing BPM to improve danceability calculation
        Algorithm* danceability = factory.create("Danceability",
                                                "sampleRate", sampleRate);
        
        Real danceValue;
        vector<Real> dfa;
        
        danceability->input("signal").set(audio);
        danceability->output("danceability").set(danceValue);
        danceability->output("dfa").set(dfa);
        
        danceability->compute();
        delete danceability;
        
        // Adjust based on BPM (120-128 BPM is optimal for dance)
        float bpmFactor = 1.0f;
        if (context.existingBPM > 0) {
            if (context.existingBPM >= 120 && context.existingBPM <= 128) {
                bpmFactor = 1.1f; // Boost for optimal dance BPM
            } else if (context.existingBPM >= 100 && context.existingBPM <= 140) {
                bpmFactor = 1.05f; // Slight boost for danceable range
            } else if (context.existingBPM < 90 || context.existingBPM > 150) {
                bpmFactor = 0.9f; // Reduce for very slow or very fast
            }
        }
        
        // Also consider energy level
        float energyBoost = 1.0f + (context.existingEnergy * 0.1f);
        
        return min(1.0f, max(0.0f, danceValue * bpmFactor * energyBoost));
    }
    
    /**
     * 3. ACOUSTICNESS - Spectral Features
     */
    float calculateAcousticness(const vector<Real>& audio, Real sampleRate) {
        Algorithm* spectralComplexity = factory.create("SpectralComplexity",
                                                       "sampleRate", sampleRate);
        Algorithm* spectralEntropy = factory.create("SpectralEntropy");
        Algorithm* windowing = factory.create("Windowing", "type", "hann");
        Algorithm* spectrum = factory.create("Spectrum");
        
        vector<Real> frame;
        vector<Real> windowedFrame;
        vector<Real> spec;
        Real complexity;
        Real entropy;
        
        float avgComplexity = 0;
        float avgEntropy = 0;
        int frameCount = 0;
        int frameSize = 2048;
        int hopSize = 1024;
        
        for (int i = 0; i < audio.size() - frameSize; i += hopSize) {
            frame.assign(audio.begin() + i, audio.begin() + i + frameSize);
            
            windowing->input("frame").set(frame);
            windowing->output("frame").set(windowedFrame);
            windowing->compute();
            
            spectrum->input("frame").set(windowedFrame);
            spectrum->output("spectrum").set(spec);
            spectrum->compute();
            
            spectralComplexity->input("spectrum").set(spec);
            spectralComplexity->output("spectralComplexity").set(complexity);
            spectralComplexity->compute();
            
            spectralEntropy->input("spectrum").set(spec);
            spectralEntropy->output("spectralEntropy").set(entropy);
            spectralEntropy->compute();
            
            avgComplexity += complexity;
            avgEntropy += entropy;
            frameCount++;
        }
        
        delete spectralComplexity;
        delete spectralEntropy;
        delete windowing;
        delete spectrum;
        
        avgComplexity /= frameCount;
        avgEntropy /= frameCount;
        
        // Lower complexity and higher entropy suggest more acoustic
        // Also consider energy - lower energy might indicate acoustic
        float acousticness = (1.0f - avgComplexity) * 0.5f + 
                            (avgEntropy / 10.0f) * 0.3f +
                            (1.0f - context.existingEnergy) * 0.2f;
        
        return min(1.0f, max(0.0f, acousticness));
    }
    
    /**
     * 4. INSTRUMENTALNESS - Voice Detection
     */
    float calculateInstrumentalness(const vector<Real>& audio, Real sampleRate) {
        // Spectral Roll-off and Centroid for voice detection
        Algorithm* rolloff = factory.create("RollOff");
        Algorithm* centroid = factory.create("Centroid");
        Algorithm* windowing = factory.create("Windowing", "type", "hann");
        Algorithm* spectrum = factory.create("Spectrum");
        
        vector<Real> frame;
        vector<Real> windowedFrame;
        vector<Real> spec;
        Real rolloffValue;
        Real centroidValue;
        
        float avgRolloff = 0;
        float avgCentroid = 0;
        float rolloffVariance = 0;
        int frameCount = 0;
        int frameSize = 2048;
        int hopSize = 512;
        
        vector<float> rolloffValues;
        
        for (int i = 0; i < audio.size() - frameSize; i += hopSize) {
            frame.assign(audio.begin() + i, audio.begin() + i + frameSize);
            
            windowing->input("frame").set(frame);
            windowing->output("frame").set(windowedFrame);
            windowing->compute();
            
            spectrum->input("frame").set(windowedFrame);
            spectrum->output("spectrum").set(spec);
            spectrum->compute();
            
            rolloff->input("spectrum").set(spec);
            rolloff->output("rollOff").set(rolloffValue);
            rolloff->compute();
            
            centroid->input("array").set(spec);
            centroid->output("centroid").set(centroidValue);
            centroid->compute();
            
            rolloffValues.push_back(rolloffValue);
            avgRolloff += rolloffValue;
            avgCentroid += centroidValue;
            frameCount++;
        }
        
        delete rolloff;
        delete centroid;
        delete windowing;
        delete spectrum;
        
        avgRolloff /= frameCount;
        avgCentroid /= frameCount;
        
        // Calculate variance
        for (float val : rolloffValues) {
            rolloffVariance += pow(val - avgRolloff, 2);
        }
        rolloffVariance /= frameCount;
        
        // High variance in rolloff suggests vocals
        // Low centroid suggests vocals
        float vocalProbability = min(1.0f, 
            (rolloffVariance / 1000000.0f) * 0.5f + 
            (1.0f - min(1.0f, avgCentroid / 1000.0f)) * 0.5f
        );
        
        float instrumentalness = 1.0f - vocalProbability;
        return min(1.0f, max(0.0f, instrumentalness));
    }
    
    /**
     * 5. LIVENESS - Dynamic Complexity + Onset Detection
     */
    float calculateLiveness(const vector<Real>& audio, Real sampleRate) {
        Algorithm* dynamicComplexity = factory.create("DynamicComplexity",
                                                     "sampleRate", sampleRate);
        Algorithm* onsetDetection = factory.create("OnsetDetection",
                                                   "method", "complex");
        Algorithm* windowing = factory.create("Windowing", "type", "hann");
        Algorithm* fft = factory.create("FFT");
        
        Real complexity;
        Real loudness;
        
        dynamicComplexity->input("signal").set(audio);
        dynamicComplexity->output("dynamicComplexity").set(complexity);
        dynamicComplexity->output("loudness").set(loudness);
        dynamicComplexity->compute();
        
        // Onset detection for crowd noise/applause
        vector<Real> frame;
        vector<Real> windowedFrame;
        vector<complex<Real>> fftFrame;
        vector<Real> spectrum;
        vector<Real> phase;
        Real onset;
        float avgOnsets = 0;
        int frameCount = 0;
        int frameSize = 2048;
        int hopSize = 512;
        
        for (int i = 0; i < audio.size() - frameSize; i += hopSize) {
            frame.assign(audio.begin() + i, audio.begin() + i + frameSize);
            
            windowing->input("frame").set(frame);
            windowing->output("frame").set(windowedFrame);
            windowing->compute();
            
            fft->input("frame").set(windowedFrame);
            fft->output("fft").set(fftFrame);
            fft->compute();
            
            // Convert complex to magnitude and phase
            spectrum.clear();
            phase.clear();
            for (auto& c : fftFrame) {
                spectrum.push_back(abs(c));
                phase.push_back(arg(c));
            }
            
            onsetDetection->input("spectrum").set(spectrum);
            onsetDetection->input("phase").set(phase);
            onsetDetection->output("onsetDetection").set(onset);
            onsetDetection->compute();
            
            avgOnsets += onset;
            frameCount++;
        }
        
        delete dynamicComplexity;
        delete onsetDetection;
        delete windowing;
        delete fft;
        
        avgOnsets /= frameCount;
        
        // Combine complexity, onset density, and energy variation
        float liveness = min(1.0f, 
            (complexity / 20.0f) * 0.4f + 
            (avgOnsets / 100.0f) * 0.4f +
            (1.0f - abs(context.existingEnergy - 0.5f) * 2.0f) * 0.2f
        );
        
        return liveness;
    }
    
    /**
     * 6. SPEECHINESS - Enhanced Speech Detection
     */
    float calculateSpeechiness(const vector<Real>& audio, Real sampleRate) {
        Algorithm* mfcc = factory.create("MFCC",
                                        "sampleRate", sampleRate);
        Algorithm* windowing = factory.create("Windowing", "type", "hann");
        Algorithm* spectrum = factory.create("Spectrum");
        
        vector<Real> frame;
        vector<Real> windowedFrame;
        vector<Real> spec;
        vector<Real> mfccCoeffs;
        vector<Real> mfccBands;
        
        float mfccVariance = 0;
        int frameCount = 0;
        int frameSize = 2048;
        int hopSize = 512;
        
        vector<vector<Real>> allMFCCs;
        
        for (int i = 0; i < audio.size() - frameSize; i += hopSize) {
            frame.assign(audio.begin() + i, audio.begin() + i + frameSize);
            
            windowing->input("frame").set(frame);
            windowing->output("frame").set(windowedFrame);
            windowing->compute();
            
            spectrum->input("frame").set(windowedFrame);
            spectrum->output("spectrum").set(spec);
            spectrum->compute();
            
            mfcc->input("spectrum").set(spec);
            mfcc->output("mfcc").set(mfccCoeffs);
            mfcc->output("bands").set(mfccBands);
            mfcc->compute();
            
            allMFCCs.push_back(mfccCoeffs);
            frameCount++;
        }
        
        delete mfcc;
        delete windowing;
        delete spectrum;
        
        // Calculate MFCC variance (high variance indicates speech)
        if (allMFCCs.size() > 1) {
            for (int i = 0; i < 13; i++) { // First 13 MFCC coefficients
                float mean = 0;
                for (auto& coeffs : allMFCCs) {
                    if (coeffs.size() > i) mean += coeffs[i];
                }
                mean /= allMFCCs.size();
                
                float var = 0;
                for (auto& coeffs : allMFCCs) {
                    if (coeffs.size() > i) var += pow(coeffs[i] - mean, 2);
                }
                mfccVariance += var / allMFCCs.size();
            }
        }
        
        // High MFCC variance and low energy suggest speech
        float speechiness = min(1.0f, 
            (mfccVariance / 10000.0f) * 0.7f + 
            (1.0f - context.existingEnergy) * 0.3f
        );
        
        return min(1.0f, max(0.0f, speechiness));
    }
    
    /**
     * 7. VALENCE - Musical Mood with Key Context
     */
    float calculateValence(const vector<Real>& audio, Real sampleRate) {
        // Parse key to determine major/minor
        bool isMajor = false;
        if (!context.existingKey.empty()) {
            char lastChar = context.existingKey.back();
            isMajor = (lastChar == 'B'); // Camelot: B = Major, A = Minor
        }
        
        Algorithm* spectralContrast = factory.create("SpectralContrast",
                                                     "sampleRate", sampleRate);
        Algorithm* dissonance = factory.create("Dissonance");
        Algorithm* windowing = factory.create("Windowing", "type", "hann");
        Algorithm* spectrum = factory.create("Spectrum");
        Algorithm* spectralPeaks = factory.create("SpectralPeaks",
                                                  "sampleRate", sampleRate);
        
        vector<Real> frame;
        vector<Real> windowedFrame;
        vector<Real> spec;
        vector<Real> scCoeffs;
        vector<Real> scValleys;
        vector<Real> frequencies;
        vector<Real> magnitudes;
        Real dissonanceValue;
        
        float avgDissonance = 0;
        float avgContrast = 0;
        int frameCount = 0;
        int frameSize = 2048;
        int hopSize = 1024;
        
        for (int i = 0; i < audio.size() - frameSize; i += hopSize) {
            frame.assign(audio.begin() + i, audio.begin() + i + frameSize);
            
            windowing->input("frame").set(frame);
            windowing->output("frame").set(windowedFrame);
            windowing->compute();
            
            spectrum->input("frame").set(windowedFrame);
            spectrum->output("spectrum").set(spec);
            spectrum->compute();
            
            spectralContrast->input("spectrum").set(spec);
            spectralContrast->output("spectralContrast").set(scCoeffs);
            spectralContrast->output("spectralValley").set(scValleys);
            spectralContrast->compute();
            
            spectralPeaks->input("spectrum").set(spec);
            spectralPeaks->output("frequencies").set(frequencies);
            spectralPeaks->output("magnitudes").set(magnitudes);
            spectralPeaks->compute();
            
            dissonance->input("frequencies").set(frequencies);
            dissonance->input("magnitudes").set(magnitudes);
            dissonance->output("dissonance").set(dissonanceValue);
            dissonance->compute();
            
            avgDissonance += dissonanceValue;
            if (!scCoeffs.empty()) {
                for (auto& c : scCoeffs) avgContrast += c;
                avgContrast /= scCoeffs.size();
            }
            frameCount++;
        }
        
        delete spectralContrast;
        delete dissonance;
        delete windowing;
        delete spectrum;
        delete spectralPeaks;
        
        avgDissonance /= frameCount;
        avgContrast /= frameCount;
        
        // Base valence on key (major = more positive)
        float keyValence = isMajor ? 0.6f : 0.4f;
        
        // Adjust based on dissonance (less dissonance = more positive)
        float dissonanceAdjust = 1.0f - min(1.0f, avgDissonance);
        
        // Consider energy and contrast
        float energyBoost = context.existingEnergy * 0.2f;
        float contrastBoost = min(1.0f, avgContrast / 10.0f) * 0.2f;
        
        float valence = keyValence * 0.4f + 
                       dissonanceAdjust * 0.3f + 
                       energyBoost + 
                       contrastBoost;
        
        return min(1.0f, max(0.0f, valence));
    }
    
    /**
     * Main analysis function with context
     */
    AudioFeatures analyzeFile(const string& filename) {
        // Load audio file
        Algorithm* audioLoader = factory.create("MonoLoader",
                                               "filename", filename,
                                               "sampleRate", 44100.0);
        
        vector<Real> audio;
        audioLoader->output("audio").set(audio);
        audioLoader->compute();
        delete audioLoader;
        
        AudioFeatures features;
        Real sampleRate = 44100.0;
        
        // Calculate all features using context
        features.loudness = calculateLoudness(audio, sampleRate);
        features.danceability = calculateDanceability(audio, sampleRate);
        features.acousticness = calculateAcousticness(audio, sampleRate);
        features.instrumentalness = calculateInstrumentalness(audio, sampleRate);
        features.liveness = calculateLiveness(audio, sampleRate);
        features.speechiness = calculateSpeechiness(audio, sampleRate);
        features.valence = calculateValence(audio, sampleRate);
        
        return features;
    }
};

int main(int argc, char* argv[]) {
    if (argc < 5) {
        cout << "Usage: " << argv[0] << " <audio_file> <bpm> <key> <energy>" << endl;
        cout << "Example: " << argv[0] << " song.mp3 120 4A 7" << endl;
        return 1;
    }
    
    string filename = argv[1];
    float bpm = stof(argv[2]);
    string key = argv[3];
    float energy = stof(argv[4]);
    
    ContextualAudioAnalyzer analyzer(bpm, key, energy);
    AudioFeatures features = analyzer.analyzeFile(filename);
    
    // Output as JSON
    cout << "{" << endl;
    cout << "  \"loudness\": " << features.loudness << "," << endl;
    cout << "  \"danceability\": " << features.danceability << "," << endl;
    cout << "  \"acousticness\": " << features.acousticness << "," << endl;
    cout << "  \"instrumentalness\": " << features.instrumentalness << "," << endl;
    cout << "  \"liveness\": " << features.liveness << "," << endl;
    cout << "  \"speechiness\": " << features.speechiness << "," << endl;
    cout << "  \"valence\": " << features.valence << endl;
    cout << "}" << endl;
    
    return 0;
}