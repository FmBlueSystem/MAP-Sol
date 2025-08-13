#!/bin/bash

# Agregar el remote origin (reemplaza con tu URL cuando crees el repo)
git remote add origin https://github.com/FmBlueSystem/MAP-Sol.git

# Verificar el remote
git remote -v

# Push al repositorio
git push -u origin main

echo "✅ Código subido a GitHub!"
echo "📍 URL: https://github.com/FmBlueSystem/MAP-Sol"
