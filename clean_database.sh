#!/bin/bash
# =============================================================================
# CLEAN_DATABASE.SH - Limpia y reinicia la base de datos
# =============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

DB_PATH="music_analyzer.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

clear

echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║${NC}           ${BOLD}⚠️  LIMPIEZA DE BASE DE DATOS ⚠️${NC}              ${RED}║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar que existe la BD
if [ ! -f "$DB_PATH" ]; then
    echo -e "${YELLOW}No existe la base de datos${NC}"
    exit 1
fi

# Mostrar estadísticas actuales
echo -e "${CYAN}📊 Estado actual de la base de datos:${NC}"
TOTAL_FILES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
TOTAL_METADATA=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata" 2>/dev/null || echo "0")
DB_SIZE=$(du -h "$DB_PATH" | cut -f1)

echo -e "  • Archivos registrados: ${GREEN}$TOTAL_FILES${NC}"
echo -e "  • Análisis guardados: ${GREEN}$TOTAL_METADATA${NC}"
echo -e "  • Tamaño de BD: ${GREEN}$DB_SIZE${NC}"
echo ""

echo -e "${YELLOW}Esta acción eliminará:${NC}"
echo -e "  • Todos los análisis de audio (tabla llm_metadata)"
echo -e "  • Opcionalmente: todos los archivos registrados"
echo ""

echo -e "${CYAN}¿Qué deseas hacer?${NC}"
echo -e "  ${BOLD}1)${NC} Limpiar solo análisis (mantener archivos registrados)"
echo -e "  ${BOLD}2)${NC} Limpiar TODO (análisis + archivos)"
echo -e "  ${BOLD}3)${NC} Crear backup y limpiar análisis"
echo -e "  ${BOLD}4)${NC} Crear backup y limpiar TODO"
echo -e "  ${BOLD}0)${NC} Cancelar"
echo ""

read -p "$(echo -e ${YELLOW}Selecciona una opción [0-4]: ${NC})" option

case $option in
    1)
        echo ""
        echo -e "${YELLOW}⚠️  Se eliminarán todos los análisis${NC}"
        read -p "$(echo -e ${RED}¿Estás seguro? [s/N]: ${NC})" confirm
        
        if [[ "$confirm" =~ ^[Ss]$ ]]; then
            echo -e "${CYAN}Limpiando análisis...${NC}"
            
            # Limpiar solo llm_metadata
            sqlite3 "$DB_PATH" "DELETE FROM llm_metadata"
            
            # Verificar
            REMAINING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata")
            
            if [ "$REMAINING" = "0" ]; then
                echo -e "${GREEN}✅ Análisis eliminados correctamente${NC}"
                
                # Optimizar BD
                sqlite3 "$DB_PATH" "VACUUM"
                echo -e "${GREEN}✅ Base de datos optimizada${NC}"
            else
                echo -e "${RED}❌ Error al limpiar análisis${NC}"
            fi
        else
            echo -e "${YELLOW}Operación cancelada${NC}"
        fi
        ;;
        
    2)
        echo ""
        echo -e "${RED}⚠️  SE ELIMINARÁ TODA LA INFORMACIÓN${NC}"
        echo -e "${RED}    Esto incluye archivos y análisis${NC}"
        echo ""
        echo -e "${YELLOW}Para confirmar, escribe 'ELIMINAR TODO':${NC}"
        read -p "> " confirm
        
        if [ "$confirm" = "ELIMINAR TODO" ]; then
            echo -e "${CYAN}Limpiando toda la base de datos...${NC}"
            
            # Limpiar ambas tablas
            sqlite3 "$DB_PATH" "DELETE FROM llm_metadata"
            sqlite3 "$DB_PATH" "DELETE FROM audio_files"
            
            # Resetear autoincrement
            sqlite3 "$DB_PATH" "DELETE FROM sqlite_sequence WHERE name='audio_files'"
            
            # Verificar
            FILES_REMAINING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files")
            META_REMAINING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata")
            
            if [ "$FILES_REMAINING" = "0" ] && [ "$META_REMAINING" = "0" ]; then
                echo -e "${GREEN}✅ Base de datos limpiada completamente${NC}"
                
                # Optimizar BD
                sqlite3 "$DB_PATH" "VACUUM"
                echo -e "${GREEN}✅ Base de datos optimizada${NC}"
            else
                echo -e "${RED}❌ Error al limpiar base de datos${NC}"
            fi
        else
            echo -e "${YELLOW}Operación cancelada${NC}"
        fi
        ;;
        
    3)
        echo ""
        echo -e "${CYAN}Creando backup...${NC}"
        
        # Crear backup
        BACKUP_FILE="backup_${TIMESTAMP}.db"
        cp "$DB_PATH" "$BACKUP_FILE"
        
        if [ -f "$BACKUP_FILE" ]; then
            echo -e "${GREEN}✅ Backup creado: $BACKUP_FILE${NC}"
            
            echo -e "${CYAN}Limpiando análisis...${NC}"
            sqlite3 "$DB_PATH" "DELETE FROM llm_metadata"
            
            # Verificar
            REMAINING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata")
            
            if [ "$REMAINING" = "0" ]; then
                echo -e "${GREEN}✅ Análisis eliminados correctamente${NC}"
                
                # Optimizar BD
                sqlite3 "$DB_PATH" "VACUUM"
                echo -e "${GREEN}✅ Base de datos optimizada${NC}"
            fi
        else
            echo -e "${RED}❌ Error creando backup${NC}"
        fi
        ;;
        
    4)
        echo ""
        echo -e "${CYAN}Creando backup completo...${NC}"
        
        # Crear backup
        BACKUP_FILE="backup_complete_${TIMESTAMP}.db"
        cp "$DB_PATH" "$BACKUP_FILE"
        
        if [ -f "$BACKUP_FILE" ]; then
            echo -e "${GREEN}✅ Backup creado: $BACKUP_FILE${NC}"
            
            echo -e "${YELLOW}Para confirmar limpieza total, escribe 'CONFIRMAR':${NC}"
            read -p "> " confirm
            
            if [ "$confirm" = "CONFIRMAR" ]; then
                echo -e "${CYAN}Limpiando toda la base de datos...${NC}"
                
                # Limpiar ambas tablas
                sqlite3 "$DB_PATH" "DELETE FROM llm_metadata"
                sqlite3 "$DB_PATH" "DELETE FROM audio_files"
                
                # Resetear autoincrement
                sqlite3 "$DB_PATH" "DELETE FROM sqlite_sequence WHERE name='audio_files'"
                
                # Optimizar BD
                sqlite3 "$DB_PATH" "VACUUM"
                
                echo -e "${GREEN}✅ Base de datos limpiada y optimizada${NC}"
                echo -e "${CYAN}Backup guardado en: $BACKUP_FILE${NC}"
            else
                echo -e "${YELLOW}Operación cancelada${NC}"
            fi
        else
            echo -e "${RED}❌ Error creando backup${NC}"
        fi
        ;;
        
    0)
        echo -e "${YELLOW}Operación cancelada${NC}"
        exit 0
        ;;
        
    *)
        echo -e "${RED}Opción inválida${NC}"
        exit 1
        ;;
esac

echo ""

# Mostrar estadísticas finales
echo -e "${CYAN}📊 Estado final de la base de datos:${NC}"
FINAL_FILES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
FINAL_METADATA=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata" 2>/dev/null || echo "0")
FINAL_SIZE=$(du -h "$DB_PATH" | cut -f1)

echo -e "  • Archivos registrados: ${GREEN}$FINAL_FILES${NC}"
echo -e "  • Análisis guardados: ${GREEN}$FINAL_METADATA${NC}"
echo -e "  • Tamaño de BD: ${GREEN}$FINAL_SIZE${NC}"
echo ""

# Sugerir próximo paso
if [ "$FINAL_FILES" = "0" ]; then
    echo -e "${CYAN}💡 Próximo paso:${NC}"
    echo -e "   Para repoblar la base de datos, ejecuta:"
    echo -e "   ${GREEN}python3 import/scan-folders.js${NC}"
    echo ""
elif [ "$FINAL_METADATA" = "0" ]; then
    echo -e "${CYAN}💡 Próximo paso:${NC}"
    echo -e "   Para analizar los archivos, ejecuta:"
    echo -e "   ${GREEN}./analyze_all.sh${NC}"
    echo ""
fi

echo -e "${GREEN}✅ Proceso completado${NC}"