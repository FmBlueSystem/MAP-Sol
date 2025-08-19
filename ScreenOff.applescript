-- ScreenOff.applescript
-- Apaga la pantalla del Mac sin afectar procesos
-- Puedes guardar esto como aplicación desde Script Editor

on run
    display dialog "¿Qué deseas hacer?" buttons {"Apagar Pantalla", "Apagar en 5s", "Cancelar"} default button "Apagar Pantalla" with icon note with title "Screen Control"
    
    if button returned of result is "Apagar Pantalla" then
        -- Apagar pantalla inmediatamente
        do shell script "pmset displaysleepnow"
        
    else if button returned of result is "Apagar en 5s" then
        -- Mostrar notificación
        display notification "La pantalla se apagará en 5 segundos" with title "Screen Off" subtitle "Preparando..." sound name "Purr"
        
        -- Esperar 5 segundos
        delay 5
        
        -- Apagar pantalla
        do shell script "pmset displaysleepnow"
    end if
end run

-- Función alternativa simple (sin diálogo)
on idle
    do shell script "pmset displaysleepnow"
    quit
end idle