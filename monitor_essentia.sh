#!/bin/bash

# Script para monitorear el progreso del procesamiento con Essentia

echo "📊 MONITOR DE PROCESAMIENTO ESSENTIA"
echo "===================================="

while true; do
    # Contar archivos procesados
    PROCESSED=$(ls essentia_results/*_essentia.json 2>/dev/null | wc -l | tr -d ' ')
    
    # Total esperado
    TOTAL=3808
    
    # Calcular porcentaje
    if [ $PROCESSED -gt 0 ]; then
        PERCENTAGE=$(echo "scale=2; $PROCESSED * 100 / $TOTAL" | bc)
    else
        PERCENTAGE=0
    fi
    
    # Mostrar progreso
    echo -ne "\r📁 Procesados: $PROCESSED / $TOTAL ($PERCENTAGE%) "
    
    # Si llegamos al total, salir
    if [ $PROCESSED -eq $TOTAL ]; then
        echo ""
        echo "✅ Procesamiento completado!"
        break
    fi
    
    # Verificar si el proceso sigue corriendo
    if ! pgrep -f "process_all_essentia.py" > /dev/null; then
        echo ""
        echo "⚠️ Proceso detenido o finalizado"
        echo "📊 Total procesados: $PROCESSED"
        break
    fi
    
    # Esperar 5 segundos antes de actualizar
    sleep 5
done

# Mostrar estadísticas finales
echo ""
echo "📊 ESTADÍSTICAS FINALES:"
echo "• Archivos procesados: $PROCESSED"
echo "• Archivos restantes: $((TOTAL - PROCESSED))"

# Verificar archivos con errores
if [ -f essentia_results/essentia_batch_report_*.json ]; then
    echo ""
    echo "📝 Reportes disponibles:"
    ls -lh essentia_results/essentia_batch_report_*.json
fi