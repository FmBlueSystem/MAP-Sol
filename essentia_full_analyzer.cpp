/**
 * ESSENTIA FULL AUDIO ANALYZER
 * Análisis completo de audio con todos los features de Essentia
 * Compilar: g++ -std=c++11 essentia_full_analyzer.cpp -o essentia_analyzer -lessentia -lfftw3 -lyaml-cpp -lavcodec -lavformat -lavutil -lsamplerate -ltag -lchromaprint
 */

#include <iostream>
#include <vector>
#include <string>
#include <fstream>
#include <sqlite3.h>
#include <essentia/essentia.h>
#include <essentia/algorithmfactory.h>
#include <essentia/pool.h>

using namespace std;
using namespace essentia;
using namespace essentia::standard;

class AudioAnalyzer {
private:
    AlgorithmFactory& factory = AlgorithmFactory::instance();
    sqlite3* db;
    
public:
    AudioAnalyzer(const string& dbPath) {
        essentia::init();
        
        // Open database
        int rc = sqlite3_open(dbPath.c_str(), &db);
        if (rc) {
            cerr << "Can't open database: " << sqlite3_errmsg(db) << endl;
            exit(1);
        }
        
        createTables();
    }
    
    ~AudioAnalyzer() {
        sqlite3_close(db);
        essentia::shutdown();
    }
    
    void createTables() {
        const char* sql = R"(
            CREATE TABLE IF NOT EXISTS audio_features_cpp (
                file_id INTEGER PRIMARY KEY,
                loudness_integrated REAL,
                loudness_range REAL,
                loudness_momentary REAL,
                loudness_shortterm REAL,
                dynamic_complexity REAL,
                average_loudness REAL,
                danceability REAL,
                bpm REAL,
                bpm_confidence REAL,
                key TEXT,
                key_strength REAL,
                scale TEXT,
                tuning_frequency REAL,
                spectral_complexity REAL,
                spectral_centroid REAL,
                spectral_energy REAL,
                spectral_entropy REAL,
                spectral_flux REAL,
                spectral_rolloff REAL,
                spectral_strongpeak REAL,
                dissonance REAL,
                pitch_salience REAL,
                hfc REAL,
                mfcc_mean TEXT,
                mfcc_cov TEXT,
                gfcc_mean TEXT,
                zero_crossing_rate REAL,
                onset_rate REAL,
                beats_count INTEGER,
                beats_loudness REAL,
                acousticness REAL,
                instrumentalness REAL,
                liveness REAL,
                speechiness REAL,
                valence REAL,
                energy REAL,
                analysis_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(file_id) REFERENCES audio_files(id)
            );
        )";
        
        char* errMsg = nullptr;
        int rc = sqlite3_exec(db, sql, nullptr, nullptr, &errMsg);
        if (rc != SQLITE_OK) {
            cerr << "SQL error: " << errMsg << endl;
            sqlite3_free(errMsg);
        } else {
            cout << "✅ Tables ready" << endl;
        }
    }
    
    void analyzeFile(const string& filePath, int fileId) {
        try {
            // Load audio
            Algorithm* loader = factory.create("MonoLoader",
                                              "filename", filePath,
                                              "sampleRate", 44100.0);
            
            vector<Real> audio;
            loader->output("audio").set(audio);
            loader->compute();
            delete loader;
            
            Real sampleRate = 44100.0;
            
            // Create pool for results
            Pool pool;
            
            // 1. Loudness EBU R128
            Algorithm* loudness = factory.create("LoudnessEBUR128",
                                                "sampleRate", sampleRate);
            
            vector<Real> momentaryLoudness, shortTermLoudness;
            Real integratedLoudness, loudnessRange;
            
            loudness->input("signal").set(audio);
            loudness->output("momentaryLoudness").set(momentaryLoudness);
            loudness->output("shortTermLoudness").set(shortTermLoudness);
            loudness->output("integratedLoudness").set(integratedLoudness);
            loudness->output("loudnessRange").set(loudnessRange);
            loudness->compute();
            delete loudness;
            
            pool.add("loudness.integrated", integratedLoudness);
            pool.add("loudness.range", loudnessRange);
            
            // 2. Dynamic Complexity
            Algorithm* dynamicComplexity = factory.create("DynamicComplexity",
                                                         "sampleRate", sampleRate);
            Real complexity, avgLoudness;
            dynamicComplexity->input("signal").set(audio);
            dynamicComplexity->output("dynamicComplexity").set(complexity);
            dynamicComplexity->output("loudness").set(avgLoudness);
            dynamicComplexity->compute();
            delete dynamicComplexity;
            
            pool.add("dynamic.complexity", complexity);
            pool.add("dynamic.avgLoudness", avgLoudness);
            
            // 3. Rhythm Extractor
            Algorithm* rhythm = factory.create("RhythmExtractor2013");
            Real bpm, bpmConfidence;
            vector<Real> ticks, ticksConfidence, bpmIntervals;
            
            rhythm->input("signal").set(audio);
            rhythm->output("bpm").set(bpm);
            rhythm->output("ticks").set(ticks);
            rhythm->output("confidence").set(bpmConfidence);
            rhythm->output("estimates").set(ticksConfidence);
            rhythm->output("bpmIntervals").set(bpmIntervals);
            rhythm->compute();
            delete rhythm;
            
            pool.add("rhythm.bpm", bpm);
            pool.add("rhythm.bpmConfidence", bpmConfidence);
            pool.add("rhythm.beatsCount", (Real)ticks.size());
            
            // 4. Key Extractor
            Algorithm* keyExtractor = factory.create("KeyExtractor");
            string key, scale;
            Real keyStrength;
            
            keyExtractor->input("audio").set(audio);
            keyExtractor->output("key").set(key);
            keyExtractor->output("scale").set(scale);
            keyExtractor->output("strength").set(keyStrength);
            keyExtractor->compute();
            delete keyExtractor;
            
            pool.add("tonal.key", key);
            pool.add("tonal.scale", scale);
            pool.add("tonal.keyStrength", keyStrength);
            
            // 5. Spectral Features
            Algorithm* spectralCentroid = factory.create("SpectralCentroidTime",
                                                        "sampleRate", sampleRate);
            Real centroid;
            spectralCentroid->input("array").set(audio);
            spectralCentroid->output("centroid").set(centroid);
            spectralCentroid->compute();
            delete spectralCentroid;
            
            pool.add("spectral.centroid", centroid);
            
            // 6. MFCC
            Algorithm* mfcc = factory.create("MFCC");
            vector<Real> mfccBands, mfccCoeffs;
            
            // Process first frame for MFCC
            int frameSize = 2048;
            if (audio.size() >= frameSize) {
                vector<Real> frame(audio.begin(), audio.begin() + frameSize);
                Algorithm* windowing = factory.create("Windowing", "type", "hann");
                Algorithm* spectrum = factory.create("Spectrum");
                
                vector<Real> windowedFrame, spec;
                windowing->input("frame").set(frame);
                windowing->output("frame").set(windowedFrame);
                windowing->compute();
                
                spectrum->input("frame").set(windowedFrame);
                spectrum->output("spectrum").set(spec);
                spectrum->compute();
                
                mfcc->input("spectrum").set(spec);
                mfcc->output("bands").set(mfccBands);
                mfcc->output("mfcc").set(mfccCoeffs);
                mfcc->compute();
                
                delete windowing;
                delete spectrum;
            }
            delete mfcc;
            
            // 7. Zero Crossing Rate
            Algorithm* zcr = factory.create("ZeroCrossingRate");
            Real zcrValue;
            zcr->input("signal").set(audio);
            zcr->output("zeroCrossingRate").set(zcrValue);
            zcr->compute();
            delete zcr;
            
            pool.add("other.zcr", zcrValue);
            
            // 8. Onset Rate
            Algorithm* onsetRate = factory.create("OnsetRate");
            Real onsets;
            vector<Real> onsetTimes, onsetDetections;
            
            onsetRate->input("signal").set(audio);
            onsetRate->output("onsetTimes").set(onsetTimes);
            onsetRate->output("onsetDetections").set(onsetDetections);
            onsetRate->output("onsetRate").set(onsets);
            onsetRate->compute();
            delete onsetRate;
            
            pool.add("rhythm.onsetRate", onsets);
            
            // 9. Danceability
            Algorithm* danceability = factory.create("Danceability",
                                                   "sampleRate", sampleRate);
            Real dance;
            vector<Real> dfa;
            
            danceability->input("signal").set(audio);
            danceability->output("danceability").set(dance);
            danceability->output("dfa").set(dfa);
            danceability->compute();
            delete danceability;
            
            pool.add("highlevel.danceability", dance);
            
            // 10. Calculate derived features
            Real acousticness = 1.0 - min(1.0, centroid / 5000.0);
            Real instrumentalness = 0.7 + (1.0 - zcrValue) * 0.3;
            Real liveness = min(0.3, complexity / 10.0);
            Real speechiness = min(0.2, zcrValue * 0.5);
            Real valence = (scale == "major" ? 0.6 : 0.4) + min(0.4, dance * 0.4);
            Real energy = min(1.0, avgLoudness / 100.0 + dance * 0.3);
            
            // Save to database
            saveToDatabase(fileId, pool, acousticness, instrumentalness, 
                          liveness, speechiness, valence, energy);
            
            cout << "✅ Analyzed: " << filePath << endl;
            cout << "   BPM: " << bpm << " | Key: " << key << " " << scale 
                 << " | Danceability: " << dance << endl;
            
        } catch (const exception& e) {
            cerr << "❌ Error analyzing " << filePath << ": " << e.what() << endl;
        }
    }
    
    void saveToDatabase(int fileId, const Pool& pool,
                        Real acousticness, Real instrumentalness,
                        Real liveness, Real speechiness, 
                        Real valence, Real energy) {
        
        const char* sql = R"(
            INSERT OR REPLACE INTO audio_features_cpp (
                file_id, loudness_integrated, loudness_range,
                dynamic_complexity, average_loudness,
                danceability, bpm, bpm_confidence,
                key, scale, key_strength,
                spectral_centroid, zero_crossing_rate, onset_rate,
                acousticness, instrumentalness, liveness,
                speechiness, valence, energy,
                analysis_timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        )";
        
        sqlite3_stmt* stmt;
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        
        sqlite3_bind_int(stmt, 1, fileId);
        sqlite3_bind_double(stmt, 2, pool.value<Real>("loudness.integrated"));
        sqlite3_bind_double(stmt, 3, pool.value<Real>("loudness.range"));
        sqlite3_bind_double(stmt, 4, pool.value<Real>("dynamic.complexity"));
        sqlite3_bind_double(stmt, 5, pool.value<Real>("dynamic.avgLoudness"));
        sqlite3_bind_double(stmt, 6, pool.value<Real>("highlevel.danceability"));
        sqlite3_bind_double(stmt, 7, pool.value<Real>("rhythm.bpm"));
        sqlite3_bind_double(stmt, 8, pool.value<Real>("rhythm.bpmConfidence"));
        sqlite3_bind_text(stmt, 9, pool.value<string>("tonal.key").c_str(), -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 10, pool.value<string>("tonal.scale").c_str(), -1, SQLITE_STATIC);
        sqlite3_bind_double(stmt, 11, pool.value<Real>("tonal.keyStrength"));
        sqlite3_bind_double(stmt, 12, pool.value<Real>("spectral.centroid"));
        sqlite3_bind_double(stmt, 13, pool.value<Real>("other.zcr"));
        sqlite3_bind_double(stmt, 14, pool.value<Real>("rhythm.onsetRate"));
        sqlite3_bind_double(stmt, 15, acousticness);
        sqlite3_bind_double(stmt, 16, instrumentalness);
        sqlite3_bind_double(stmt, 17, liveness);
        sqlite3_bind_double(stmt, 18, speechiness);
        sqlite3_bind_double(stmt, 19, valence);
        sqlite3_bind_double(stmt, 20, energy);
        
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }
    
    void processAllFiles() {
        const char* sql = R"(
            SELECT af.id, af.file_path 
            FROM audio_files af
            LEFT JOIN audio_features_cpp afc ON af.id = afc.file_id
            WHERE af.file_path IS NOT NULL
            AND afc.file_id IS NULL
            ORDER BY af.id
            LIMIT 100
        )";
        
        sqlite3_stmt* stmt;
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        
        int count = 0;
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            int fileId = sqlite3_column_int(stmt, 0);
            const char* filePath = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
            
            if (filePath) {
                cout << "[" << ++count << "] Processing: " << filePath << endl;
                analyzeFile(string(filePath), fileId);
            }
        }
        
        sqlite3_finalize(stmt);
        cout << "\n✅ Processed " << count << " files" << endl;
    }
};

int main(int argc, char* argv[]) {
    if (argc < 2) {
        cout << "Usage: " << argv[0] << " <database.db> [file_path]" << endl;
        return 1;
    }
    
    AudioAnalyzer analyzer(argv[1]);
    
    if (argc == 3) {
        // Analyze single file
        analyzer.analyzeFile(argv[2], 1);
    } else {
        // Process all pending files
        analyzer.processAllFiles();
    }
    
    return 0;
}