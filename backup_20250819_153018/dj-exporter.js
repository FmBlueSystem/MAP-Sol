// TASK_027: Export DJ Formats - M3U, Rekordbox XML, Serato Crate
const fs = require('fs');
const path = require('path');
const xmlbuilder = require('xmlbuilder');

class DJExporter {
    constructor() {
        this.formats = ['m3u', 'rekordbox', 'serato', 'traktor'];
    }

    // Exportar a M3U/M3U8 playlist
    exportM3U(tracks, playlistName = 'Playlist') {
        let content = '#EXTM3U\n';
        content += `#PLAYLIST:${playlistName}\n\n`;

        tracks.forEach(track => {
            const duration = track.duration || -1;
            const artist = track.artist || 'Unknown';
            const title = track.title || track.file_name;

            content += `#EXTINF:${duration},${artist} - ${title}\n`;
            content += `${track.file_path}\n`;
        });

        return {
            format: 'm3u',
            content: content,
            extension: '.m3u'
        };
    }

    // Exportar a Rekordbox XML
    exportRekordbox(tracks, collectionName = 'Collection') {
        const xml = xmlbuilder
            .create('DJ_PLAYLISTS', { version: '1.0.0', encoding: 'UTF-8' })
            .att('Version', '1.0.0');

        const product = xml
            .ele('PRODUCT')
            .att('Name', 'Music Analyzer Pro')
            .att('Version', '1.0')
            .att('Company', 'MusicAnalyzer');

        const collection = xml.ele('COLLECTION').att('Entries', tracks.length);

        tracks.forEach((track, index) => {
            const trackEle = collection
                .ele('TRACK')
                .att('TrackID', index + 1)
                .att('Name', track.title || track.file_name)
                .att('Artist', track.artist || '')
                .att('Album', track.album || '')
                .att('Genre', track.LLM_GENRE || track.genre || '')
                .att('Kind', track.file_extension || 'mp3')
                .att('Location', `file://localhost${track.file_path}`)
                .att('TotalTime', track.duration || 0)
                .att('DiscNumber', 1)
                .att('TrackNumber', index + 1)
                .att('BitRate', track.bitrate || 320)
                .att('SampleRate', track.sample_rate || 44100)
                .att('Comments', track.AI_MOOD || '')
                .att('AverageBpm', track.AI_BPM || track.existing_bmp || 0)
                .att('DateAdded', new Date().toISOString())
                .att('Tonality', track.AI_KEY || track.key || '');

            // Agregar cue points si existen
            if (track.cue_points) {
                track.cue_points.forEach((cue, i) => {
                    trackEle
                        .ele('POSITION_MARK')
                        .att('Name', cue.name || `Cue ${i + 1}`)
                        .att('Type', 'cue')
                        .att('Start', cue.position || 0)
                        .att('Num', i)
                        .att('Red', 255)
                        .att('Green', 0)
                        .att('Blue', 0);
                });
            }

            // Agregar tempo analysis
            if (track.AI_BPM) {
                trackEle
                    .ele('TEMPO')
                    .att('Inizio', 0)
                    .att('Bpm', track.AI_BPM)
                    .att('Metro', track.AI_TIME_SIGNATURE || '4/4')
                    .att('Battito', 1);
            }
        });

        // Agregar playlists
        const playlists = xml.ele('PLAYLISTS');
        const root = playlists.ele('NODE').att('Type', '0').att('Name', 'ROOT').att('Count', '1');

        const playlist = root
            .ele('NODE')
            .att('Name', collectionName)
            .att('Type', '1')
            .att('KeyType', '0')
            .att('Entries', tracks.length);

        tracks.forEach((track, index) => {
            playlist.ele('TRACK').att('Key', index + 1);
        });

        return {
            format: 'rekordbox',
            content: xml.end({ pretty: true }),
            extension: '.xml'
        };
    }

    // Exportar a Serato Crate
    exportSerato(tracks, crateName = 'Crate') {
        // Serato usa formato binario .crate, aquí generamos un CSV compatible
        let content = 'name,artist,album,genre,bpm,key,comment,location\n';

        tracks.forEach(track => {
            const row = [
                track.title || track.file_name,
                track.artist || '',
                track.album || '',
                track.LLM_GENRE || track.genre || '',
                track.AI_BPM || track.existing_bmp || '',
                track.AI_KEY || track.key || '',
                track.AI_MOOD || '',
                track.file_path
            ];

            // Escapar commas y quotes
            const escaped = row.map(field => {
                const str = String(field);
                if (str.includes(',') || str.includes('"')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            });

            content += escaped.join(',') + '\n';
        });

        return {
            format: 'serato',
            content: content,
            extension: '.csv',
            instructions: 'Import this CSV file into Serato using File > Import'
        };
    }

    // Exportar a Traktor NML
    exportTraktor(tracks, collectionName = 'Collection') {
        const xml = xmlbuilder
            .create('NML', { version: '19', encoding: 'UTF-8' })
            .att('VERSION', '19');

        const head = xml
            .ele('HEAD')
            .att('COMPANY', 'Music Analyzer Pro')
            .att('PROGRAM', 'Music Analyzer');

        const collection = xml.ele('COLLECTION').att('ENTRIES', tracks.length);

        tracks.forEach((track, index) => {
            const entry = collection
                .ele('ENTRY')
                .att('MODIFIED_DATE', new Date().toISOString())
                .att('MODIFIED_TIME', Math.floor(Date.now() / 1000))
                .att('AUDIO_ID', 'track_' + index)
                .att('TITLE', track.title || track.file_name)
                .att('ARTIST', track.artist || '');

            // Location info
            entry
                .ele('LOCATION')
                .att('DIR', path.dirname(track.file_path))
                .att('FILE', path.basename(track.file_path))
                .att('VOLUME', 'Macintosh HD')
                .att('VOLUMEID', 'macosx');

            // Album info
            if (track.album) {
                entry.ele('ALBUM').att('TITLE', track.album);
            }

            // Musical info
            entry
                .ele('INFO')
                .att('BITRATE', track.bitrate || 320000)
                .att('GENRE', track.LLM_GENRE || track.genre || '')
                .att('COMMENT', track.AI_MOOD || '')
                .att('PLAYTIME', track.duration || 0)
                .att('IMPORT_DATE', new Date().toISOString())
                .att('RELEASE_DATE', track.year || '')
                .att('FLAGS', 0)
                .att('FILESIZE', track.file_size || 0);

            // Tempo info
            entry
                .ele('TEMPO')
                .att('BPM', track.AI_BPM || track.existing_bmp || 0)
                .att('BPM_QUALITY', track.AI_BPM ? 100 : 0);

            // Musical key
            if (track.AI_KEY || track.key) {
                entry
                    .ele('MUSICAL_KEY')
                    .att('VALUE', this.convertKeyToTraktor(track.AI_KEY || track.key));
            }

            // Loudness
            entry
                .ele('LOUDNESS')
                .att('PEAK_DB', track.AI_LOUDNESS || -6)
                .att('AVG_DB', track.AI_LOUDNESS ? track.AI_LOUDNESS - 3 : -9);

            // CUE points
            const cueV2 = entry.ele('CUE_V2');
            if (track.cue_points) {
                track.cue_points.forEach((cue, i) => {
                    cueV2
                        .ele('CUE')
                        .att('NAME', cue.name || `Cue ${i + 1}`)
                        .att('DISPL_ORDER', i)
                        .att('TYPE', 0) // 0=cue, 4=loop
                        .att('START', cue.position || 0)
                        .att('LEN', 0)
                        .att('REPEATS', -1)
                        .att('HOTCUE', i);
                });
            }
        });

        // Playlists
        const playlists = xml.ele('PLAYLISTS');
        const node = playlists.ele('NODE').att('TYPE', 'FOLDER').att('NAME', '$ROOT');

        const playlist = node
            .ele('SUBNODES')
            .ele('NODE')
            .att('TYPE', 'PLAYLIST')
            .att('NAME', collectionName);

        const playlistEntries = playlist
            .ele('PLAYLIST')
            .att('ENTRIES', tracks.length)
            .att('TYPE', 'LIST')
            .att('UUID', this.generateUUID());

        tracks.forEach((track, index) => {
            playlistEntries
                .ele('ENTRY')
                .ele('PRIMARYKEY')
                .att('TYPE', 'TRACK')
                .att('KEY', 'track_' + index);
        });

        return {
            format: 'traktor',
            content: xml.end({ pretty: true }),
            extension: '.nml'
        };
    }

    // Convertir key a formato Traktor
    convertKeyToTraktor(key) {
        const keyMap = {
            C: 0,
            'C#': 1,
            Db: 1,
            D: 2,
            'D#': 3,
            Eb: 3,
            E: 4,
            F: 5,
            'F#': 6,
            Gb: 6,
            G: 7,
            'G#': 8,
            Ab: 8,
            A: 9,
            'A#': 10,
            Bb: 10,
            B: 11
        };

        if (!key) {
            return 0;
        }

        const isMinor = key.toLowerCase().includes('m');
        const note = key.replace(/m|maj|min|Major|Minor/gi, '').trim();
        const noteValue = keyMap[note] || 0;

        // Traktor usa: 0-11 para mayor, 12-23 para menor
        return isMinor ? noteValue + 12 : noteValue;
    }

    // Generar UUID para Traktor
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    // Método principal de exportación
    async export(tracks, format, options = {}) {
        const name = options.name || 'Export';
        let result;

        switch (format.toLowerCase()) {
            case 'm3u':
            case 'm3u8':
                result = this.exportM3U(tracks, name);
                break;
            case 'rekordbox':
            case 'rb':
            case 'xml':
                result = this.exportRekordbox(tracks, name);
                break;
            case 'serato':
            case 'crate':
                result = this.exportSerato(tracks, name);
                break;
            case 'traktor':
            case 'nml':
                result = this.exportTraktor(tracks, name);
                break;
            default:
                throw new Error(`Formato no soportado: ${format}`);
        }

        // Si se proporciona path, guardar archivo
        if (options.savePath) {
            const filename = `${name}_${new Date().toISOString().slice(0, 10)}${result.extension}`;
            const filepath = path.join(options.savePath, filename);
            fs.writeFileSync(filepath, result.content);
            result.savedTo = filepath;
        }

        return result;
    }

    // Obtener formatos soportados
    getSupportedFormats() {
        return [
            {
                id: 'm3u',
                name: 'M3U Playlist',
                extension: '.m3u',
                description: 'Universal playlist format'
            },
            {
                id: 'rekordbox',
                name: 'Rekordbox XML',
                extension: '.xml',
                description: 'Pioneer DJ Rekordbox'
            },
            {
                id: 'serato',
                name: 'Serato CSV',
                extension: '.csv',
                description: 'Serato DJ Pro (import via CSV)'
            },
            {
                id: 'traktor',
                name: 'Traktor NML',
                extension: '.nml',
                description: 'Native Instruments Traktor'
            }
        ];
    }
}

module.exports = { DJExporter };
