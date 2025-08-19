#!/bin/bash

# Script para iniciar MAP sin cache

echo "🧹 Limpiando cache de Electron..."

# Matar procesos existentes
pkill -9 -f electron 2>/dev/null
pkill -9 -f MAP 2>/dev/null

# Limpiar cache de Electron
rm -rf ~/Library/Application\ Support/Electron/Cache/* 2>/dev/null
rm -rf ~/Library/Application\ Support/MAP/Cache/* 2>/dev/null
rm -rf ~/Library/Application\ Support/map-music-analyzer/Cache/* 2>/dev/null

echo "🚀 Iniciando MAP..."

# Iniciar la aplicación
npm start