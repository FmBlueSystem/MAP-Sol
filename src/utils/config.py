#!/usr/bin/env python3
"""
Lightweight YAML-based configuration loader with sane defaults and env override.
Usage:
    from utils.config import get_config
    cfg = get_config()
    max_conc = cfg['analysis']['max_concurrent']
"""

from __future__ import annotations
from pathlib import Path
import os
try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


_DEFAULTS = {
    'database': {
        'busy_timeout_ms': 3000,
    },
    'analysis': {
        'max_concurrent': 2,
        'timeout_per_track': 30,
        'use_mixedinkey_first': True,
    },
    'ui': {
        'grid_page_size': 40,
        'toasts_enabled': True,
        'toast_timeout_ms': 2500,
    },
    'telemetry': {
        'enabled': False,  # Opt-in by default OFF
        'log_path': '~/.music_player_qt/telemetry.jsonl',
    },
}

_AI_DEFAULTS = {
    'ai_analysis': {
        'enabled': True,
        'models_path': './models',
        'cache_results': True,
        'max_parallel': 2,
        'genre_classification': {
            'model': 'genre_model_v1.pkl',
            'confidence_threshold': 0.7,
        },
        'mood_analysis': {
            'energy_buckets': 10,
        },
        'lyrics_analysis': {
            'enabled': True,
            'import_lrc': True,
            'show_in_ui': False,
        },
    },
    'playlist_generation': {
        'default_duration': 60,
        'default_type': 'hybrid',
        'harmonic_weight': 0.6,
        'ai_weight': 0.4,
        'templates': ['warm_up', 'peak_time', 'closing'],
        'export_formats': ['m3u', 'serato_db'],
    },
    'serato_export': {
        'enabled': True,
        'root_path': {
            'macos': '~/Music/Serato',
            'windows': '%USERPROFILE%/Music/Serato',
        },
        'crate_name': 'MusicAnalyzerPro',
        'write_database_v2': True,
        'create_crates': True,
        'write_file_tags': False,
    },
}


def _deep_merge(a: dict, b: dict) -> dict:
    out = dict(a)
    for k, v in b.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def get_config() -> dict:
    cfg = dict(_DEFAULTS)
    # Load from CONFIG_PATH or common locations
    candidates = []
    env_path = os.environ.get('CONFIG_PATH')
    if env_path:
        candidates.append(Path(env_path))
    candidates.append(Path.cwd() / 'config.yaml')
    candidates.append(Path.home() / '.music_player_qt' / 'config.yaml')

    if HAS_YAML:
        for p in candidates:
            try:
                if p.exists():
                    with p.open('r', encoding='utf-8') as f:
                        data = yaml.safe_load(f) or {}
                        if isinstance(data, dict):
                            cfg = _deep_merge(cfg, data)
                            break
            except Exception:
                pass

    # Env overrides (flat)
    cfg['analysis']['max_concurrent'] = int(os.environ.get('ANALYSIS_MAX_CONCURRENT', cfg['analysis']['max_concurrent']))
    cfg['database']['busy_timeout_ms'] = int(os.environ.get('DB_BUSY_TIMEOUT_MS', cfg['database']['busy_timeout_ms']))
    cfg['ui']['grid_page_size'] = int(os.environ.get('UI_GRID_PAGE_SIZE', cfg['ui']['grid_page_size']))
    # Optional envs for toasts
    te = os.environ.get('UI_TOASTS_ENABLED')
    if te is not None:
        cfg['ui']['toasts_enabled'] = te.lower() in ('1', 'true', 'yes', 'on')
    cfg['ui']['toast_timeout_ms'] = int(os.environ.get('UI_TOAST_TIMEOUT_MS', cfg['ui']['toast_timeout_ms']))
    return cfg


def get_ai_config() -> dict:
    """Load AI and playlist generation configuration with defaults and env overrides."""
    cfg = dict(_AI_DEFAULTS)
    
    # Load from CONFIG_AI_PATH or common locations
    candidates = []
    env_path = os.environ.get('CONFIG_AI_PATH')
    if env_path:
        candidates.append(Path(env_path))
    candidates.append(Path.cwd() / 'config_ai.yaml')
    candidates.append(Path.home() / '.music_player_qt' / 'config_ai.yaml')
    
    if HAS_YAML:
        for p in candidates:
            try:
                if p.exists():
                    with p.open('r', encoding='utf-8') as f:
                        data = yaml.safe_load(f) or {}
                        if isinstance(data, dict):
                            cfg = _deep_merge(cfg, data)
                            break
            except Exception:
                pass
    
    # Environment variable overrides
    # AI Analysis overrides
    if 'AI_MAX_PARALLEL' in os.environ:
        cfg['ai_analysis']['max_parallel'] = int(os.environ['AI_MAX_PARALLEL'])
    if 'AI_CACHE_RESULTS' in os.environ:
        cfg['ai_analysis']['cache_results'] = os.environ['AI_CACHE_RESULTS'].lower() in ('1', 'true', 'yes', 'on')
    if 'AI_MODELS_PATH' in os.environ:
        cfg['ai_analysis']['models_path'] = os.environ['AI_MODELS_PATH']
    
    # Playlist Generation overrides
    if 'PL_GEN_DEFAULT_TYPE' in os.environ:
        cfg['playlist_generation']['default_type'] = os.environ['PL_GEN_DEFAULT_TYPE']
    if 'PL_HARMONIC_WEIGHT' in os.environ:
        cfg['playlist_generation']['harmonic_weight'] = float(os.environ['PL_HARMONIC_WEIGHT'])
    if 'PL_AI_WEIGHT' in os.environ:
        cfg['playlist_generation']['ai_weight'] = float(os.environ['PL_AI_WEIGHT'])
    
    # Serato Export overrides
    if 'SERATO_ENABLED' in os.environ:
        cfg['serato_export']['enabled'] = os.environ['SERATO_ENABLED'].lower() in ('1', 'true', 'yes', 'on')
    if 'SERATO_ROOT_MACOS' in os.environ:
        cfg['serato_export']['root_path']['macos'] = os.environ['SERATO_ROOT_MACOS']
    if 'SERATO_ROOT_WINDOWS' in os.environ:
        cfg['serato_export']['root_path']['windows'] = os.environ['SERATO_ROOT_WINDOWS']
    if 'SERATO_CRATE_NAME' in os.environ:
        cfg['serato_export']['crate_name'] = os.environ['SERATO_CRATE_NAME']
    
    return cfg


def save_config(cfg: dict, path: Path | None = None) -> bool:
    """Persist configuration to YAML.

    If path is None, prefer project root `config.yaml` if present; else write to `~/.music_player_qt/config.yaml`.
    Returns True on success.
    """
    try:
        target: Path
        if path is not None:
            target = Path(path)
        else:
            root = Path.cwd() / 'config.yaml'
            target = root if root.exists() else (Path.home() / '.music_player_qt' / 'config.yaml')
            target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('w', encoding='utf-8') as f:
            yaml.safe_dump(cfg, f, sort_keys=False, allow_unicode=True)
        return True
    except Exception:
        return False


def save_ai_config(cfg: dict, path: Path | None = None) -> bool:
    """Persist AI configuration to YAML.

    If path is None, prefer project root `config_ai.yaml` if present; else write to `~/.music_player_qt/config_ai.yaml`.
    Returns True on success.
    """
    if not HAS_YAML:
        return False
    
    try:
        target: Path
        if path is not None:
            target = Path(path)
        else:
            root = Path.cwd() / 'config_ai.yaml'
            target = root if root.exists() else (Path.home() / '.music_player_qt' / 'config_ai.yaml')
            target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('w', encoding='utf-8') as f:
            yaml.safe_dump(cfg, f, sort_keys=False, allow_unicode=True)
        return True
    except Exception:
        return False
