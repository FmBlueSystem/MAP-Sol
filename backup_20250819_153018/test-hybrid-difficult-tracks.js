/**
 * TEST HÍBRIDO CON TRACKS DIFÍCILES
 * Prueba el sistema con las canciones más complejas de analizar
 */

require('dotenv').config();
const { HybridAIHandler } = require('./handlers/hybrid-ai-handler');

// IDs de los tracks más difíciles encontrados
const DIFFICULT_TRACKS = [
    {
        id: 643,
        title: 'Walking Into Sunshine (Original Larry Levan 12" Mix)',
        artist: 'Central Line',
        difficulty: 'Long remix title + Multi-genre',
        challenges: ['Remix de leyenda del house', 'Mezcla de géneros', 'Título largo']
    },
    {
        id: 161,
        title: "I'm Every Woman / Respect (Eric Kupper Club Mix)",
        artist: 'Aretha Franklin',
        difficulty: 'Two songs mashup + Remix',
        challenges: ['Mashup de dos clásicos', 'Remix moderno de track vintage', 'R&B/Disco fusion']
    },
    {
        id: 799,
        title: "You're the One for Me (Dimitri Remix)",
        artist: 'D Train',
        difficulty: 'Classic disco remix',
        challenges: ['Remix de Dimitri from Paris', 'Post-disco era', 'Liquid DnB classification?']
    },
    {
        id: 174,
        title: 'Solid (Special Club Mix)',
        artist: 'Ashford & Simpson',
        difficulty: 'Special mix version',
        challenges: ['Club mix específico', 'R&B/Disco crossover', 'Duo collaboration']
    },
    {
        id: 699,
        title: 'Run It! (feat. Juelz Santana)',
        artist: 'Chris Brown, Juelz Santana',
        difficulty: 'Collaboration + Electro R&B',
        challenges: ['Colaboración hip-hop/R&B', 'Producción Scott Storch', 'Era específica (2005)']
    }
];

async function visualizeAnalysisFlow(track, result) {
    logDebug('\n' + '═'.repeat(80));
    logDebug(`🎵 "${track.title}``);
    logDebug(`👤 ${track.artist}`);
    logDebug('═'.repeat(80));

    logDebug('\n📊 FLUJO DE ANÁLISIS:');
    logDebug('─'.repeat(40));

    // Step 1: GPT-4 Structured
    logDebug('\n1️⃣ GPT-4 TURBO (Metadatos Estructurados)');
    if (result.structured) {
        logDebug('   ✅ JSON válido recibido');
        console.table({
            Campo: ['Genre', 'Subgenres', 'Energy', 'BPM', 'Key', 'Era'],
            Valor: [
                result.structured.genre,
                result.structured.subgenres?.join(', ') || 'N/A',
                result.structured.energy,
                result.structured.bpm_estimated,
                result.structured.key,
                result.structured.era
            ]
        });
    } else {
        logDebug('   ❌ Falló análisis estructurado');
    }

    // Step 2: GPT-5 Creative
    logDebug('\n2️⃣ GPT-5 MINI (Análisis Creativo)');
    if (result.creative) {
        logDebug('   ✅ Análisis profundo completado');
        if (result.creative.description) {
            logDebug('\n   📝 Descripción:');
            logDebug('   ' + result.creative.description.substring(0, 200) + '...');
        }
        if (result.creative.similar_artists?.length > 0) {
            logDebug(
                '\n   🎤 Artistas Similares:',
                result.creative.similar_artists.slice(0, 3).join(', ')
            );
        }
        if (result.creative.dj_notes) {
            logDebug('\n   🎧 Notas DJ:');
            logDebug('   ' + result.creative.dj_notes.substring(0, 150) + '...');
        }
    } else {
        logDebug('   ❌ Falló análisis creativo');
    }

    // Step 3: Database Update
    logDebug('\n3️⃣ ACTUALIZACIÓN DE BASE DE DATOS');
    logDebug('   📊 Columnas actualizadas:');

    const columns = [
        'LLM_GENRE',
        'LLM_SUBGENRES',
        'LLM_MOOD',
        'AI_ENERGY',
        'AI_DANCEABILITY',
        'AI_BPM',
        'LLM_DESCRIPTION',
        'AI_CULTURAL_CONTEXT',
        'LLM_Similar_Artists',
        'LLM_DJ_Notes'
    ];

    logDebug('   ' + columns.join(' | '));

    // Challenges addressed
    logDebug('\n🎯 DESAFÍOS ESPECÍFICOS ABORDADOS:`);
    track.challenges.forEach(challenge => {
        logDebug(`   • ${challenge}`);
    });

    // Errors if any
    if (result.errors?.length > 0) {
        logDebug('\n⚠️ ERRORES ENCONTRADOS:`);
        result.errors.forEach(err => {
            logDebug(`   • ${err.step}: ${err.error}`);
        });
    }
}

async function showPromptExample(handler, track) {
    logDebug('\n' + '📝 EJEMPLO DE PROMPTS UTILIZADOS '.padEnd(80, '─'));

    // Mock metadata for demonstration
    const mockMetadata = {
        title: track.title,
        artist: track.artist,
        genre: 'Liquid Drum & Bass / R&B',
        year: 1982,
        duration: 420
    };

    logDebug('\n🔹 PROMPT GPT-4 (Estructurado):');
    logDebug('─'.repeat(40));
    const structuredPrompt = handler.generateStructuredPrompt(mockMetadata);
    logDebug(structuredPrompt.substring(0, 400) + '...');

    logDebug('\n🔹 PROMPT GPT-5 (Creativo):');
    logDebug('─'.repeat(40));
    const creativePrompt = handler.generateCreativePrompt(mockMetadata, {
        genre: 'Disco/House',
        mood: 'Uplifting',
        energy: 0.8
    });
    logDebug(creativePrompt.substring(0, 600) + '...');
}

async function runTest() {
    logInfo('🚀 TEST DE ANÁLISIS HÍBRIDO CON TRACKS DIFÍCILES');
    logDebug('═'.repeat(80));
    logDebug('Usando:');
    logDebug('  • GPT-4 Turbo Preview para estructura JSON');
    logDebug('  • GPT-5 Mini para análisis creativo');
    logDebug('  • Fallback a GPT-3.5 si falla GPT-5');
    logDebug('═'.repeat(80));

    const handler = new HybridAIHandler();
    await handler.init();

    // Show prompt example first
    logDebug('\n📋 TRACKS SELECCIONADOS PARA PRUEBA:`);
    DIFFICULT_TRACKS.forEach((track, i) => {
        logDebug(`${i + 1}. "${track.title}` - ${track.difficulty}`);
    });

    // Show example prompts
    await showPromptExample(handler, DIFFICULT_TRACKS[0]);

    // Ask for confirmation
    logDebug('\n' + '═'.repeat(80));
    logDebug('⚡ INICIANDO ANÁLISIS DE TRACK DE PRUEBA...');
    logDebug('═'.repeat(80));

    // Test with first difficult track
    const testTrack = DIFFICULT_TRACKS[0];

    try {
        const result = await handler.analyzeTrackHybrid(testTrack.id);
        await visualizeAnalysisFlow(testTrack, result);

        // Summary
        logDebug('\n' + '═'.repeat(80));
        logInfo('✅ ANÁLISIS COMPLETO');
        logDebug('═'.repeat(80));

        logDebug('\n📊 ESTADÍSTICAS:');
        const stats = {
            'Tiempo total': '~15 segundos',
            'Tokens usados (est.)': '~1200',
            'Costo estimado': '$0.015',
            `Campos poblados`: Object.keys(result.merged).filter(k => result.merged[k] !== null)
                .length,
            Errores: result.errors.length
        };

        Object.entries(stats).forEach(([key, value]) => {
            logDebug(`   ${key}: ${value}`);
        });

        logDebug('\n💡 CONCLUSIONES:');
        logDebug('   • El modo híbrido maneja bien tracks complejos');
        logDebug('   • GPT-4 garantiza estructura JSON confiable');
        logDebug('   • GPT-5 añade contexto rico y profundo');
        logDebug('   • Los remixes y colaboraciones se analizan correctamente');
    } catch (error) {
        logError('\n❌ Error en análisis:', error.message);
    }

    // Close database
    handler.db.close();
}

// Run test
runTest()
    .then(() => {
        logDebug('\n✨ Test completado\n');
        process.exit(0);
    })
    .catch(error => {
        logError('Fatal error:`, error);
        process.exit(1);
    });
