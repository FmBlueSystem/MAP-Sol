/**
 * AUDIO ANALYZER WITH ESSENTIA
 * Calcula metadatos musicales usando Essentia C++
 * Compilar: g++ -std=c++11 audio-analyzer.cpp -lessentia -lfftw3 -lyaml -lavcodec -lavformat -lavutil -lsamplerate -ltag -lchromaprint -o audio-analyzer
 */

#include <iostream>
#include <essentia/essentia.h>
#include <essentia/algorithmfactory.h>
#include <essentia/pool.h>
#include <essentia/scheduler/network.h>

using namespace std;
using namespace essentia;
using namespace essentia::standard;

struct AudioFeatures {
    float loudness;        // LUFS integrado en dB [-60, 0]
    float danceability;    // 0-1
    float acousticness;    // 0-1
    float instrumentalness;// 0-1
    float liveness;        // 0-1
    float speechiness;     // 0-1
    float valence;         // 0-1
    float energy;          // 0-1 (bonus)
    float bpm;            // beats per minute
    string key;           // musical key
};

class AudioAnalyzer {
private:
    AlgorithmFactory& factory = AlgorithmFactory::instance();
    
public:
    AudioAnalyzer() {
        essentia::init();
    }
    
    ~AudioAnalyzer() {
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
     * 2. DANCEABILITY - Rhythm Analysis
     */
    float calculateDanceability(const vector<Real>& audio, Real sampleRate) {
        Algorithm* danceability = factory.create("Danceability",
                                                "sampleRate", sampleRate);
        
        Real danceValue;
        vector<Real> dfa;
        
        danceability->input("signal").set(audio);
        danceability->output("danceability").set(danceValue);
        danceability->output("dfa").set(dfa);
        
        danceability->compute();
        
        delete danceability;
        
        return min(1.0f, max(0.0f, danceValue));
    }
    
    /**
     * 3. ACOUSTICNESS - Spectral Features
     */
    float calculateAcousticness(const vector<Real>& audio, Real sampleRate) {
        // Spectral Flatness (lower = more acoustic)
        Algorithm* spectralFlatness = factory.create("FlatnessDB");
        Algorithm* windowing = factory.create("Windowing", "type", "hann");
        Algorithm* spectrum = factory.create("Spectrum");
        
        vector<Real> frame;
        vector<Real> windowedFrame;
        vector<Real> spec;
        Real flatness;
        
        float avgFlatness = 0;
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
            
            spectralFlatness->input("array").set(spec);
            spectralFlatness->output("flatnessDB").set(flatness);
            spectralFlatness->compute();
            
            avgFlatness += flatness;
            frameCount++;
        }
        
        delete spectralFlatness;
        delete windowing;
        delete spectrum;
        
        avgFlatness /= frameCount;
        
        // Convert to acousticness (inverted and normalized)
        // More flatness = less acoustic (more electronic)
        float acousticness = 1.0f - (avgFlatness / 100.0f); // Normalize assuming max ~100dB
        return min(1.0f, max(0.0f, acousticness));
    }
    
    /**
     * 4. INSTRUMENTALNESS - Voice Detection
     */
    float calculateInstrumentalness(const vector<Real>& audio, Real sampleRate) {
        // Using Zero Crossing Rate as proxy for voice detection
        Algorithm* zcr = factory.create("ZeroCrossingRate");
        
        vector<Real> frame;
        float avgZCR = 0;
        int frameCount = 0;
        int frameSize = 2048;
        int hopSize = 1024;
        Real zcrValue;
        
        for (int i = 0; i < audio.size() - frameSize; i += hopSize) {
            frame.assign(audio.begin() + i, audio.begin() + i + frameSize);
            
            zcr->input("signal").set(frame);
            zcr->output("zeroCrossingRate").set(zcrValue);
            zcr->compute();
            
            avgZCR += zcrValue;
            frameCount++;
        }
        
        delete zcr;
        
        avgZCR /= frameCount;
        
        // High ZCR often indicates speech/vocals
        // Low ZCR suggests instrumental
        float instrumentalness = 1.0f - min(1.0f, avgZCR * 2.0f);
        return min(1.0f, max(0.0f, instrumentalness));
    }
    
    /**
     * 5. LIVENESS - Dynamic Complexity
     */
    float calculateLiveness(const vector<Real>& audio, Real sampleRate) {
        Algorithm* dynamicComplexity = factory.create("DynamicComplexity",
                                                     "sampleRate", sampleRate);
        
        Real complexity;
        Real loudness;
        
        dynamicComplexity->input("signal").set(audio);
        dynamicComplexity->output("dynamicComplexity").set(complexity);
        dynamicComplexity->output("loudness").set(loudness);
        
        dynamicComplexity->compute();
        
        delete dynamicComplexity;
        
        // Normalize complexity to 0-1 range
        float liveness = min(1.0f, complexity / 20.0f); // Assuming max complexity ~20
        return liveness;
    }
    
    /**
     * 6. SPEECHINESS - Speech Detection Proxy
     */
    float calculateSpeechiness(const vector<Real>& audio, Real sampleRate) {
        // Using Spectral Rolloff as proxy
        Algorithm* rolloff = factory.create("RollOff");
        Algorithm* windowing = factory.create("Windowing", "type", "hann");
        Algorithm* spectrum = factory.create("Spectrum");
        
        vector<Real> frame;
        vector<Real> windowedFrame;
        vector<Real> spec;
        Real rolloffValue;
        
        float avgRolloff = 0;
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
            
            rolloff->input("spectrum").set(spec);
            rolloff->output("rollOff").set(rolloffValue);
            rolloff->compute();
            
            avgRolloff += rolloffValue;
            frameCount++;
        }
        
        delete rolloff;
        delete windowing;
        delete spectrum;
        
        avgRolloff /= frameCount;
        
        // Lower rolloff often indicates speech
        float speechiness = 1.0f - (avgRolloff / (sampleRate / 2.0f));
        return min(1.0f, max(0.0f, speechiness));
    }
    
    /**
     * 7. VALENCE - Musical Mood
     */
    float calculateValence(const vector<Real>& audio, Real sampleRate) {
        // Using Spectral Centroid (brightness) as proxy for valence
        Algorithm* centroid = factory.create("Centroid");
        Algorithm* windowing = factory.create("Windowing", "type", "hann");
        Algorithm* spectrum = factory.create("Spectrum");
        
        vector<Real> frame;
        vector<Real> windowedFrame;
        vector<Real> spec;
        Real centroidValue;
        
        float avgCentroid = 0;
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
            
            centroid->input("array").set(spec);
            centroid->output("centroid").set(centroidValue);
            centroid->compute();
            
            avgCentroid += centroidValue;
            frameCount++;
        }
        
        delete centroid;
        delete windowing;
        delete spectrum;
        
        avgCentroid /= frameCount;
        
        // Higher centroid = brighter = more positive valence
        float valence = min(1.0f, avgCentroid / 1000.0f); // Normalize
        return valence;
    }
    
    /**
     * BONUS: ENERGY - RMS Energy
     */
    float calculateEnergy(const vector<Real>& audio) {
        Algorithm* energy = factory.create("Energy");
        
        Real energyValue;
        energy->input("array").set(audio);
        energy->output("energy").set(energyValue);
        energy->compute();
        
        delete energy;
        
        // Normalize to 0-1
        return min(1.0f, sqrt(energyValue));
    }
    
    /**
     * BPM Detection
     */
    float calculateBPM(const vector<Real>& audio, Real sampleRate) {
        Algorithm* beatTracker = factory.create("BeatTrackerDegara",
                                               "sampleRate", sampleRate);
        
        vector<Real> ticks;
        beatTracker->input("signal").set(audio);
        beatTracker->output("ticks").set(ticks);
        beatTracker->compute();
        
        delete beatTracker;
        
        if (ticks.size() < 2) return 0;
        
        // Calculate average BPM from tick intervals
        float avgInterval = 0;
        for (int i = 1; i < ticks.size(); i++) {
            avgInterval += (ticks[i] - ticks[i-1]);
        }
        avgInterval /= (ticks.size() - 1);
        
        float bpm = 60.0f / avgInterval;
        return bpm;
    }
    
    /**
     * KEY Detection
     */
    string calculateKey(const vector<Real>& audio, Real sampleRate) {
        Algorithm* keyDetector = factory.create("KeyExtractor",
                                               "sampleRate", sampleRate);
        
        string key;
        string scale;
        Real strength;
        
        keyDetector->input("audio").set(audio);
        keyDetector->output("key").set(key);
        keyDetector->output("scale").set(scale);
        keyDetector->output("strength").set(strength);
        
        keyDetector->compute();
        
        delete keyDetector;
        
        return key + " " + scale;
    }
    
    /**
     * Main analysis function
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
        
        // Calculate all features
        features.loudness = calculateLoudness(audio, sampleRate);
        features.danceability = calculateDanceability(audio, sampleRate);
        features.acousticness = calculateAcousticness(audio, sampleRate);
        features.instrumentalness = calculateInstrumentalness(audio, sampleRate);
        features.liveness = calculateLiveness(audio, sampleRate);
        features.speechiness = calculateSpeechiness(audio, sampleRate);
        features.valence = calculateValence(audio, sampleRate);
        features.energy = calculateEnergy(audio);
        features.bpm = calculateBPM(audio, sampleRate);
        features.key = calculateKey(audio, sampleRate);
        
        return features;
    }
};

int main(int argc, char* argv[]) {
    if (argc < 2) {
        cout << "Usage: " << argv[0] << " <audio_file>" << endl;
        return 1;
    }
    
    AudioAnalyzer analyzer;
    AudioFeatures features = analyzer.analyzeFile(argv[1]);
    
    // Output as JSON
    cout << "{" << endl;
    cout << "  \"loudness\": " << features.loudness << "," << endl;
    cout << "  \"danceability\": " << features.danceability << "," << endl;
    cout << "  \"acousticness\": " << features.acousticness << "," << endl;
    cout << "  \"instrumentalness\": " << features.instrumentalness << "," << endl;
    cout << "  \"liveness\": " << features.liveness << "," << endl;
    cout << "  \"speechiness\": " << features.speechiness << "," << endl;
    cout << "  \"valence\": " << features.valence << "," << endl;
    cout << "  \"energy\": " << features.energy << "," << endl;
    cout << "  \"bpm\": " << features.bpm << "," << endl;
    cout << "  \"key\": \"" << features.key << "\"" << endl;
    cout << "}" << endl;
    
    return 0;
}