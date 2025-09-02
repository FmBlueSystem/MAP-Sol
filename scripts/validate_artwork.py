#!/usr/bin/env python3
"""
Validate artwork extraction for audio files.

Usage:
  python scripts/validate_artwork.py /path/to/folder [--update-db]

Scans audio files, tries embedded → external → fallback artwork.
Summarizes results and (optionally) writes fallback to DB for missing.
"""

import argparse
from pathlib import Path
from typing import List

from metadata_extractor import MetadataExtractor
from database import MusicDatabase

SUPPORTED = {'.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma', '.opus'}


def iter_audio_files(root: Path) -> List[Path]:
    if root.is_file():
        return [root]
    files = []
    for p in root.rglob('*'):
        if p.is_file() and p.suffix.lower() in SUPPORTED:
            files.append(p)
    return files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('path', type=Path, help='Audio file or folder')
    ap.add_argument('--update-db', action='store_true', help='Write fallback artwork to DB if missing')
    args = ap.parse_args()

    files = iter_audio_files(args.path)
    if not files:
        print('No audio files found')
        return 1

    db = MusicDatabase()

    emb, ext, fb, none = 0, 0, 0, 0
    for f in files:
        md = MetadataExtractor.extract_metadata(str(f), with_pixmap=False)
        if md.get('artwork_data'):
            emb += 1
            continue

        # Try external only
        ext_bytes = MetadataExtractor._find_external_artwork(str(f))
        if ext_bytes:
            ext += 1
            continue

        # Try fallback
        fb_bytes = MetadataExtractor._fallback_artwork_bytes()
        if fb_bytes:
            fb += 1
            if args.update_db:
                db.update_track_artwork(str(f), artwork_data=fb_bytes)
        else:
            none += 1

    db.close()

    total = len(files)
    print(f"Scanned: {total}")
    print(f"  Embedded: {emb}")
    print(f"  External: {ext}")
    print(f"  Fallback: {fb}")
    print(f"  Missing: {none}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

