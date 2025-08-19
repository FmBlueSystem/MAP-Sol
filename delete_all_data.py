#!/usr/bin/env python3
"""
Script para ELIMINAR TODOS LOS DATOS de la base de datos
Solo mantiene la estructura (tablas, columnas, índices)
"""

import sqlite3
import sys
from datetime import datetime
from pathlib import Path

def create_backup(db_path: str = 'music_analyzer.db'):
    """Crea un backup OBLIGATORIO antes de eliminar todo"""
    
    backup_path = f'music_analyzer_FULL_BACKUP_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db'
    
    print(f"💾 Creando backup COMPLETO en: {backup_path}")
    import shutil
    shutil.copy2(db_path, backup_path)
    print(f"✅ Backup creado - GUÁRDALO BIEN!")
    
    return backup_path

def delete_all_data(db_path: str = 'music_analyzer.db'):
    """
    ELIMINA TODOS LOS DATOS de todas las tablas
    Mantiene solo la estructura
    """
    
    print("="*80)
    print("☠️  ELIMINACIÓN TOTAL DE DATOS")
    print("="*80)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Obtener estadísticas antes de eliminar
        cursor.execute("SELECT COUNT(*) FROM audio_files")
        total_files = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM llm_metadata")
        total_llm = cursor.fetchone()[0]
        
        # Buscar otras tablas
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            AND name NOT LIKE 'sqlite_%'
        """)
        all_tables = cursor.fetchall()
        
        print(f"\n📊 Datos que serán ELIMINADOS:")
        print(f"  • {total_files} archivos en audio_files")
        print(f"  • {total_llm} registros en llm_metadata")
        print(f"  • Tablas encontradas: {[t[0] for t in all_tables]}")
        
        print("\n⚠️  ÚLTIMA ADVERTENCIA ⚠️")
        print("Esto eliminará PERMANENTEMENTE:")
        print("  - TODOS los archivos de audio registrados")
        print("  - TODOS los análisis")
        print("  - TODOS los metadatos")
        print("  - TODO el contenido de TODAS las tablas")
        
        confirm = input("\n⚠️  Escribe 'ELIMINAR TODO PERMANENTEMENTE' para confirmar: ")
        
        if confirm != "ELIMINAR TODO PERMANENTEMENTE":
            print("\n❌ Cancelado - no se eliminó nada")
            conn.close()
            return False
        
        print("\n🗑️  Eliminando TODOS los datos...")
        
        # Deshabilitar foreign keys temporalmente
        cursor.execute("PRAGMA foreign_keys = OFF")
        
        # Eliminar datos de TODAS las tablas
        deleted_counts = {}
        for table_name in all_tables:
            table = table_name[0]
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count_before = cursor.fetchone()[0]
            
            cursor.execute(f"DELETE FROM {table}")
            deleted_counts[table] = count_before
            print(f"  ✅ Eliminados {count_before} registros de {table}")
        
        # Resetear autoincrement counters
        for table_name in all_tables:
            table = table_name[0]
            cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}'")
        print(f"  ✅ Reseteados contadores de autoincrement")
        
        # Re-habilitar foreign keys
        cursor.execute("PRAGMA foreign_keys = ON")
        
        # Commit cambios
        conn.commit()
        
        # Optimizar base de datos
        print("\n🔧 Optimizando base de datos vacía...")
        conn.execute("VACUUM")
        conn.execute("ANALYZE")
        print("  ✅ Base de datos optimizada")
        
        # Verificar que todo está vacío
        print("\n📊 Verificando eliminación...")
        all_empty = True
        for table_name in all_tables:
            table = table_name[0]
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            if count > 0:
                print(f"  ❌ {table} todavía tiene {count} registros")
                all_empty = False
            else:
                print(f"  ✅ {table} está vacía")
        
        conn.close()
        
        if all_empty:
            print("\n" + "="*80)
            print("✅ ELIMINACIÓN COMPLETA")
            print("="*80)
            print("\n📊 Resumen:")
            for table, count in deleted_counts.items():
                print(f"  • {table}: {count} registros eliminados")
            print(f"\n💀 Base de datos completamente VACÍA")
            print("  Solo queda la estructura (tablas, columnas, índices)")
            return True
        else:
            print("\n⚠️  Algunos datos no se pudieron eliminar")
            return False
            
    except Exception as e:
        print(f"\n❌ Error durante la eliminación: {e}")
        conn.rollback()
        conn.close()
        import traceback
        traceback.print_exc()
        return False

def verify_empty_database(db_path: str = 'music_analyzer.db'):
    """Verifica que la base de datos está completamente vacía"""
    
    print("\n🔍 Verificación final...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Obtener todas las tablas
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
    """)
    tables = cursor.fetchall()
    
    total_records = 0
    for table_name in tables:
        table = table_name[0]
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        total_records += count
        print(f"  • {table}: {count} registros")
    
    # Verificar tamaño del archivo
    db_size = Path(db_path).stat().st_size / 1024 / 1024  # MB
    print(f"\n📦 Tamaño de la BD: {db_size:.2f} MB")
    
    conn.close()
    
    if total_records == 0:
        print("\n✅ Base de datos COMPLETAMENTE VACÍA")
        print("   Solo contiene estructura (tablas, columnas, índices)")
        return True
    else:
        print(f"\n⚠️  Todavía hay {total_records} registros en la base de datos")
        return False

def main():
    """Función principal"""
    
    print("="*80)
    print("💀 ELIMINACIÓN TOTAL DE TODOS LOS DATOS")
    print("="*80)
    print("\n⚠️  PELIGRO: Este script eliminará TODOS los datos")
    print("  No podrás recuperarlos sin el backup")
    
    # Verificar estado actual
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM audio_files")
    total = cursor.fetchone()[0]
    conn.close()
    
    if total == 0:
        print("\n✅ La base de datos ya está vacía")
        return
    
    print(f"\n📊 Actualmente hay {total} archivos en la base de datos")
    print("\n¿Qué deseas hacer?")
    print("  1. ELIMINAR TODOS LOS DATOS (solo mantener estructura)")
    print("  2. Cancelar")
    
    choice = input("\nSelecciona (1-2): ").strip()
    
    if choice != "1":
        print("\n❌ Cancelado - no se modificó nada")
        return
    
    # Crear backup obligatorio
    backup_path = create_backup()
    
    # Proceder con eliminación
    success = delete_all_data()
    
    if success:
        verify_empty_database()
        
        print(f"\n💾 IMPORTANTE: Backup guardado en:")
        print(f"   {backup_path}")
        print(f"\n   Para restaurar:")
        print(f"   cp {backup_path} music_analyzer.db")
        
        print("\n🆕 Para empezar desde cero:")
        print("  1. Registrar archivos nuevos")
        print("  2. Procesar con Essentia")
        print("  3. Analizar con GPT-4")

if __name__ == "__main__":
    main()