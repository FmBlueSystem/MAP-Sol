"""
Cache manager for OpenAI API responses to optimize costs.
Implements LRU cache with TTL and persistent storage.
"""

import json
import hashlib
import sqlite3
import time
from pathlib import Path
from typing import Dict, Optional, Any
from datetime import datetime, timedelta
from utils.logger import setup_logger

logger = setup_logger(__name__)


class OpenAICacheManager:
    """Manage cache for OpenAI API responses."""
    
    def __init__(self, cache_dir: Optional[Path] = None, ttl_hours: int = 24):
        """
        Initialize cache manager.
        
        Args:
            cache_dir: Directory for cache storage
            ttl_hours: Time to live in hours
        """
        if cache_dir is None:
            cache_dir = Path.home() / ".music_player_qt" / "cache"
        
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_db = self.cache_dir / "openai_cache.db"
        self.ttl_seconds = ttl_hours * 3600
        
        self._init_db()
        
    def _init_db(self):
        """Initialize cache database."""
        conn = sqlite3.connect(str(self.cache_db))
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cache (
                hash TEXT PRIMARY KEY,
                request_type TEXT,
                request_data TEXT,
                response TEXT,
                cost_estimate REAL,
                timestamp REAL,
                hit_count INTEGER DEFAULT 0,
                last_accessed REAL
            )
        """)
        
        # Create index for cleanup
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp 
            ON cache(timestamp)
        """)
        
        conn.commit()
        conn.close()
        
    def get_cache_key(self, request_type: str, request_data: Dict) -> str:
        """
        Generate cache key from request.
        
        Args:
            request_type: Type of request (enrich_track, analyze_lyrics, etc)
            request_data: Request parameters
            
        Returns:
            Hash key for cache
        """
        # Create deterministic string from request
        cache_str = f"{request_type}:{json.dumps(request_data, sort_keys=True)}"
        return hashlib.sha256(cache_str.encode()).hexdigest()
    
    def get(self, request_type: str, request_data: Dict) -> Optional[Dict]:
        """
        Get cached response if available and valid.
        
        Args:
            request_type: Type of request
            request_data: Request parameters
            
        Returns:
            Cached response or None
        """
        cache_key = self.get_cache_key(request_type, request_data)
        
        conn = sqlite3.connect(str(self.cache_db))
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT response, timestamp, hit_count 
                FROM cache 
                WHERE hash = ?
            """, (cache_key,))
            
            row = cursor.fetchone()
            
            if row:
                response_json, timestamp, hit_count = row
                
                # Check if cache is still valid
                if time.time() - timestamp < self.ttl_seconds:
                    # Update hit count and last accessed
                    cursor.execute("""
                        UPDATE cache 
                        SET hit_count = ?, last_accessed = ?
                        WHERE hash = ?
                    """, (hit_count + 1, time.time(), cache_key))
                    conn.commit()
                    
                    logger.debug(f"Cache hit for {request_type} (hits: {hit_count + 1})")
                    return json.loads(response_json)
                else:
                    # Cache expired, delete it
                    cursor.execute("DELETE FROM cache WHERE hash = ?", (cache_key,))
                    conn.commit()
                    logger.debug(f"Cache expired for {request_type}")
                    
        except Exception as e:
            logger.error(f"Cache retrieval error: {e}")
        finally:
            conn.close()
        
        return None
    
    def set(self, request_type: str, request_data: Dict, 
            response: Dict, cost_estimate: float = 0.01):
        """
        Store response in cache.
        
        Args:
            request_type: Type of request
            request_data: Request parameters
            response: API response to cache
            cost_estimate: Estimated cost of the API call
        """
        cache_key = self.get_cache_key(request_type, request_data)
        
        conn = sqlite3.connect(str(self.cache_db))
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO cache 
                (hash, request_type, request_data, response, 
                 cost_estimate, timestamp, hit_count, last_accessed)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?)
            """, (
                cache_key,
                request_type,
                json.dumps(request_data),
                json.dumps(response),
                cost_estimate,
                time.time(),
                time.time()
            ))
            
            conn.commit()
            logger.debug(f"Cached response for {request_type}")
            
        except Exception as e:
            logger.error(f"Cache storage error: {e}")
        finally:
            conn.close()
    
    def cleanup(self, max_age_days: int = 7):
        """
        Clean up old cache entries.
        
        Args:
            max_age_days: Maximum age in days
        """
        cutoff_time = time.time() - (max_age_days * 86400)
        
        conn = sqlite3.connect(str(self.cache_db))
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                DELETE FROM cache 
                WHERE timestamp < ?
            """, (cutoff_time,))
            
            deleted = cursor.rowcount
            conn.commit()
            
            if deleted > 0:
                logger.info(f"Cleaned up {deleted} expired cache entries")
                
                # Vacuum to reclaim space
                cursor.execute("VACUUM")
                
        except Exception as e:
            logger.error(f"Cache cleanup error: {e}")
        finally:
            conn.close()
    
    def get_stats(self) -> Dict:
        """
        Get cache statistics.
        
        Returns:
            Dict with cache stats
        """
        conn = sqlite3.connect(str(self.cache_db))
        cursor = conn.cursor()
        
        stats = {
            'total_entries': 0,
            'total_hits': 0,
            'total_cost_saved': 0.0,
            'cache_size_mb': 0.0,
            'oldest_entry': None,
            'newest_entry': None
        }
        
        try:
            # Count entries
            cursor.execute("SELECT COUNT(*) FROM cache")
            stats['total_entries'] = cursor.fetchone()[0]
            
            # Sum hits
            cursor.execute("SELECT SUM(hit_count) FROM cache")
            result = cursor.fetchone()[0]
            stats['total_hits'] = result if result else 0
            
            # Calculate cost saved
            cursor.execute("""
                SELECT SUM(hit_count * cost_estimate) 
                FROM cache
            """)
            result = cursor.fetchone()[0]
            stats['total_cost_saved'] = result if result else 0.0
            
            # Get date range
            cursor.execute("""
                SELECT MIN(timestamp), MAX(timestamp) 
                FROM cache
            """)
            row = cursor.fetchone()
            if row and row[0]:
                stats['oldest_entry'] = datetime.fromtimestamp(row[0]).isoformat()
                stats['newest_entry'] = datetime.fromtimestamp(row[1]).isoformat()
            
            # Calculate cache size
            if self.cache_db.exists():
                stats['cache_size_mb'] = self.cache_db.stat().st_size / (1024 * 1024)
                
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
        finally:
            conn.close()
        
        return stats
    
    def clear(self):
        """Clear all cache entries."""
        conn = sqlite3.connect(str(self.cache_db))
        cursor = conn.cursor()
        
        try:
            cursor.execute("DELETE FROM cache")
            conn.commit()
            logger.info("Cache cleared")
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
        finally:
            conn.close()


class SampleDetectionCache:
    """Cache for sample detection results."""
    
    def __init__(self, cache_dir: Optional[Path] = None):
        """Initialize sample detection cache."""
        if cache_dir is None:
            cache_dir = Path.home() / ".music_player_qt" / "cache"
        
        self.cache_file = cache_dir / "sample_detection_cache.json"
        self.cache_file.parent.mkdir(parents=True, exist_ok=True)
        self.cache = self._load_cache()
    
    def _load_cache(self) -> Dict:
        """Load cache from file."""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {}
    
    def save_cache(self):
        """Save cache to file."""
        try:
            with open(self.cache_file, 'w') as f:
                json.dump(self.cache, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving sample cache: {e}")
    
    def get(self, file_hash: str) -> Optional[Dict]:
        """Get cached sample detection results."""
        return self.cache.get(file_hash)
    
    def set(self, file_hash: str, results: Dict):
        """Cache sample detection results."""
        self.cache[file_hash] = {
            'results': results,
            'timestamp': time.time()
        }
        self.save_cache()