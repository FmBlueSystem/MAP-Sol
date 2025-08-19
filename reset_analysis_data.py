#!/usr/bin/env python3
"""
Script para resetear los datos de análisis en la base de datos
Mantiene la estructura y los archivos, pero limpia todos los análisis
"""

import sqlite3
import sys
from datetime import datetime
from pathlib import Path

def create_backup(db_path: str = 'music_analyzer.db'):
    """Crea un backup de la base de datos antes de limpiar"""
    
    backup_path = f'music_analyzer_backup_before_reset_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db'
    
    print(f"💾 Creando backup en: {backup_path}")
    import shutil
    shutil.copy2(db_path, backup_path)
    print(f"✅ Backup creado exitosamente")
    
    return backup_path

def reset_analysis_data(db_path: str = 'music_analyzer.db', keep_files: bool = True):
    """
    Resetea todos los datos de análisis en la base de datos
    
    Args:
        db_path: Ruta a la base de datos
        keep_files: Si True, mantiene los registros de audio_files pero limpia análisis
                   Si False, elimina TODO (peligroso!)
    """
    
    print("="*80)
    print("🔄 RESETEO DE DATOS DE ANÁLISIS")
    print("="*80)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Obtener estadísticas antes de limpiar
        cursor.execute("SELECT COUNT(*) FROM audio_files")
        total_files = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM llm_metadata")
        total_llm = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM llm_metadata WHERE LLM_ANALYZED = 1")
        total_analyzed = cursor.fetchone()[0]
        
        print(f"\n📊 Estado actual:")
        print(f"  • Total archivos: {total_files}")
        print(f"  • Registros llm_metadata: {total_llm}")
        print(f"  • Analizados con LLM: {total_analyzed}")
        
        if keep_files:
            print("\n🧹 Limpiando datos de análisis (manteniendo archivos)...")
            
            # 1. Limpiar toda la tabla llm_metadata
            cursor.execute("DELETE FROM llm_metadata")
            print(f"  ✅ Eliminados {total_llm} registros de llm_metadata")
            
            # 2. Resetear campos de análisis en audio_files
            cursor.execute("""
                UPDATE audio_files SET
                    AI_GENRE = NULL,
                    AI_MOOD = NULL,
                    AI_BPM = NULL,
                    AI_ENERGY = NULL,
                    AI_DANCEABILITY = NULL,
                    AI_VALENCE = NULL,
                    AI_ACOUSTICNESS = NULL,
                    AI_INSTRUMENTALNESS = NULL,
                    AI_LIVENESS = NULL,
                    AI_SPEECHINESS = NULL,
                    AI_LOUDNESS = NULL,
                    AI_MODE = NULL,
                    AI_TIME_SIGNATURE = NULL,
                    AI_SUBGENRES = NULL,
                    AI_OCCASION = NULL,
                    AI_ERA = NULL,
                    AI_CULTURAL_CONTEXT = NULL,
                    AI_ANALYZED = 0,
                    AI_KEY = NULL,
                    analysis_status = 'pending',
                    last_analyzed = NULL,
                    analyzed = 0,
                    needs_analysis = 1,
                    lyrics_analyzed = 0,
                    lyrics_analyzed_date = NULL,
                    lyrics_language = NULL,
                    lyrics_theme_primary = NULL,
                    lyrics_mood = NULL,
                    normalization_analyzed = 0
            """)
            print(f"  ✅ Reseteados campos de análisis en {total_files} archivos")
            
            # 3. Recrear registros vacíos en llm_metadata para cada archivo
            cursor.execute("""
                INSERT INTO llm_metadata (file_id, AI_ANALYZED, LLM_ANALYZED)
                SELECT id, 0, 0 FROM audio_files
            """)
            print(f"  ✅ Creados {cursor.rowcount} registros vacíos en llm_metadata")
            
        else:
            # Opción nuclear: eliminar TODO
            print("\n⚠️ ELIMINANDO TODOS LOS DATOS (opción nuclear)...")
            
            confirm = input("⚠️ ¿Estás SEGURO? Esto eliminará TODOS los archivos. Escribe 'SI ELIMINAR TODO': ")
            if confirm == "SI ELIMINAR TODO":
                cursor.execute("DELETE FROM llm_metadata")
                cursor.execute("DELETE FROM audio_files")
                print("  ✅ Eliminados TODOS los registros")
            else:
                print("  ❌ Cancelado - no se eliminó nada")
                conn.close()
                return False
        
        # Commit cambios primero
        conn.commit()
        
        # 4. Limpiar índices y optimizar (VACUUM debe ejecutarse fuera de transacción)
        print("\n🔧 Optimizando base de datos...")
        conn.execute("VACUUM")
        conn.execute("ANALYZE")
        print("  ✅ Base de datos optimizada")
        
        # Verificar resultado
        cursor.execute("SELECT COUNT(*) FROM audio_files")
        final_files = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM llm_metadata")
        final_llm = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM llm_metadata WHERE LLM_ANALYZED = 1")
        final_analyzed = cursor.fetchone()[0]
        
        print("\n📊 Estado final:")
        print(f"  • Total archivos: {final_files}")
        print(f"  • Registros llm_metadata: {final_llm}")
        print(f"  • Analizados con LLM: {final_analyzed}")
        
        conn.close()
        
        print("\n" + "="*80)
        print("✅ RESETEO COMPLETADO")
        print("="*80)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error durante el reseteo: {e}")
        conn.rollback()
        conn.close()
        import traceback
        traceback.print_exc()
        return False

def verify_reset(db_path: str = 'music_analyzer.db'):
    """Verifica que el reseteo fue exitoso"""
    
    print("\n🔍 Verificando reseteo...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Verificar que no hay análisis
    checks = [
        ("LLM analizados", "SELECT COUNT(*) FROM llm_metadata WHERE LLM_ANALYZED = 1"),
        ("AI analizados", "SELECT COUNT(*) FROM llm_metadata WHERE AI_ANALYZED = 1"),
        ("Con género", "SELECT COUNT(*) FROM llm_metadata WHERE LLM_GENRE IS NOT NULL"),
        ("Con emociones", "SELECT COUNT(*) FROM llm_metadata WHERE LLM_EMOTIONS IS NOT NULL"),
        ("Con año real", "SELECT COUNT(*) FROM llm_metadata WHERE LLM_REAL_YEAR IS NOT NULL"),
        ("Audio files con AI_GENRE", "SELECT COUNT(*) FROM audio_files WHERE AI_GENRE IS NOT NULL"),
        ("Audio files analizados", "SELECT COUNT(*) FROM audio_files WHERE AI_ANALYZED = 1")
    ]
    
    all_zero = True
    for description, query in checks:
        cursor.execute(query)
        count = cursor.fetchone()[0]
        status = "✅" if count == 0 else "❌"
        print(f"  {status} {description}: {count}")
        if count > 0:
            all_zero = False
    
    conn.close()
    
    if all_zero:
        print("\n✅ Base de datos completamente limpia y lista para nuevos análisis")
    else:
        print("\n⚠️ Algunos campos no se limpiaron completamente")
    
    return all_zero

def main():
    """Función principal"""
    
    print("="*80)
    print("⚠️  ADVERTENCIA: RESETEO DE BASE DE DATOS")
    print("="*80)
    print("\nEste script va a:")
    print("  1. Crear un backup de seguridad")
    print("  2. Eliminar TODOS los análisis de GPT-4 y Essentia")
    print("  3. Resetear todos los campos de análisis")
    print("  4. Mantener los archivos de audio registrados")
    print("  5. Dejar la BD lista para empezar desde cero")
    
    print("\nOpciones:")
    print("  1. Resetear solo análisis (mantener archivos)")
    print("  2. ELIMINAR TODO (peligroso!)")
    print("  3. Cancelar")
    
    choice = input("\nSelecciona opción (1-3): ").strip()
    
    if choice == "3":
        print("\n❌ Cancelado - no se modificó nada")
        return
    
    # Crear backup primero
    backup_path = create_backup()
    
    if choice == "1":
        # Resetear manteniendo archivos
        success = reset_analysis_data(keep_files=True)
    elif choice == "2":
        # Eliminar todo
        success = reset_analysis_data(keep_files=False)
    else:
        print("\n❌ Opción inválida")
        return
    
    if success:
        verify_reset()
        
        print(f"\n💡 Backup guardado en: {backup_path}")
        print("   Para restaurar: cp {} music_analyzer.db".format(backup_path))
        
        print("\n🚀 Próximos pasos:")
        print("  1. Procesar archivos con Essentia")
        print("  2. Analizar con GPT-4")
        print("  3. Guardar con: python3 save_gpt4_complete.py")

if __name__ == "__main__":
    # Confirmar antes de ejecutar
    print("⚠️  ESTE SCRIPT RESETEARÁ LA BASE DE DATOS")
    confirm = input("¿Continuar? (s/n): ").strip().lower()
    
    if confirm == 's':
        main()
    else:
        print("\n❌ Cancelado")