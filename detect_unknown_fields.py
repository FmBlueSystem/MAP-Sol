#!/usr/bin/env python3
"""
Script para detectar y reportar campos marcados como desconocidos o no determinados
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

def detect_unknown_fields(analysis: Dict) -> Tuple[List[str], int]:
    """
    Detecta todos los campos marcados como desconocidos o no determinados
    
    Returns:
        Tuple de (lista de campos problemáticos, total de problemas)
    """
    
    problems = []
    
    # Valores que indican problema
    problem_strings = [
        'Desconocido', 'Desconocida', 'desconocido',
        'No Determinado', 'no_determinado', 
        'Sin Clasificar', 'sin_contexto',
        'No Analizado', 'no_analizado',
        'No se pudo'
    ]
    
    problem_numbers = [-1.0, -999.0, 0.0]  # 0.0 para confidence
    
    def check_value(key: str, value, path: str = ""):
        """Revisa recursivamente valores problemáticos"""
        full_path = f"{path}.{key}" if path else key
        
        # Strings problemáticos
        if isinstance(value, str):
            for problem in problem_strings:
                if problem in value:
                    problems.append(f"📍 {full_path} = '{value}'")
                    break
        
        # Números problemáticos
        elif isinstance(value, (int, float)):
            if value in problem_numbers:
                # Confidence 0.0 es especial
                if key == 'confidence' and value == 0.0:
                    problems.append(f"⚠️ {full_path} = {value} (falla total)")
                elif value == -1.0:
                    problems.append(f"❌ {full_path} = {value} (no determinado)")
                elif value == -999.0:
                    problems.append(f"❌ {full_path} = {value} (no analizado)")
        
        # Listas con valores problemáticos
        elif isinstance(value, list):
            if len(value) > 0 and isinstance(value[0], str):
                for item in value:
                    if isinstance(item, str):
                        for problem in problem_strings:
                            if problem in item:
                                problems.append(f"📍 {full_path}[] contiene '{item}'")
                                break
        
        # Diccionarios - revisar recursivamente
        elif isinstance(value, dict):
            for k, v in value.items():
                check_value(k, v, full_path)
    
    # Revisar todos los campos
    for key, value in analysis.items():
        check_value(key, value)
    
    return problems, len(problems)

def analyze_result_file(file_path: str):
    """Analiza un archivo de resultado y reporta campos desconocidos"""
    
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        print(f"\n{'='*80}")
        print(f"🔍 ANÁLISIS DE CAMPOS DESCONOCIDOS")
        print(f"{'='*80}")
        print(f"Archivo: {Path(file_path).name}")
        
        # Información básica
        if 'original_metadata' in data:
            meta = data['original_metadata']
            print(f"\n📀 Track:")
            print(f"  • Artista: {meta.get('artist', 'N/A')}")
            print(f"  • Título: {meta.get('title', 'N/A')}")
            print(f"  • Año: {meta.get('year', 'N/A')}")
        
        # Analizar GPT-4 analysis
        if 'gpt4_analysis' not in data:
            print("\n❌ No se encontró análisis de GPT-4")
            return
        
        analysis = data['gpt4_analysis']
        problems, total = detect_unknown_fields(analysis)
        
        if total == 0:
            print(f"\n✅ PERFECTO: Todos los campos fueron determinados correctamente")
            print(f"  • Género: {analysis.get('genre')}")
            print(f"  • Mood: {analysis.get('mood')}")
            print(f"  • Confianza: {analysis.get('confidence', 0):.2f}")
        else:
            print(f"\n⚠️ SE ENCONTRARON {total} CAMPOS NO DETERMINADOS:\n")
            
            # Agrupar por tipo
            critical = [p for p in problems if p.startswith('❌')]
            warnings = [p for p in problems if p.startswith('⚠️')]
            info = [p for p in problems if p.startswith('📍')]
            
            if critical:
                print(f"🔴 CRÍTICOS ({len(critical)}):")
                for p in critical[:10]:
                    print(f"  {p}")
                if len(critical) > 10:
                    print(f"  ... y {len(critical)-10} más")
            
            if warnings:
                print(f"\n🟡 ADVERTENCIAS ({len(warnings)}):")
                for p in warnings[:5]:
                    print(f"  {p}")
            
            if info:
                print(f"\n🔵 INFORMACIÓN ({len(info)}):")
                for p in info[:5]:
                    print(f"  {p}")
            
            # Resumen de impacto
            print(f"\n📊 IMPACTO EN EL ANÁLISIS:")
            
            # Verificar campos críticos
            critical_fields = ['genre', 'mood', 'era', 'subgenres']
            critical_unknown = []
            
            for field in critical_fields:
                value = analysis.get(field)
                if value and any(p in str(value) for p in ['Desconocido', 'No Determinado']):
                    critical_unknown.append(field)
            
            if critical_unknown:
                print(f"  ⚠️ Campos críticos afectados: {', '.join(critical_unknown)}")
            
            # Verificar si las letras fueron analizadas
            lyrics = analysis.get('lyrics_analysis', {})
            if lyrics.get('lyrics_source') in ['no_analizado', 'missing']:
                print(f"  ⚠️ Letras no analizadas: {lyrics.get('lyrics_source')}")
            
            # Confidence
            confidence = analysis.get('confidence', 0)
            if confidence == 0:
                print(f"  🔴 Confianza: 0% (falla total en el análisis)")
            elif confidence < 0.5:
                print(f"  🟡 Confianza baja: {confidence:.1%}")
            
            # Sugerencias
            print(f"\n💡 SUGERENCIAS PARA MEJORAR:")
            
            if 'genre' in critical_unknown:
                print("  1. Verificar que los features de audio se calcularon correctamente")
            
            if lyrics.get('lyrics_source') in ['no_analizado', 'missing']:
                print("  2. Asegurar que GPT-4 busque las letras cuando no están disponibles")
            
            if confidence == 0:
                print("  3. Revisar el prompt y la respuesta de GPT-4 por errores")
            
            if len(critical_unknown) > 2:
                print("  4. Considerar reprocesar el archivo con más contexto")
        
        # Guardar reporte
        report = {
            'file': file_path,
            'problems': problems,
            'total_problems': total,
            'critical_fields_affected': [f for f in ['genre', 'mood', 'era'] 
                                        if f in str(problems)],
            'confidence': analysis.get('confidence', 0),
            'lyrics_analyzed': lyrics.get('lyrics_source') not in ['no_analizado', 'missing']
        }
        
        report_file = "unknown_fields_report.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Reporte guardado en: {report_file}")
        
    except FileNotFoundError:
        print(f"❌ Archivo no encontrado: {file_path}")
    except json.JSONDecodeError:
        print(f"❌ Error al leer JSON: {file_path}")
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    """Función principal"""
    
    if len(sys.argv) > 1:
        # Analizar archivo específico
        analyze_result_file(sys.argv[1])
    else:
        # Buscar archivos recientes de GPT-4
        pattern = "gpt4_ultimate_*.json"
        files = sorted(Path(".").glob(pattern), key=lambda x: x.stat().st_mtime, reverse=True)
        
        if files:
            print(f"📁 Encontrados {len(files)} archivos de resultados")
            print(f"Analizando el más reciente: {files[0].name}")
            analyze_result_file(str(files[0]))
        else:
            print(f"❌ No se encontraron archivos {pattern}")
            print(f"Uso: python detect_unknown_fields.py <archivo.json>")

if __name__ == "__main__":
    main()