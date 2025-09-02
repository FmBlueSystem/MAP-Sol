#!/usr/bin/env python3
"""
Logging configuration for Music Analyzer Pro
"""

import sys
import logging
from pathlib import Path
import os
from logging.handlers import RotatingFileHandler


def setup_logger(name, level=logging.INFO):
    """
    Set up a logger with console and file handlers
    
    Args:
        name: Logger name
        level: Logging level
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Remove existing handlers
    logger.handlers = []
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    
    # Format
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(formatter)
    
    # Add handler
    logger.addHandler(console_handler)
    
    # Create logs directory if it doesn't exist (prefer HOME; fallback to CWD in sandbox/tests)
    log_dir = None
    try:
        env_dir = os.environ.get('LOG_DIR')
        if env_dir:
            log_dir = Path(env_dir)
        else:
            log_dir = Path.home() / '.music_player_qt' / 'logs'
        log_dir.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            log_dir / 'app.log',
            maxBytes=10485760,
            backupCount=5
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception:
        # Fallback to workspace-local logs directory
        try:
            log_dir = Path.cwd() / '.logs'
            log_dir.mkdir(parents=True, exist_ok=True)
            file_handler = RotatingFileHandler(
                log_dir / 'app.log',
                maxBytes=10485760,
                backupCount=5
            )
            file_handler.setLevel(level)
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
        except Exception:
            # If file logging is unavailable, continue with console-only
            pass
    
    return logger
