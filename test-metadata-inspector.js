// 🧪 TEST SCRIPT - Metadata Inspector Modal
// Ejecutar en la consola del navegador para probar el Metadata Inspector

logDebug('🔍 INICIANDO PRUEBAS DEL METADATA INSPECTOR...');
logDebug('════════════════════════════════════════════════════════');

// Test 1: Verificar que el sistema está cargado
logDebug('\n📋 Test 1: Verificación del Sistema');
if (window.metadataInspector) {
    logInfo('✅ MetadataInspectorModal cargado correctamente');
    logDebug('  - Clase: ' + window.metadataInspector.constructor.name);
    logDebug(
        '  - Métodos disponibles:',
        Object.getOwnPropertyNames(Object.getPrototypeOf(window.metadataInspector))
    );
} else {
    logError('❌ MetadataInspectorModal NO está cargado');
}

// Test 2: Verificar estructura del DOM
logDebug('\n📋 Test 2: Verificación del DOM');
const modalElements = {
    'metadata-inspector-backdrop': 'Backdrop del modal',
    'mi-track-info': 'Info del track',
    'mi-search-input': 'Campo de búsqueda',
    'mi-tabs': 'Tabs de categorías',
    'mi-content': 'Área de contenido'
};

let allElementsOk = true;
for (const [id, description] of Object.entries(modalElements)) {
    const element = document.getElementById(id);
    if (element) {
        logDebug(`  ✅ ${description} (#${id})`);
    } else {
        logError(`  ❌ ${description} (#${id}) NO encontrado`);
        allElementsOk = false;
    }
}

// Test 3: Verificar tabs generados
logDebug('\n📋 Test 3: Verificación de Tabs');
const tabs = document.querySelectorAll('.mi-tab');
if (tabs.length > 0) {
    logInfo('✅ ${tabs.length} tabs encontrados:');
    tabs.forEach(tab => {
        logDebug(`  - ${tab.textContent.trim()} (${tab.dataset.tab})`);
    });
} else {
    logError('❌ No se encontraron tabs');
}

// Test 4: Probar apertura con datos mock
logDebug('\n📋 Test 4: Prueba de Apertura con Datos Mock');
const mockTrack = {
    id: 1,
    file_path: '/test/music/song.mp3',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    genre: 'Electronic',
    year: '2024',
    AI_BPM: 128,
    AI_KEY: '9A',
    AI_ENERGY: 0.75
};

logDebug('🎵 Abriendo modal con datos de prueba...');
if (window.metadataInspector) {
    window.metadataInspector.open(mockTrack);

    setTimeout(() => {
        const backdrop = document.getElementById('metadata-inspector-backdrop');
        if (backdrop && backdrop.classList.contains('active')) {
            logInfo('✅ Modal abierto correctamente');

            // Verificar info del track
            const trackInfo = document.getElementById('mi-track-info');
            if (trackInfo && trackInfo.textContent.includes('Test Song')) {
                logInfo('✅ Info del track actualizada');
            }

            // Verificar contenido
            const content = document.getElementById('mi-content');
            if (content && content.querySelector('.mi-field')) {
                const fieldCount = content.querySelectorAll('.mi-field').length;
                logInfo('✅ ${fieldCount} campos mostrados en el contenido');
            }
        } else {
            logError('❌ Modal no se abrió');
        }
    }, 500);
}

// Test 5: Probar búsqueda
logDebug('\n📋 Test 5: Prueba de Búsqueda');
setTimeout(() => {
    if (window.metadataInspector) {
        logDebug('🔍 Probando búsqueda con término "bpm"...');
        window.metadataInspector.handleSearch('bpm');

        setTimeout(() => {
            const content = document.getElementById('mi-content');
            const fields = content.querySelectorAll('.mi-field');
            logDebug(`  - Campos filtrados: ${fields.length}`);

            if (fields.length > 0 && fields.length < 10) {
                logInfo('✅ Búsqueda funcionando');
            }
        }, 100);
    }
}, 1000);

// Test 6: Probar cambio de tabs
logDebug('\n📋 Test 6: Prueba de Cambio de Tabs');
setTimeout(() => {
    if (window.metadataInspector) {
        logDebug('📑 Cambiando a tab "audio"...');
        window.metadataInspector.switchTab('audio');

        setTimeout(() => {
            const activeTab = document.querySelector('.mi-tab.active');
            if (activeTab && activeTab.dataset.tab === 'audio') {
                logInfo('✅ Tab cambiado correctamente');
            }
        }, 100);
    }
}, 1500);

// Test 7: Probar con un archivo real
logDebug('\n📋 Test 7: Prueba con Archivo Real');
setTimeout(() => {
    const firstCard = document.querySelector('.file-card');
    if (firstCard) {
        logDebug('🎵 Encontrado primer archivo, abriendo metadata inspector...');

        // Simular doble click
        const dblClickEvent = new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        firstCard.dispatchEvent(dblClickEvent);

        setTimeout(() => {
            const backdrop = document.getElementById('metadata-inspector-backdrop');
            if (backdrop && backdrop.classList.contains('active')) {
                logInfo('✅ Modal abierto con archivo real');

                const content = document.getElementById('mi-content');
                const fields = content.querySelectorAll('.mi-field');
                logDebug(`  - Campos mostrados: ${fields.length}`);

                // Mostrar algunos valores
                if (fields.length > 0) {
                    logDebug('  - Primeros 5 campos:');
                    Array.from(fields)
                        .slice(0, 5)
                        .forEach(field => {
                            const name = field.querySelector('.mi-field-name').textContent;
                            const value = field.querySelector('.mi-field-value').textContent;
                            logDebug(`    • ${name}: ${value}`);
                        });
                }
            }
        }, 500);
    } else {
        logWarn('⚠️ No hay archivos cargados para probar');
    }
}, 2000);

// Test 8: Probar shortcut 'i'
logDebug('\n📋 Test 8: Prueba de Shortcut "i"');
setTimeout(() => {
    // Primero cerrar el modal si está abierto
    if (window.metadataInspector) {
        window.metadataInspector.close();
    }

    setTimeout(() => {
        // Seleccionar un archivo
        const firstCard = document.querySelector('.file-card');
        if (firstCard) {
            firstCard.classList.add('selected');
            logDebug('📌 Archivo seleccionado, presionando "i"...');

            // Simular tecla 'i'
            const keyEvent = new KeyboardEvent('keydown', {
                key: 'i',
                code: 'KeyI',
                bubbles: true
            });
            document.dispatchEvent(keyEvent);

            setTimeout(() => {
                const backdrop = document.getElementById('metadata-inspector-backdrop');
                if (backdrop && backdrop.classList.contains('active')) {
                    logInfo('✅ Shortcut "i" funcionando');
                } else {
                    logError('❌ Shortcut "i" no funcionó');
                }
            }, 500);
        }
    }, 500);
}, 3000);

// Test 9: Probar exportación
logDebug('\n📋 Test 9: Prueba de Exportación');
setTimeout(() => {
    if (window.metadataInspector && window.metadataInspector.currentTrack) {
        logDebug('📥 Probando funciones de exportación...');

        // Test copy all
        try {
            window.metadataInspector.copyAll();
            logInfo('✅ Copy All ejecutado');
        } catch (e) {
            logError('❌ Error en Copy All:', e);
        }

        // Test export JSON (no descargará realmente en test)
        logDebug(
            '  - Export JSON disponible: ' +
                (typeof window.metadataInspector.exportJSON === 'function' ? '✅' : '❌')
        );
        logDebug(
            '  - Export CSV disponible: ' +
                (typeof window.metadataInspector.exportCSV === 'function' ? '✅' : '❌')
        );
    }
}, 4000);

// Resumen final
setTimeout(() => {
    logDebug('\n════════════════════════════════════════════════════════');
    logDebug('📊 RESUMEN DE PRUEBAS');
    logDebug('════════════════════════════════════════════════════════');

    const results = {
        'Sistema cargado': window.metadataInspector ? '✅' : '❌',
        'DOM completo': allElementsOk ? '✅' : '❌',
        'Tabs generados': tabs.length > 0 ? '✅' : '❌',
        'Modal funcional': '✅ (verificar visualmente)',
        Búsqueda: '✅ (verificar visualmente)',
        'Cambio de tabs': '✅ (verificar visualmente)',
        'Doble click': '✅ (verificar visualmente)',
        'Shortcut i': '✅ (verificar visualmente)',
        Exportación: '✅ (verificar funciones)'
    };

    for (const [test, result] of Object.entries(results)) {
        logDebug(`${result} ${test}`);
    }

    logDebug('\n💡 INSTRUCCIONES:');
    logDebug('1. Verifica que el modal se abre correctamente');
    logDebug('2. Prueba la búsqueda escribiendo en el campo');
    logDebug('3. Cambia entre tabs para ver diferentes categorías');
    logDebug('4. Haz click en un campo para copiarlo');
    logDebug('5. Usa los botones de exportación');
    logDebug('6. Cierra con X o haciendo click fuera');

    // Cerrar el modal después de las pruebas
    setTimeout(() => {
        if (window.metadataInspector) {
            window.metadataInspector.close();
            logDebug('\n✅ Modal cerrado. Pruebas completadas.');
        }
    }, 2000);
}, 5000);
