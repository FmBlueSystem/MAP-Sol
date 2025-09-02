#!/usr/bin/env python3
"""
Run lightweight AI analysis over tracks missing entries in `ai_analysis`.

Usage:
  PYTHONPATH=src python scripts/run_ai_analysis.py [--db path/to.db] [--limit N] [--workers 2]
"""

import argparse
from pathlib import Path

from ai_analysis import AIAnalysisProcessor


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", type=Path, default=Path.home() / ".music_player_qt" / "music_library.db")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--workers", type=int, default=2)
    args = ap.parse_args()

    proc = AIAnalysisProcessor(db_path=str(args.db), max_parallel=args.workers)
    n = proc.process_missing(limit=args.limit)
    print(f"AI analysis completed: {n} tracks processed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

