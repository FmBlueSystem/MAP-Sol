// TASK_021: Web Worker para búsqueda y filtrado
// Procesa en background thread para no bloquear UI

self.addEventListener('message', function (e) {
    const { type, data } = e.data;

    switch (type) {
        case 'search':
            performSearch(data);
            break;
        case 'filter':
            performFilter(data);
            break;
        case 'batch':
            performBatchOperation(data);
            break;
    }
});

function performSearch({ items, query, filters }) {
    // Búsqueda rápida sin regex complejos
    const searchTerm = query.toLowerCase();

    const results = items.filter(item => {
        // Búsqueda en campos principales
        if (query) {
            const searchableText = `
                ${item.title || ''} 
                ${item.artist || ''} 
                ${item.album || ''} 
                ${item.file_name || ''}
                ${item.LLM_GENRE || ''}
                ${item.genre || ''}
            `.toLowerCase();

            if (!searchableText.includes(searchTerm)) {
                return false;
            }
        }

        // Aplicar filtros
        if (filters.genre && filters.genre !== '') {
            if (item.LLM_GENRE !== filters.genre && item.genre !== filters.genre) {
                return false;
            }
        }

        if (filters.mood && filters.mood !== '') {
            if (item.AI_MOOD !== filters.mood && item.LLM_MOOD !== filters.mood) {
                return false;
            }
        }

        if (filters.bpmMin !== undefined && filters.bpmMax !== undefined) {
            const bpm = parseInt(item.AI_BPM) || 0;
            if (bpm < filters.bpmMin || bpm > filters.bpmMax) {
                return false;
            }
        }

        if (filters.energyMin !== undefined && filters.energyMax !== undefined) {
            const energy = parseFloat(item.AI_ENERGY) || 0;
            if (energy < filters.energyMin || energy > filters.energyMax) {
                return false;
            }
        }

        return true;
    });

    // Ordenar resultados
    if (filters.sort) {
        sortResults(results, filters.sort);
    }

    self.postMessage({
        type: 'searchComplete',
        results: results,
        count: results.length
    });
}

function performFilter({ items, filters }) {
    // Solo filtrado sin búsqueda
    const results = items.filter(item => {
        // Aplicar cada filtro
        for (const key in filters) {
            const filterValue = filters[key];
            if (filterValue && item[key] !== filterValue) {
                return false;
            }
        }
        return true;
    });

    self.postMessage({
        type: 'filterComplete',
        results: results
    });
}

function performBatchOperation({ items, operation }) {
    // Operaciones batch como análisis, export, etc
    const processed = [];

    for (let i = 0; i < items.length; i++) {
        // Procesar item
        const result = processItem(items[i], operation);
        processed.push(result);

        // Reportar progreso cada 100 items
        if (i % 100 === 0) {
            self.postMessage({
                type: 'progress',
                current: i,
                total: items.length
            });
        }
    }

    self.postMessage({
        type: 'batchComplete',
        results: processed
    });
}

function processItem(item, operation) {
    // TODO: Implementar operaciones específicas
    return item;
}

function sortResults(results, sortType) {
    switch (sortType) {
        case 'artist':
            results.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
            break;
        case 'title':
            results.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            break;
        case 'bpm_asc':
            results.sort((a, b) => (parseInt(a.AI_BPM) || 0) - (parseInt(b.AI_BPM) || 0));
            break;
        case 'bpm_desc':
            results.sort((a, b) => (parseInt(b.AI_BPM) || 0) - (parseInt(a.AI_BPM) || 0));
            break;
        case 'energy_asc':
            results.sort((a, b) => (parseFloat(a.AI_ENERGY) || 0) - (parseFloat(b.AI_ENERGY) || 0));
            break;
        case 'energy_desc':
            results.sort((a, b) => (parseFloat(b.AI_ENERGY) || 0) - (parseFloat(a.AI_ENERGY) || 0));
            break;
    }
}
