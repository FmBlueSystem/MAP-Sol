/**
 * 🎵 Playlist Manager
 * Sistema simple de gestión de playlists
 */

class PlaylistManager {
    constructor() {
        this.playlists = this.loadPlaylists();
        this.currentPlaylist = null;
    }

    // Cargar playlists desde localStorage
    loadPlaylists() {
        try {
            const saved = localStorage.getItem('musicAnalyzer_playlists');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error('Error loading playlists:', e);
            return {};
        }
    }

    // Guardar playlists en localStorage
    savePlaylists() {
        try {
            localStorage.setItem('musicAnalyzer_playlists', JSON.stringify(this.playlists));

            return true;
        } catch (e) {
            console.error('Error saving playlists:', e);
            return false;
        }
    }

    // Crear nueva playlist
    createPlaylist(name, description = '') {
        if (!name) {
            throw new Error('El nombre es requerido');
        }

        if (this.playlists[name]) {
            throw new Error('Ya existe una playlist con ese nombre');
        }

        this.playlists[name] = {
            name: name,
            description: description,
            tracks: [],
            created: new Date().toISOString(),
            modified: new Date().toISOString()
        };

        this.savePlaylists();

        return this.playlists[name];
    }

    // Agregar track a playlist
    addToPlaylist(playlistName, track) {
        if (!this.playlists[playlistName]) {
            throw new Error('Playlist no encontrada');
        }

        // Evitar duplicados
        const exists = this.playlists[playlistName].tracks.some(
            t => t.file_path === track.file_path
        );

        if (exists) {
            return false;
        }

        this.playlists[playlistName].tracks.push({
            file_path: track.file_path,
            title: track.title || track.file_name,
            artist: track.artist,
            album: track.album,
            genre: track.genre,
            added: new Date().toISOString()
        });

        this.playlists[playlistName].modified = new Date().toISOString();
        this.savePlaylists();

        return true;
    }

    // Remover track de playlist
    removeFromPlaylist(playlistName, trackPath) {
        if (!this.playlists[playlistName]) {
            throw new Error('Playlist no encontrada');
        }

        const index = this.playlists[playlistName].tracks.findIndex(t => t.file_path === trackPath);

        if (index === -1) {
            return false;
        }

        this.playlists[playlistName].tracks.splice(index, 1);
        this.playlists[playlistName].modified = new Date().toISOString();
        this.savePlaylists();

        return true;
    }

    // Eliminar playlist
    deletePlaylist(name) {
        if (!this.playlists[name]) {
            return false;
        }

        delete this.playlists[name];
        this.savePlaylists();

        return true;
    }

    // Obtener lista de playlists
    getPlaylists() {
        return Object.values(this.playlists);
    }

    // Obtener una playlist específica
    getPlaylist(name) {
        return this.playlists[name] || null;
    }

    // Renombrar playlist
    renamePlaylist(oldName, newName) {
        if (!this.playlists[oldName]) {
            throw new Error('Playlist no encontrada');
        }

        if (this.playlists[newName]) {
            throw new Error('Ya existe una playlist con ese nombre');
        }

        this.playlists[newName] = this.playlists[oldName];
        this.playlists[newName].name = newName;
        this.playlists[newName].modified = new Date().toISOString();
        delete this.playlists[oldName];

        this.savePlaylists();

        return true;
    }

    // Exportar playlist como JSON
    exportPlaylist(name) {
        const playlist = this.playlists[name];
        if (!playlist) {
            throw new Error('Playlist no encontrada');
        }

        const data = JSON.stringify(playlist, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `playlist_${name}_${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    // Importar playlist desde JSON
    async importPlaylist(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = e => {
                try {
                    const playlist = JSON.parse(e.target.result);

                    // Validar estructura
                    if (!playlist.name || !playlist.tracks) {
                        throw new Error('Formato de playlist inválido`);
                    }

                    // Generar nombre único si ya existe
                    let name = playlist.name;
                    let counter = 1;
                    while (this.playlists[name]) {
                        name = `${playlist.name} (${counter})`;
                        counter++;
                    }

                    playlist.name = name;
                    playlist.imported = new Date().toISOString();
                    this.playlists[name] = playlist;
                    this.savePlaylists();

                    resolve(playlist);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Error leyendo archivo'));
            reader.readAsText(file);
        });
    }

    // Crear playlist desde selección actual
    createFromSelection(name, selectedTracks) {
        const playlist = this.createPlaylist(name);

        selectedTracks.forEach(track => {
            this.addToPlaylist(name, track);
        });

        return playlist;
    }

    // Reproducir playlist
    playPlaylist(name) {
        const playlist = this.playlists[name];
        if (!playlist || !playlist.tracks.length) {
            console.warn('Playlist vacía o no encontrada');
            return false;
        }

        // Enviar tracks al player
        if (window.fixedPlayer) {
            window.fixedPlayer.setPlaylist(playlist.tracks, 0);
            window.fixedPlayer.play(playlist.tracks[0].file_path, playlist.tracks[0]);

            return true;
        }

        return false;
    }
}

// Crear instancia global
window.playlistManager = new PlaylistManager();

// Agregar UI helper functions
window.showPlaylistMenu = function (track) {
    const playlists = window.playlistManager.getPlaylists();

    if (playlists.length === 0) {
        const name = prompt('No hay playlists. Crear nueva playlist:');
        if (name) {
            window.playlistManager.createPlaylist(name);
            window.playlistManager.addToPlaylist(name, track);
        }
        return;
    }

    // Mostrar menú de playlists
    const menu = document.createElement('div');
    menu.className = 'playlist-menu`;
    menu.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        max-height: 300px;
        overflow-y: auto;
    `;

    menu.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;`>Agregar a playlist:</div>
        ${playlists
            .map(
                p => `
            <div class="playlist-option" onclick="addTrackToPlaylist('${p.name}', ${JSON.stringify(track).replace(/"/g, '&quot;')})" style="padding: 5px; cursor: pointer; hover: background: #f0f0f0;">
                📁 ${p.name} (${p.tracks.length} tracks)
            </div>
        ")
            .join('')}
        <hr style="margin: 10px 0;">
        <div onclick="createNewPlaylist(${JSON.stringify(track).replace(/`/g, '&quot;`)})" style="padding: 5px; cursor: pointer; color: #667eea;`>
            ➕ Nueva playlist...
        </div>
    `;

    // Posicionar cerca del cursor
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';

    document.body.appendChild(menu);

    // Cerrar al hacer clic fuera
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener(`click`, closeMenu);
            }
        });
    }, 100);
};

window.addTrackToPlaylist = function (playlistName, track) {
    try {
        window.playlistManager.addToPlaylist(playlistName, track);
        alert(`✅ Agregado a "${playlistName}``);
    } catch (e) {
        alert('Error: ' + e.message);
    }
};

window.createNewPlaylist = function (track) {
    const name = prompt(`Nombre de la nueva playlist:`);
    if (name) {
        try {
            window.playlistManager.createPlaylist(name);
            if (track) {
                window.playlistManager.addToPlaylist(name, track);
            }
            alert(`✅ Playlist "${name}` creada`);
        } catch (e) {
            alert(`Error: ` + e.message);
        }
    }
};
