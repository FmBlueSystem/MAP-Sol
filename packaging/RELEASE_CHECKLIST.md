# Release Checklist

## Pre-Release Verification

### Version Updates
- [ ] Update version in `src/app.py` (`app_version` variable)
- [ ] Update version in `packaging/MusicAnalyzerPro.spec` (Info.plist CFBundleVersion)
- [ ] Update version in `packaging/MusicAnalyzerPro_win.spec` (if applicable)
- [ ] Update CHANGELOG.md with release notes

### Code Quality
- [ ] All tests passing locally (`PYTHONPATH=src pytest -q`)
- [ ] No linting errors (if linter configured)
- [ ] All TODOs and FIXMEs addressed or documented

### Feature Testing
- [ ] **Import/Export Functions**
  - [ ] CSV playlist export works
  - [ ] JSON playlist export works
  - [ ] Share links generate correctly (base64url)
  - [ ] Import from CSV/JSON works

- [ ] **Analytics Dashboard**
  - [ ] All charts render correctly
  - [ ] BPM distribution shows data
  - [ ] Camelot key wheel displays
  - [ ] Energy levels visualize properly
  - [ ] Genre/mood distributions work

- [ ] **Musical Structure Detection**
  - [ ] Structure analysis runs without errors
  - [ ] Segments detected (intro/verse/chorus)
  - [ ] Mix points identified
  - [ ] UI timeline displays correctly
  - [ ] Data persists to database

- [ ] **Telemetry System**
  - [ ] Opt-in toggle works
  - [ ] Events log to JSONL when enabled
  - [ ] Export function creates valid file
  - [ ] No data collected when disabled

### Clean Install Test
- [ ] Delete existing config files
- [ ] Remove database (`~/Library/Application Support/MusicAnalyzerPro/` on macOS)
- [ ] Fresh install creates default config
- [ ] First-run experience works correctly
- [ ] Database initializes with proper schema

### Resource Verification
- [ ] Icons present in `resources/` directory
- [ ] Config examples included (`config.example.yaml`)
- [ ] All required fonts/assets bundled
- [ ] PyInstaller spec includes all data files

### Platform-Specific Testing

#### macOS
- [ ] App launches without security warnings (if signed)
- [ ] Menu bar integrates correctly
- [ ] Dock icon displays
- [ ] File associations work (if configured)

#### Windows
- [ ] No console window appears
- [ ] Windows Defender doesn't flag as malware
- [ ] Installer creates proper shortcuts (if using installer)
- [ ] Registry entries correct (if applicable)

#### Linux
- [ ] Desktop entry works
- [ ] Icon displays in application menu
- [ ] Audio system detection works (ALSA/PulseAudio)
- [ ] AppImage runs on different distros (if created)

### Build Verification
- [ ] PyInstaller build completes without errors
- [ ] All hidden imports included
- [ ] Binary size reasonable (<200MB)
- [ ] No missing module errors at runtime

### Performance Checks
- [ ] Application starts in <5 seconds
- [ ] Memory usage stable (<500MB for typical library)
- [ ] No memory leaks during extended use
- [ ] Audio analysis performs acceptably

## Release Process

1. **Create Release Branch**
   ```bash
   git checkout -b release/v1.0.0
   ```

2. **Run Full Test Suite**
   ```bash
   PYTHONPATH=src pytest
   ```

3. **Build Test Binaries**
   ```bash
   cd packaging
   pyinstaller --clean -y MusicAnalyzerPro.spec
   ```

4. **Test Binaries**
   - Run on clean system/VM
   - Test all major features
   - Verify no crashes

5. **Tag Release**
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

6. **Monitor CI/CD**
   - Check GitHub Actions workflows
   - Verify artifacts upload correctly
   - Ensure all OS builds succeed

7. **Create GitHub Release**
   - Draft release notes from CHANGELOG
   - Attach built artifacts
   - Mark as pre-release if beta
   - Publish when ready

## Post-Release

- [ ] Announce release (if applicable)
- [ ] Update documentation/website
- [ ] Monitor issue tracker for problems
- [ ] Plan next version features

## Rollback Plan

If critical issues found:
1. Delete GitHub release (keep tag for history)
2. Fix issues in hotfix branch
3. Create new patch version (e.g., v1.0.1)
4. Re-run release process

---

**Remember:** A good release is better than a fast release. Take time to verify everything works correctly.