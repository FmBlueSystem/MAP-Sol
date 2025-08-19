#!/bin/bash

# ========================================
# 🖥️ Screen Off Script for macOS
# ========================================
# Apaga solo la pantalla sin afectar procesos
# Los procesos continúan ejecutándose normalmente
# ========================================

echo "🖥️ Screen Control for macOS"
echo "=========================="
echo ""

# Función para mostrar el menú
show_menu() {
    echo "Selecciona una opción:"
    echo ""
    echo "1) Apagar pantalla inmediatamente"
    echo "2) Apagar pantalla en 5 segundos"
    echo "3) Apagar pantalla en 10 segundos"
    echo "4) Bloquear y apagar pantalla"
    echo "5) Activar salvapantallas"
    echo "6) Poner Mac en reposo (sleep) - mantiene procesos"
    echo "7) Configurar hot corner para apagar pantalla"
    echo "8) Ver estado de caffeinate (prevención de sleep)"
    echo "9) Prevenir que el Mac duerma (caffeinate)"
    echo "0) Salir"
    echo ""
}

# Función para apagar la pantalla
screen_off() {
    echo "⏳ Apagando pantalla..."
    # Método principal: usar pmset para apagar display
    pmset displaysleepnow
    echo "✅ Pantalla apagada. Los procesos continúan ejecutándose."
    echo "💡 Mueve el mouse o presiona una tecla para encender la pantalla."
}

# Función para apagar con delay
screen_off_delay() {
    local seconds=$1
    echo "⏳ La pantalla se apagará en $seconds segundos..."
    echo "   (Presiona Ctrl+C para cancelar)"
    sleep $seconds
    screen_off
}

# Función para bloquear y apagar
lock_and_off() {
    echo "🔒 Bloqueando y apagando pantalla..."
    # Primero bloqueamos
    /System/Library/CoreServices/Menu\ Extras/User.menu/Contents/Resources/CGSession -suspend
    # Luego apagamos pantalla después de 1 segundo
    sleep 1
    pmset displaysleepnow
    echo "✅ Mac bloqueado y pantalla apagada."
}

# Función para activar salvapantallas
start_screensaver() {
    echo "🌟 Activando salvapantallas..."
    open -a ScreenSaverEngine
    echo "✅ Salvapantallas activado."
}

# Función para poner Mac en reposo
mac_sleep() {
    echo "😴 Poniendo Mac en reposo..."
    echo "   (Los procesos se pausarán pero no se cerrarán)"
    pmset sleepnow
}

# Función para configurar hot corner
setup_hot_corner() {
    echo "🔧 Configuración de Hot Corner"
    echo "================================"
    echo ""
    echo "Para configurar un hot corner que apague la pantalla:"
    echo ""
    echo "1. Abre Preferencias del Sistema"
    echo "2. Ve a 'Escritorio y Salvapantallas'"
    echo "3. Click en 'Esquinas activas...'"
    echo "4. Selecciona una esquina y elige 'Poner pantalla en reposo'"
    echo ""
    echo "Alternativamente, ejecuta este comando para abrir directamente:"
    echo ""
    open /System/Library/PreferencePanes/DesktopScreenEffectsPref.prefPane
    echo ""
    echo "✅ Panel de preferencias abierto."
}

# Función para verificar caffeinate
check_caffeinate() {
    echo "☕ Verificando procesos caffeinate..."
    echo ""
    
    if pgrep -x "caffeinate" > /dev/null; then
        echo "✅ Caffeinate está activo. El Mac no entrará en reposo."
        echo ""
        echo "Procesos caffeinate en ejecución:"
        ps aux | grep -E "[c]affeinate"
    else
        echo "❌ Caffeinate no está activo. El Mac puede entrar en reposo normalmente."
    fi
}

# Función para iniciar caffeinate
start_caffeinate() {
    echo "☕ Iniciando caffeinate para prevenir sleep..."
    echo ""
    echo "Opciones:"
    echo "1) Prevenir sleep del sistema (mantiene procesos activos)"
    echo "2) Prevenir sleep del display solamente"
    echo "3) Prevenir sleep completo (sistema + display)"
    echo "4) Cancelar"
    echo ""
    read -p "Selecciona opción: " cafe_option
    
    case $cafe_option in
        1)
            echo "Iniciando caffeinate para sistema..."
            caffeinate -i &
            echo "✅ Caffeinate iniciado. PID: $!"
            echo "   Para detenerlo: kill $!"
            ;;
        2)
            echo "Iniciando caffeinate para display..."
            caffeinate -d &
            echo "✅ Caffeinate iniciado. PID: $!"
            echo "   Para detenerlo: kill $!"
            ;;
        3)
            echo "Iniciando caffeinate completo..."
            caffeinate -dis &
            echo "✅ Caffeinate iniciado. PID: $!"
            echo "   Para detenerlo: kill $!"
            ;;
        *)
            echo "Cancelado."
            ;;
    esac
}

# Función principal con menú interactivo
main_interactive() {
    while true; do
        show_menu
        read -p "Opción: " choice
        echo ""
        
        case $choice in
            1)
                screen_off
                break
                ;;
            2)
                screen_off_delay 5
                break
                ;;
            3)
                screen_off_delay 10
                break
                ;;
            4)
                lock_and_off
                break
                ;;
            5)
                start_screensaver
                break
                ;;
            6)
                mac_sleep
                break
                ;;
            7)
                setup_hot_corner
                ;;
            8)
                check_caffeinate
                ;;
            9)
                start_caffeinate
                ;;
            0)
                echo "👋 Saliendo..."
                exit 0
                ;;
            *)
                echo "❌ Opción inválida. Intenta de nuevo."
                ;;
        esac
        
        echo ""
        echo "Presiona Enter para continuar..."
        read
        clear
    done
}

# Función para uso directo con parámetros
main_direct() {
    case "$1" in
        "off"|"--off")
            screen_off
            ;;
        "delay"|"--delay")
            if [ -n "$2" ]; then
                screen_off_delay "$2"
            else
                screen_off_delay 5
            fi
            ;;
        "lock"|"--lock")
            lock_and_off
            ;;
        "screensaver"|"--screensaver")
            start_screensaver
            ;;
        "sleep"|"--sleep")
            mac_sleep
            ;;
        "caffeinate"|"--caffeinate")
            caffeinate -dis &
            echo "☕ Caffeinate iniciado en background. PID: $!"
            echo "   El Mac no entrará en reposo. Para detener: kill $!"
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            echo "❌ Comando no reconocido: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Función de ayuda
show_help() {
    echo "🖥️ Screen Off Script - Ayuda"
    echo "============================"
    echo ""
    echo "USO INTERACTIVO:"
    echo "  ./screen-off.sh"
    echo ""
    echo "USO DIRECTO:"
    echo "  ./screen-off.sh [comando] [opciones]"
    echo ""
    echo "COMANDOS:"
    echo "  off, --off                Apagar pantalla inmediatamente"
    echo "  delay, --delay [segundos] Apagar pantalla con retraso (default: 5s)"
    echo "  lock, --lock              Bloquear y apagar pantalla"
    echo "  screensaver, --screensaver Activar salvapantallas"
    echo "  sleep, --sleep            Poner Mac en reposo"
    echo "  caffeinate, --caffeinate  Prevenir que el Mac duerma"
    echo "  help, --help, -h          Mostrar esta ayuda"
    echo ""
    echo "EJEMPLOS:"
    echo "  ./screen-off.sh                    # Menú interactivo"
    echo "  ./screen-off.sh off                # Apagar pantalla ahora"
    echo "  ./screen-off.sh delay 10           # Apagar en 10 segundos"
    echo "  ./screen-off.sh lock               # Bloquear y apagar"
    echo "  ./screen-off.sh caffeinate         # Mantener Mac despierto"
    echo ""
    echo "NOTAS:"
    echo "  • La pantalla se apaga pero los procesos continúan"
    echo "  • Mueve el mouse o presiona una tecla para encender"
    echo "  • Usa caffeinate para prevenir sleep automático"
    echo "  • El script requiere permisos de administrador para algunas funciones"
}

# Main
echo ""
if [ $# -eq 0 ]; then
    # Sin argumentos, modo interactivo
    main_interactive
else
    # Con argumentos, modo directo
    main_direct "$@"
fi