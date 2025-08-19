/**
 * BATCH AUDIO ANALYZER
 * Procesa múltiples archivos y actualiza la base de datos SQLite
 */

#include <iostream>
#include <fstream>
#include <sqlite3.h>
#include <thread>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <filesystem>
#include "audio-analyzer.cpp"

namespace fs = std::filesystem;

class BatchAnalyzer {
private:
    sqlite3* db;
    std::queue<std::string> fileQueue;
    std::mutex queueMutex;
    std::condition_variable cv;
    bool done = false;
    int numThreads;
    
public:
    BatchAnalyzer(const std::string& dbPath, int threads = 4) : numThreads(threads) {
        // Open SQLite database
        int rc = sqlite3_open(dbPath.c_str(), &db);
        if (rc) {
            std::cerr << "Can't open database: " << sqlite3_errmsg(db) << std::endl;
            exit(1);
        }
        
        // Create table if not exists
        const char* createTable = R"(
            CREATE TABLE IF NOT EXISTS audio_features (
                file_id INTEGER PRIMARY KEY,
                loudness REAL,
                danceability REAL,
                acousticness REAL,
                instrumentalness REAL,
                liveness REAL,
                speechiness REAL,
                valence REAL,
                energy REAL,
                computed_bpm REAL,
                computed_key TEXT,
                analysis_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(file_id) REFERENCES audio_files(id)
            );
        )";
        
        char* errMsg = nullptr;
        rc = sqlite3_exec(db, createTable, nullptr, nullptr, &errMsg);
        if (rc != SQLITE_OK) {
            std::cerr << "SQL error: " << errMsg << std::endl;
            sqlite3_free(errMsg);
        }
    }
    
    ~BatchAnalyzer() {
        sqlite3_close(db);
    }
    
    void processFile(const std::string& filePath, int fileId) {
        try {
            AudioAnalyzer analyzer;
            AudioFeatures features = analyzer.analyzeFile(filePath);
            
            // Update database
            const char* insertSQL = R"(
                INSERT OR REPLACE INTO audio_features 
                (file_id, loudness, danceability, acousticness, instrumentalness, 
                 liveness, speechiness, valence, energy, computed_bpm, computed_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            )";
            
            sqlite3_stmt* stmt;
            sqlite3_prepare_v2(db, insertSQL, -1, &stmt, nullptr);
            
            sqlite3_bind_int(stmt, 1, fileId);
            sqlite3_bind_double(stmt, 2, features.loudness);
            sqlite3_bind_double(stmt, 3, features.danceability);
            sqlite3_bind_double(stmt, 4, features.acousticness);
            sqlite3_bind_double(stmt, 5, features.instrumentalness);
            sqlite3_bind_double(stmt, 6, features.liveness);
            sqlite3_bind_double(stmt, 7, features.speechiness);
            sqlite3_bind_double(stmt, 8, features.valence);
            sqlite3_bind_double(stmt, 9, features.energy);
            sqlite3_bind_double(stmt, 10, features.bpm);
            sqlite3_bind_text(stmt, 11, features.key.c_str(), -1, SQLITE_STATIC);
            
            sqlite3_step(stmt);
            sqlite3_finalize(stmt);
            
            std::cout << "✅ Processed: " << fs::path(filePath).filename() 
                     << " [BPM: " << features.bpm 
                     << ", Energy: " << features.energy 
                     << ", Valence: " << features.valence << "]" << std::endl;
                     
        } catch (const std::exception& e) {
            std::cerr << "❌ Error processing " << filePath << ": " << e.what() << std::endl;
        }
    }
    
    void worker() {
        while (true) {
            std::unique_lock<std::mutex> lock(queueMutex);
            cv.wait(lock, [this] { return !fileQueue.empty() || done; });
            
            if (done && fileQueue.empty()) break;
            
            if (!fileQueue.empty()) {
                std::string filePath = fileQueue.front();
                fileQueue.pop();
                lock.unlock();
                
                // Extract file_id from path (you might need to query DB)
                int fileId = getFileIdFromPath(filePath);
                if (fileId > 0) {
                    processFile(filePath, fileId);
                }
            }
        }
    }
    
    int getFileIdFromPath(const std::string& filePath) {
        const char* query = "SELECT id FROM audio_files WHERE file_path = ?";
        sqlite3_stmt* stmt;
        sqlite3_prepare_v2(db, query, -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, filePath.c_str(), -1, SQLITE_STATIC);
        
        int fileId = -1;
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            fileId = sqlite3_column_int(stmt, 0);
        }
        
        sqlite3_finalize(stmt);
        return fileId;
    }
    
    void loadFilesFromDatabase() {
        const char* query = R"(
            SELECT file_path FROM audio_files 
            WHERE id NOT IN (SELECT file_id FROM audio_features)
            AND file_path IS NOT NULL
            LIMIT 1000;
        )";
        
        sqlite3_stmt* stmt;
        sqlite3_prepare_v2(db, query, -1, &stmt, nullptr);
        
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            const char* path = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            if (path && fs::exists(path)) {
                std::lock_guard<std::mutex> lock(queueMutex);
                fileQueue.push(std::string(path));
            }
        }
        
        sqlite3_finalize(stmt);
        std::cout << "📊 Loaded " << fileQueue.size() << " files to process" << std::endl;
    }
    
    void run() {
        loadFilesFromDatabase();
        
        // Start worker threads
        std::vector<std::thread> workers;
        for (int i = 0; i < numThreads; ++i) {
            workers.emplace_back(&BatchAnalyzer::worker, this);
        }
        
        // Wait for queue to empty
        {
            std::unique_lock<std::mutex> lock(queueMutex);
            cv.wait(lock, [this] { return fileQueue.empty(); });
        }
        
        // Signal workers to stop
        {
            std::lock_guard<std::mutex> lock(queueMutex);
            done = true;
        }
        cv.notify_all();
        
        // Wait for workers to finish
        for (auto& w : workers) {
            w.join();
        }
        
        std::cout << "✅ Batch processing complete!" << std::endl;
    }
};

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cout << "Usage: " << argv[0] << " <database.db> [num_threads]" << std::endl;
        return 1;
    }
    
    int numThreads = argc > 2 ? std::stoi(argv[2]) : 4;
    
    BatchAnalyzer analyzer(argv[1], numThreads);
    analyzer.run();
    
    return 0;
}