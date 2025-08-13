// FIX-PLAYER.JS - Forzar player organizado

function forceFixPlayer() {
    console.log('🔧 Forzando corrección del player...');
    
    // Eliminar TODOS los players existentes
    const existingPlayers = document.querySelectorAll('[id*="player"], [class*="player"], [id*="audio-panel"]');
    existingPlayers.forEach(p => {
        console.log('Eliminando:', p.id || p.className);
        p.remove();
    });
    
    // Crear el player correcto desde cero
    const newPlayer = document.createElement('div');
    newPlayer.innerHTML = `
        <!-- SECCIÓN 1: INFO (33%) -->
        <div style="
            width: 33%;
            display: flex;
            align-items: center;
            gap: 14px;
        ">
            <div id="current-artwork-fixed" style="
                width: 56px;
                height: 56px;
                background: #282828;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #b3b3b3;
                font-size: 24px;
            ">♪</div>
            <div>
                <div id="current-title-fixed" style="color: #fff; font-size: 14px; font-weight: 500;">No track playing</div>
                <div id="current-artist-fixed" style="color: #b3b3b3; font-size: 12px;">Select a song</div>
            </div>
        </div>
        
        <!-- SECCIÓN 2: CONTROLES (34%) -->
        <div style="
            width: 34%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        ">
            <!-- Botones -->
            <div style="display: flex; align-items: center; gap: 16px;">
                <button style="background: none; border: none; color: #b3b3b3; font-size: 16px; cursor: pointer; padding: 0;">🔀</button>
                <button style="background: none; border: none; color: #b3b3b3; font-size: 16px; cursor: pointer; padding: 0;">⏮</button>
                <button id="play-btn-fixed" style="
                    width: 32px;
                    height: 32px;
                    background: #fff;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    padding: 0;
                ">▶</button>
                <button style="background: none; border: none; color: #b3b3b3; font-size: 16px; cursor: pointer; padding: 0;">⏭</button>
                <button style="background: none; border: none; color: #b3b3b3; font-size: 16px; cursor: pointer; padding: 0;">🔁</button>
            </div>
            <!-- Progress -->
            <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                <span style="color: #b3b3b3; font-size: 11px; min-width: 40px; text-align: right;">0:00</span>
                <div style="flex: 1; height: 4px; background: #535353; border-radius: 2px; position: relative;">
                    <div style="height: 100%; width: 25%; background: #fff; border-radius: 2px;"></div>
                </div>
                <span style="color: #b3b3b3; font-size: 11px; min-width: 40px;">3:45</span>
            </div>
        </div>
        
        <!-- SECCIÓN 3: METERS + VOLUME (33%) -->
        <div style="
            width: 33%;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 16px;
        ">
            <!-- K-Meter -->
            <div style="
                background: #000;
                border: 1px solid #282828;
                border-radius: 4px;
                padding: 8px;
                width: 140px;
            ">
                <!-- L Channel -->
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <span style="color: #666; font-size: 10px; width: 12px;">L</span>
                    <div style="flex: 1; height: 6px; background: #1a1a1a; border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: 60%; background: linear-gradient(90deg, #00ff00 0%, #ffff00 70%, #ff0000 100%);"></div>
                    </div>
                    <span style="color: #00ff00; font-size: 9px; font-family: monospace; width: 30px; text-align: right;">-12.3</span>
                </div>
                <!-- R Channel -->
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="color: #666; font-size: 10px; width: 12px;">R</span>
                    <div style="flex: 1; height: 6px; background: #1a1a1a; border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: 55%; background: linear-gradient(90deg, #00ff00 0%, #ffff00 70%, #ff0000 100%);"></div>
                    </div>
                    <span style="color: #00ff00; font-size: 9px; font-family: monospace; width: 30px; text-align: right;">-14.1</span>
                </div>
            </div>
            
            <!-- Volume -->
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #b3b3b3; font-size: 16px;">🔊</span>
                <input type="range" min="0" max="100" value="75" style="width: 80px; cursor: pointer;">
            </div>
        </div>
    `;
    
    // Aplicar estilos al contenedor
    newPlayer.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 90px;
        background: #181818;
        border-top: 1px solid #282828;
        display: flex;
        align-items: center;
        padding: 0 16px;
        box-sizing: border-box;
        z-index: 2147483647;
    `;
    
    newPlayer.id = 'forced-fixed-player';
    
    // Agregar al body
    document.body.appendChild(newPlayer);
    
    console.log('✅ Player forzado agregado');
    
    // Verificar layout
    setTimeout(() => {
        const player = document.getElementById('forced-fixed-player');
        if (player) {
            const rect = player.getBoundingClientRect();
            console.log('📏 Player dimensions:', {
                width: rect.width,
                height: rect.height,
                bottom: rect.bottom,
                visible: rect.height > 0
            });
            
            const sections = player.children;
            console.log('📦 Secciones:', sections.length);
            for (let i = 0; i < sections.length; i++) {
                const sectionRect = sections[i].getBoundingClientRect();
                console.log(`  Sección ${i + 1}:`, {
                    width: sectionRect.width,
                    left: sectionRect.left
                });
            }
        }
    }, 100);
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceFixPlayer);
} else {
    // DOM ya cargado
    setTimeout(forceFixPlayer, 1000);
}

// También ejecutar después de 3 segundos por si acaso
setTimeout(forceFixPlayer, 3000);

console.log('🚀 Fix-player.js cargado');