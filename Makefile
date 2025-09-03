.PHONY: help install install-dev clean test coverage lint format type-check run build docs

# Variables
PYTHON := python3
PIP := $(PYTHON) -m pip
PYTEST := $(PYTHON) -m pytest
BLACK := $(PYTHON) -m black
RUFF := $(PYTHON) -m ruff
MYPY := $(PYTHON) -m mypy
SRC_DIR := src
TEST_DIR := tests
DOCS_DIR := docs

# Default target
help:
	@echo "Music Analyzer Pro - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install       Install production dependencies"
	@echo "  make install-dev   Install development dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make run          Run the main application"
	@echo "  make run-cli      Run the CLI analyzer"
	@echo "  make test         Run all tests"
	@echo "  make coverage     Run tests with coverage report"
	@echo "  make lint         Run linting checks"
	@echo "  make format       Format code with black"
	@echo "  make type-check   Run type checking with mypy"
	@echo "  make check-all    Run all quality checks"
	@echo ""
	@echo "Build & Deploy:"
	@echo "  make build        Build standalone application"
	@echo "  make docs         Generate documentation"
	@echo "  make clean        Clean build artifacts"
	@echo ""
	@echo "Git:"
	@echo "  make pre-commit   Install pre-commit hooks"

# Installation
install:
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

install-dev: install
	$(PIP) install -r requirements-dev.txt
	$(PIP) install -r requirements-ia.txt
	$(PIP) install -e .

# Running
run:
	$(PYTHON) src/music_player.py

run-cli:
	$(PYTHON) src/app.py

# Testing
test:
	$(PYTEST) $(TEST_DIR) -v

test-unit:
	$(PYTEST) $(TEST_DIR) -v -m unit

test-integration:
	$(PYTEST) $(TEST_DIR) -v -m integration

coverage:
	$(PYTEST) $(TEST_DIR) --cov=$(SRC_DIR) --cov-report=html --cov-report=term

# Code Quality
lint:
	$(RUFF) check $(SRC_DIR)
	$(RUFF) check $(TEST_DIR)

format:
	$(BLACK) $(SRC_DIR) --line-length 120
	$(BLACK) $(TEST_DIR) --line-length 120
	$(BLACK) *.py --line-length 120

format-check:
	$(BLACK) $(SRC_DIR) --check --line-length 120
	$(BLACK) $(TEST_DIR) --check --line-length 120

type-check:
	$(MYPY) $(SRC_DIR)

check-all: lint format-check type-check test

# Pre-commit
pre-commit:
	pre-commit install
	pre-commit run --all-files

# Building
build:
	cd packaging && $(PYTHON) build.py --platform macos

build-all:
	cd packaging && $(PYTHON) build.py --platform macos
	cd packaging && $(PYTHON) build.py --platform windows
	cd packaging && $(PYTHON) build.py --platform linux

# Documentation
docs:
	cd $(DOCS_DIR) && sphinx-build -b html . _build/html

docs-serve:
	cd $(DOCS_DIR)/_build/html && $(PYTHON) -m http.server

# Cleaning
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
	find . -type f -name ".coverage" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	rm -rf build/ dist/ packaging/dist/ packaging/build/

clean-all: clean
	rm -rf venv/ .venv/
	rm -f *.db *.log

# Database
db-reset:
	rm -f music_library.db
	$(PYTHON) -c "from src.database import Database; Database().initialize()"

# Dependencies
deps-update:
	$(PIP) list --outdated
	$(PIP) install --upgrade pip setuptools wheel

deps-freeze:
	$(PIP) freeze > requirements-freeze.txt

# Development shortcuts
dev: format lint type-check test

quick: format test

# CI/CD simulation
ci:
	@echo "Running CI pipeline simulation..."
	make clean
	make install-dev
	make check-all
	make build
	@echo "CI pipeline complete!"