"""
Local opt-in telemetry system for non-sensitive event tracking.

This module tracks only non-sensitive application events to improve the product.
No personal data, full file paths, or metadata is collected.
All data is stored locally and never sent over the network.
Telemetry is OPT-IN and disabled by default.

Events tracked (when enabled):
- app_start/quit
- analyze_ai_started/completed (count, duration)
- loudness_batch_completed (count)
- playlist_generated (type, count, duration)
- playlist_saved (name, track count)
- share_link_copied (length, item count)
"""

import json
import uuid
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, Any
import sys


class Telemetry:
    """Local opt-in telemetry system."""
    
    # Singleton instance
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, enabled: bool = False, log_path: Optional[Path] = None, 
                 app_version: str = "1.0.0"):
        """
        Initialize telemetry system.
        
        Args:
            enabled: Whether telemetry is enabled (default: False)
            log_path: Path to telemetry log file
            app_version: Application version string
        """
        # Only initialize once
        if hasattr(self, '_initialized'):
            return
        
        self._initialized = True
        self._enabled = enabled
        self.log_path = log_path or Path.home() / '.music_player_qt' / 'telemetry.jsonl'
        self.session_id = str(uuid.uuid4())
        self.app_version = app_version
        
        # Ensure directory exists if enabled
        if self._enabled:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
    
    def enable(self):
        """Enable telemetry logging."""
        self._enabled = True
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
    
    def disable(self):
        """Disable telemetry logging."""
        self._enabled = False
    
    def is_enabled(self) -> bool:
        """Check if telemetry is enabled."""
        return self._enabled
    
    def track(self, event: str, props: Optional[Dict[str, Any]] = None):
        """
        Track an event with optional properties.
        
        Args:
            event: Event name (e.g., 'app_start', 'playlist_generated')
            props: Optional properties dict (will be sanitized)
        """
        if not self._enabled:
            return
        
        try:
            # Sanitize properties
            sanitized_props = self.sanitize(props) if props else {}
            
            # Build event record
            record = {
                'timestamp': datetime.utcnow().isoformat(),
                'event': event,
                'props': sanitized_props,
                'session_id': self.session_id,
                'app_version': self.app_version
            }
            
            # Write to JSONL file
            with open(self.log_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps(record, separators=(',', ':')) + '\n')
                
        except Exception as e:
            # Silent failure - don't break UX
            if '--debug' in sys.argv:
                print(f"Telemetry error: {e}", file=sys.stderr)
    
    def sanitize(self, props: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize properties to remove sensitive data.
        
        - Remove full file paths (keep only filename/suffix)
        - Remove any potential PII
        - Keep only allowed data types
        
        Args:
            props: Properties to sanitize
            
        Returns:
            Sanitized properties dict
        """
        sanitized = {}
        
        for key, value in props.items():
            # Skip None values
            if value is None:
                continue
            
            # Handle different value types
            if isinstance(value, (int, float, bool)):
                # Numbers and booleans are safe
                sanitized[key] = value
                
            elif isinstance(value, str):
                # Check if it looks like a path
                if '/' in value or '\\' in value:
                    # Extract only filename or suffix
                    path = Path(value)
                    if path.suffix:
                        sanitized[key + '_suffix'] = path.suffix
                    else:
                        sanitized[key + '_name'] = path.name
                else:
                    # Regular string - truncate if too long
                    sanitized[key] = value[:100] if len(value) > 100 else value
                    
            elif isinstance(value, (list, tuple)):
                # Only keep length for lists
                sanitized[key + '_count'] = len(value)
                
            elif isinstance(value, dict):
                # Recursively sanitize nested dicts (shallow)
                if len(value) < 10:  # Limit nesting
                    sanitized[key] = self.sanitize(value)
                else:
                    sanitized[key + '_keys'] = len(value)
        
        return sanitized
    
    def flush(self):
        """Flush any pending writes (no-op for JSONL)."""
        pass  # JSONL writes are immediate
    
    def export(self, path: Path):
        """
        Export telemetry data to a consolidated JSON file.
        
        Args:
            path: Path for exported JSON file
        """
        try:
            path = Path(path)
            
            if not self.log_path.exists():
                # No telemetry data to export
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump({'events': [], 'exported_at': datetime.utcnow().isoformat()}, f, indent=2)
                return
            
            # Read all JSONL events
            events = []
            with open(self.log_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            events.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass  # Skip malformed lines
            
            # Create export structure
            export_data = {
                'exported_at': datetime.utcnow().isoformat(),
                'app_version': self.app_version,
                'total_events': len(events),
                'events': events
            }
            
            # Write consolidated JSON
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)
                
        except Exception as e:
            # Silent failure
            if '--debug' in sys.argv:
                print(f"Telemetry export error: {e}", file=sys.stderr)
    
    def clear(self):
        """Clear telemetry log (for privacy/testing)."""
        try:
            if self.log_path.exists():
                self.log_path.unlink()
        except Exception:
            pass


# Global singleton instance
_telemetry = None


def get_telemetry() -> Telemetry:
    """Get the global telemetry instance."""
    global _telemetry
    if _telemetry is None:
        _telemetry = Telemetry()
    return _telemetry


def init_telemetry(enabled: bool = False, log_path: Optional[Path] = None, 
                   app_version: str = "1.0.0"):
    """
    Initialize the global telemetry instance.
    
    Args:
        enabled: Whether telemetry is enabled
        log_path: Path to telemetry log file
        app_version: Application version string
    """
    global _telemetry
    _telemetry = Telemetry(enabled=enabled, log_path=log_path, app_version=app_version)
    return _telemetry