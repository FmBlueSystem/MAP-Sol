# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Application code. Key modules: `main.py` (entry point with splash), `app.py` (analyzer UI), `music_player.py` (player UI), `database.py`, `audio_analyzer*.py`, `hamms_analyzer.py`, `utils/logger.py`.
- `resources/`: Icons, fonts, and images.
- Tests: Currently live as top-level `test_*.py` scripts in the repo root. New tests may also be placed in a `tests/` folder using the same naming pattern.

## Build, Test, and Development Commands
- Setup environment:
  - `python3 -m venv venv && source venv/bin/activate`
  - `pip install -r requirements.txt`
- Run the app (Qt):
  - `python src/main.py`  (Music Analyzer Pro UI)
  - `python src/music_player.py`  (Tidal-style player UI)
- Run tests (pytest discovery):
  - `PYTHONPATH=src pytest -q`
  - Example subset: `PYTHONPATH=src pytest -k hamms -q`
- Optional packaging:
  - `pyinstaller --noconsole --name MusicAnalyzerPro src/main.py`

## Coding Style & Naming Conventions
- Indentation: 4 spaces, UTF-8 files, Unix newlines.
- Naming: `snake_case` for modules/functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants.
- Imports: Prefer absolute imports within `src` (set `PYTHONPATH=src` for scripts/tests rather than mutating `sys.path`).
- Docstrings: Triple-quoted, concise purpose + args/returns where useful.

## Testing Guidelines
- Framework: `pytest` (see `requirements.txt`). Tests named `test_*.py`.
- Prefer assertions over print-only scripts. Avoid hardcoded absolute paths; use fixtures and sample assets under `resources/`.
- Quick run: `PYTHONPATH=src pytest --maxfail=1 -q`. Add focused runs with `-k` selectors.

## Commit & Pull Request Guidelines
- Commits: Imperative present tense (“Add analyzer for MIK”), small, focused. Group related changes; reference issues with `#ID` when applicable.
- PRs: Clear description, rationale, and scope. Include:
  - Steps to reproduce/verify, screenshots or short clips for UI changes.
  - Linked issues, notes on migrations/config changes.
  - Check that app runs (`python src/main.py`) and tests pass.

## Security & Configuration Tips
- Config: `.env` supported via `python-dotenv` (do not commit). Example run: `ENV=dev PYTHONPATH=src python src/main.py`.
- OS deps: PyQt6 requires a GUI environment; some test utilities use `ffprobe/ffmpeg`—install if needed.
