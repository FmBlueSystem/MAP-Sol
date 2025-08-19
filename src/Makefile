# Makefile for Essentia Audio Analyzer
# Requiere: Essentia, FFTW3, SQLite3, libavcodec

CXX = g++
CXXFLAGS = -std=c++17 -O3 -Wall -pthread
INCLUDES = -I/usr/local/include
LIBS = -L/usr/local/lib -lessentia -lfftw3 -lsqlite3 -lavcodec -lavformat -lavutil -lsamplerate -ltag -lchromaprint -lyaml-cpp

# Targets
all: audio-analyzer audio-analyzer-context batch-analyzer

audio-analyzer: audio-analyzer.cpp
	$(CXX) $(CXXFLAGS) $(INCLUDES) $< -o $@ $(LIBS)

audio-analyzer-context: audio-analyzer-with-context.cpp
	$(CXX) $(CXXFLAGS) $(INCLUDES) $< -o $@ $(LIBS)

batch-analyzer: batch-analyzer.cpp
	$(CXX) $(CXXFLAGS) $(INCLUDES) $< -o $@ $(LIBS)

# Install Essentia on macOS
install-essentia:
	brew tap MTG/essentia
	brew install essentia --with-examples

# Install dependencies
install-deps:
	brew install fftw sqlite libsamplerate libyaml taglib chromaprint

clean:
	rm -f audio-analyzer batch-analyzer

# Test single file
test:
	./audio-analyzer test.mp3

# Process entire database
process-all:
	./batch-analyzer music_analyzer.db 8

.PHONY: all clean install-essentia install-deps test process-all