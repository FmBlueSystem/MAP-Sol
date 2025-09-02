#!/usr/bin/env python3
"""
Post-build script to organize and rename artifacts after PyInstaller build.
"""

import argparse
import shutil
import sys
from pathlib import Path


def organize_artifacts(os_name: str, version: str):
    """
    Organize build artifacts with consistent naming.
    
    Args:
        os_name: Runner OS from GitHub Actions (Linux, macOS, Windows)
        version: Version tag (e.g., v1.0.0)
    """
    packaging_dir = Path(__file__).parent.parent
    dist_dir = packaging_dir / 'dist'
    
    if not dist_dir.exists():
        print(f"Warning: dist directory not found at {dist_dir}")
        return False
    
    # Map OS names to expected artifacts
    artifacts = {
        'macOS': {
            'source': dist_dir / 'MusicAnalyzerPro.app',
            'type': 'app'
        },
        'Linux': {
            'source': dist_dir / 'MusicAnalyzerPro',
            'type': 'dir'
        },
        'Windows': {
            'source': dist_dir / 'MusicAnalyzerPro.exe',
            'type': 'exe'
        }
    }
    
    if os_name not in artifacts:
        print(f"Unknown OS: {os_name}")
        return False
    
    artifact = artifacts[os_name]
    source = artifact['source']
    
    if not source.exists():
        print(f"Artifact not found: {source}")
        # Try alternative locations
        if os_name == 'Windows':
            # Windows might create in dist/ directly
            alt_source = dist_dir / 'MusicAnalyzerPro' / 'MusicAnalyzerPro.exe'
            if alt_source.exists():
                source = alt_source
                print(f"Found artifact at: {source}")
            else:
                return False
        else:
            return False
    
    # Create versioned name
    clean_version = version.lstrip('v')
    
    # Add README and LICENSE to dist if they exist
    project_root = packaging_dir.parent
    for file in ['README.md', 'LICENSE']:
        src_file = project_root / file
        if src_file.exists():
            dst_file = dist_dir / file
            shutil.copy2(src_file, dst_file)
            print(f"Copied {file} to dist/")
    
    print(f"✓ Artifacts organized for {os_name} version {version}")
    print(f"  Source: {source}")
    print(f"  Type: {artifact['type']}")
    
    return True


def main():
    parser = argparse.ArgumentParser(description='Post-build artifact processing')
    parser.add_argument('--os', required=True, help='Operating system (Linux, macOS, Windows)')
    parser.add_argument('--version', required=True, help='Version tag (e.g., v1.0.0)')
    
    args = parser.parse_args()
    
    success = organize_artifacts(args.os, args.version)
    
    if not success:
        print("Warning: Post-build processing encountered issues")
        # Don't fail the build for post-processing issues
        sys.exit(0)
    
    sys.exit(0)


if __name__ == '__main__':
    main()