# 📱 UI/UX Design Documentation - MAP (Music Analyzer Pro)
**Fecha**: 2025-08-15
**Versión**: 1.0.0
**Estado**: Diseño Completo ASCII

---

## 📊 ÍNDICE

1. [Arquitectura de UI](#arquitectura-de-ui)
2. [Layout Principal](#layout-principal)
3. [Componentes Detallados](#componentes-detallados)
4. [Flujos de Usuario](#flujos-de-usuario)
5. [Pantallas y Modales](#pantallas-y-modales)
6. [Interacciones y Gestos](#interacciones-y-gestos)
7. [Estados y Feedback](#estados-y-feedback)
8. [Navegación y Shortcuts](#navegación-y-shortcuts)

---

## 🏗️ ARQUITECTURA DE UI

### Principios de Diseño
- **Tres Paneles Principales**: Navegación | Contenido | Detalles
- **Diseño Responsive**: Adaptable a diferentes tamaños
- **Feedback Visual Inmediato**: Cada acción tiene respuesta visual
- **Drag & Drop Universal**: Todo es arrastrable donde tiene sentido
- **Keyboard-First**: Todas las acciones tienen shortcut

### Estructura de Componentes
```
MAP Application
├── Header Bar (Global Controls)
├── Main Container
│   ├── Left Panel (Playlists Tree)
│   ├── Center Panel (Track List)
│   └── Right Panel (Track Info & HAMMS)
└── Player Bar (Now Playing)
```

---

## 🖼️ LAYOUT PRINCIPAL

### Vista Completa de la Aplicación

```ascii
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ MAP - Music Analyzer Pro                                      [🔍] Search        👤 User     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                               │
│ ┌──────────────────────┬────────────────────────────────────┬──────────────────────────────┐│
│ │ 📚 PLAYLISTS         │ 🎵 TRACK LIST                      │ 📊 TRACK INFO               ││
│ │ ═══════════════════ │ ══════════════════════════════════ │ ═════════════════════════════││
│ │                      │                                    │                              ││
│ │ 📂 All Tracks (3767) │ ┌─┬─────────────────┬──────┬────┬─┐│ Title: Titanium             ││
│ │                      │ │▶│ Titanium        │128bpm│4:32│♥││ Artist: David Guetta        ││
│ │ ▼ 🎯 Smart Playlists │ ├─┼─────────────────┼──────┼────┼─┤│ BPM: 128                    ││
│ │   ├─ 🔥 High Energy  │ │ │ Animals         │128bpm│3:45│ ││ Key: 8A (Am)                ││
│ │   ├─ 😌 Chill Vibes  │ ├─┼─────────────────┼──────┼────┼─┤│ Energy: ████████░░ 85%      ││
│ │   ├─ 🌅 Warm Up      │ │ │ Clarity         │128bpm│4:31│ ││ Genre: Progressive House    ││
│ │   └─ 🚀 Peak Time    │ ├─┼─────────────────┼──────┼────┼─┤│                             ││
│ │                      │ │ │ Language        │128bpm│3:58│♥││ ┌─────────────────────────┐││
│ │ ▼ 📁 My Playlists    │ ├─┼─────────────────┼──────┼────┼─┤│ │ HAMMS Similarity: 92%   │││
│ │   ├─ Summer 2024     │ │ │ Wake Me Up      │128bpm│4:09│ ││ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░  │││
│ │   ├─ House Classics  │ ├─┼─────────────────┼──────┼────┼─┤│ └─────────────────────────┘││
│ │   ├─ Techno Journey  │ │ │ Levels          │128bpm│3:19│ ││                             ││
│ │   └─ 📂 Festival Sets│ ├─┼─────────────────┼──────┼────┼─┤│ Compatible Keys:            ││
│ │       ├─ Tomorrowland│ │ │ Reload          │128bpm│3:12│ ││ [8A] [7A] [9A] [8B]        ││
│ │       └─ Ultra Miami │ └─┴─────────────────┴──────┴────┴─┘│                             ││
│ │                      │                                    │ Energy Flow:                ││
│ │ ▼ 🎨 By Mood         │ [1][2][3]...[45][46][47] Next>   │ ╱╲    ╱╲                    ││
│ │   ├─ Happy           │                                    │╱  ╲__╱  ╲___                ││
│ │   ├─ Dark            │ ┌────────────────────────────────┐│                             ││
│ │   ├─ Melancholic     │ │ ⚡ Quick Actions               ││ [🎯 Find Similar]           ││
│ │   └─ Euphoric        │ │ [+ Add to Queue] [▶ Play Next]││ [➕ Add to Playlist]        ││
│ │                      │ │ [📋 Copy] [✏️ Edit] [🗑️ Delete]││ [📤 Export Selection]       ││
│ │ [+ New Playlist]     │ └────────────────────────────────┘│                             ││
│ └──────────────────────┴────────────────────────────────────┴──────────────────────────────┘│
│                                                                                               │
│ ═══════════════════════════════════════════════════════════════════════════════════════════ │
│ ▶ Now Playing: Titanium - David Guetta ft. Sia      02:34 ━━━━━━●━━━━━━ 04:32    🔊 ███████ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Dimensiones y Proporción
- **Panel Izquierdo**: 20% del ancho (mínimo 200px)
- **Panel Central**: 50% del ancho (flexible)
- **Panel Derecho**: 30% del ancho (mínimo 300px)
- **Player Bar**: Altura fija 80px

---

## 🧩 COMPONENTES DETALLADOS

### 1. Panel Izquierdo - Árbol de Playlists

```ascii
┌─────────────────────────┐
│ 📚 PLAYLISTS           │
│ ═══════════════════════│
│                         │
│ 🔍 Filter playlists... │
│ ─────────────────────── │
│                         │
│ 📂 Library              │
│ ├─ All Tracks (3,767)   │
│ ├─ Recently Added (45)  │
│ ├─ Most Played (100)    │
│ └─ Favorites ♥ (234)    │
│                         │
│ 🎯 Smart Playlists      │
│ ├─ 🔥 High Energy       │
│ │   Rules: Energy > 80  │
│ │   Auto-updating: ✓    │
│ ├─ 😌 Chill Vibes       │
│ ├─ 🌅 Morning Warm-up   │
│ ├─ 🚀 Peak Time Bangers │
│ └─ 🎵 Harmonic Journey  │
│                         │
│ 📁 My Playlists         │
│ ├─ Summer 2024 (89)     │
│ ├─ House Classics (156) │
│ ├─ 📂 Festival Sets     │
│ │   ├─ Tomorrowland '24 │
│ │   ├─ Ultra Miami      │
│ │   └─ Burning Man      │
│ └─ 📂 B2B with John     │
│                         │
│ 🏷️ Tags                 │
│ ├─ #vocal (234)         │
│ ├─ #underground (567)   │
│ ├─ #mainstage (123)     │
│ └─ #classic (89)        │
│                         │
│ ┌─────────────────────┐ │
│ │ + Create Playlist   │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

**Características:**
- Estructura jerárquica con carpetas
- Iconos visuales para identificación rápida
- Contadores de tracks en tiempo real
- Smart Playlists con indicador de reglas
- Sección de tags personalizada
- Búsqueda/filtro integrado

### 2. Panel Central - Lista de Tracks

```ascii
┌──────────────────────────────────────────────────────────┐
│ Current: "Summer 2024" - 89 tracks, 5h 23m              │
│ ──────────────────────────────────────────────────────── │
│                                                          │
│ [Select All] [Clear] Sort: Energy ↓ [BPM][Key][Added]   │
│                                                          │
│ ┌──┬──────────────────────┬─────┬─────┬────┬──────┬───┐│
│ │# │ Title / Artist       │ BPM │ Key │Time│Energy│ ♥ ││
│ ├──┼──────────────────────┼─────┼─────┼────┼──────┼───┤│
│ │1 │🎵 Titanium           │ 128 │ 8A  │4:32│ ████ │ ♥ ││
│ │  │   David Guetta       │     │     │    │  85% │   ││
│ ├──┼──────────────────────┼─────┼─────┼────┼──────┼───┤│
│ │2 │🎵 Animals            │ 128 │ 8A  │3:45│ ████ │   ││
│ │  │   Martin Garrix      │     │     │    │  82% │   ││
│ ├──┼──────────────────────┼─────┼─────┼────┼──────┼───┤│
│ │3 │🎵 Clarity           │ 128 │ 2A  │4:31│ ███  │ ♥ ││
│ │  │   Zedd              │     │     │    │  75% │   ││
│ ├──┼──────────────────────┼─────┼─────┼────┼──────┼───┤│
│ │  │ ⋮ (Drag tracks here)│     │     │    │      │   ││
│ └──┴──────────────────────┴─────┴─────┴────┴──────┴───┘│
│                                                          │
│ Drop Zone: [Drop files here to add to playlist]         │
│                                                          │
│ [◀ Previous] Page 1 of 5 [Next ▶]   Showing 1-20 of 89 │
└──────────────────────────────────────────────────────────┘
```

**Características:**
- Información de playlist en header
- Controles de selección y ordenamiento
- Columnas configurables
- Energy bars visuales
- Favoritos con un click
- Drop zone para archivos externos
- Paginación inteligente

### 3. Panel Derecho - Track Info & HAMMS

```ascii
┌────────────────────────────┐
│ 📊 TRACK DETAILS          │
│ ══════════════════════════│
│                            │
│ 🎵 Titanium                │
│ 👤 David Guetta ft. Sia    │
│ 💿 Nothing but the Beat    │
│ 📅 2011                    │
│                            │
│ ┌──────────────────────┐  │
│ │                      │  │
│ │   [Album Artwork]    │  │
│ │                      │  │
│ └──────────────────────┘  │
│                            │
│ Technical Info:            │
│ ─────────────────          │
│ Format: MP3 320kbps        │
│ BPM: 128.00                │
│ Key: 8A (A minor)          │
│ Energy: ████████░░ 85%     │
│ Danceability: ███████░ 78% │
│ Valence: ██████░░░░ 62%    │
│                            │
│ ┌──────────────────────┐  │
│ │ 🎯 HAMMS Analysis    │  │
│ ├──────────────────────┤  │
│ │ Similarity Vector:   │  │
│ │ BPM    ████████ 1.0  │  │
│ │ Energy ███████░ 0.85 │  │
│ │ Dance  ██████░░ 0.78 │  │
│ │ Valence████░░░░ 0.62 │  │
│ │ Key    █████████ 1.0 │  │
│ │                      │  │
│ │ Overall Match: 92%   │  │
│ └──────────────────────┘  │
│                            │
│ [Find Similar Tracks]      │
│ [Create HAMMS Playlist]    │
│ [Analyze Transition]       │
└────────────────────────────┘
```

**Características:**
- Metadata completa del track
- Artwork prominente
- Información técnica detallada
- Visualización de atributos con barras
- HAMMS vector analysis
- Acciones contextuales

---

## 🔄 FLUJOS DE USUARIO

### Flujo 1: Crear Playlist Manual

```mermaid
Start → Click [+ New Playlist] → Enter Name → Select Icon/Color → Create
         ↓
    Playlist Created
         ↓
    Drag Tracks from Library → Drop in Playlist
         ↓
    Reorder Tracks (Drag & Drop)
         ↓
    Save Playlist
```

```ascii
User Journey:
[Library] ──drag──> [Empty Playlist] ──drop──> [Track Added]
                           ↓
                    [Reorder by dragging]
                           ↓
                    [Playlist Ready]
```

### Flujo 2: Crear Smart Playlist

```ascii
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Click Smart  │ --> │ Define Rules │ --> │   Preview    │
│   Playlist   │     │   (Modal)    │     │   Results    │
└──────────────┘     └──────────────┘     └──────────────┘
                            ↓
                     ┌──────────────┐
                     │ Save & Auto  │
                     │    Update     │
                     └──────────────┘
```

**Pasos detallados:**
1. Click en "Smart Playlists" → "Create New"
2. Modal se abre con constructor de reglas
3. Agregar reglas (Genre = Techno AND BPM > 130)
4. Preview muestra tracks que coinciden
5. Ajustar reglas si es necesario
6. Guardar → Playlist se actualiza automáticamente

### Flujo 3: HAMMS Recommendation Flow

```ascii
Track Selected
      ↓
[Analyze with HAMMS]
      ↓
┌─────────────────────────────────┐
│  Show Similar Tracks (0-100%)   │
│  ┌─────┬─────┬─────┬─────┐     │
│  │ 95% │ 92% │ 89% │ 87% │     │
│  └─────┴─────┴─────┴─────┘     │
└─────────────────────────────────┘
      ↓
[Select Tracks] → [Create Playlist]
      ↓
Auto-ordered by similarity
```

### Flujo 4: Transition Analysis

```ascii
Track A Playing
      ↓
Select Track B
      ↓
[Analyze Transition]
      ↓
┌────────────────────────────────────┐
│ Transition Report:                 │
│ • Harmonic Match: ✓ (8A → 8A)     │
│ • BPM Compatible: ✓ (128 → 128)   │
│ • Energy Flow: ⚠️ (85% → 60%)     │
│ • Suggested Mix Point: 3:45       │
│ • Technique: Long blend (32 bars) │
└────────────────────────────────────┘
      ↓
[Add to Queue] or [Practice Mix]
```

---

## 🖼️ PANTALLAS Y MODALES

### Modal 1: Create Smart Playlist

```ascii
┌─────────────────────────────────────────────────────┐
│ Create Smart Playlist                            [X]│
│ ───────────────────────────────────────────────────│
│                                                     │
│ Name: [Peak Time Techno_____________]              │
│                                                     │
│ Icon: [🚀] Color: [█████]                          │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ Rules (ALL must match)                      │   │
│ │                                              │   │
│ │ [Genre    ▼] [contains ▼] [techno_____]  [X]│   │
│ │ [BPM      ▼] [between  ▼] [130] to [140] [X]│   │
│ │ [Energy   ▼] [greater  ▼] [75_________]  [X]│   │
│ │ [Year     ▼] [after    ▼] [2020_______]  [X]│   │
│ │                                              │   │
│ │ [+ Add Rule]                                 │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Logic: [Match ALL rules ▼]                         │
│                                                     │
│ Preview: 47 tracks match these criteria            │
│                                                     │
│ [❌ Cancel]                    [✅ Create Playlist] │
└─────────────────────────────────────────────────────┘
```

### Modal 2: HAMMS Recommendations

```ascii
┌──────────────────────────────────────────────────┐
│ 🎯 HAMMS Recommendations for: "Titanium"        │
│ ────────────────────────────────────────────────│
│                                                  │
│ Similarity  Track                    Action     │
│ ─────────  ─────────────────────    ──────     │
│ 95% ████   Animals - Martin Garrix   [+ Add]   │
│ 92% ████   Clarity - Zedd            [+ Add]   │
│ 89% ███░   Levels - Avicii           [+ Add]   │
│ 87% ███░   Wake Me Up - Avicii       [+ Add]   │
│ 85% ███░   Language - Porter Robinson[+ Add]   │
│                                                  │
│ ┌────────────────────────────────────────────┐  │
│ │ 7D Vector Comparison                       │  │
│ │   Source  →  Target                        │  │
│ │ BPM: 128  →  128 ✓                         │  │
│ │ Key: 8A   →  8A  ✓                         │  │
│ │ Eng: 85%  →  82% ≈                         │  │
│ │ Dan: 78%  →  80% ≈                         │  │
│ │ Val: 62%  →  65% ≈                         │  │
│ └────────────────────────────────────────────┘  │
│                                                  │
│ [Create Playlist from These]  [Adjust Weights]  │
└──────────────────────────────────────────────────┘
```

### Modal 3: Edit Track Metadata

```ascii
┌─────────────────────────────────────────────────┐
│ Edit Track Information                       [X]│
│ ───────────────────────────────────────────────│
│                                                 │
│ Title:  [Titanium_____________________]        │
│ Artist: [David Guetta ft. Sia_________]        │
│ Album:  [Nothing but the Beat_________]        │
│ Year:   [2011]  Genre: [Progressive House ▼]   │
│                                                 │
│ ┌───────────────────────────────────────────┐ │
│ │ Technical Details                         │ │
│ │ BPM:    [128.00] [Tap] [Detect]          │ │
│ │ Key:    [8A     ▼] [Analyze]             │ │
│ │ Energy: [85]% ──────●────────             │ │
│ │ Rating: ⭐⭐⭐⭐☆                           │ │
│ └───────────────────────────────────────────┘ │
│                                                 │
│ Tags: [#vocal] [#mainstage] [#anthem] [+]     │
│                                                 │
│ Notes: [Great for peak time sets_____]         │
│        [_____________________________]         │
│                                                 │
│ [Cancel]            [Reset]       [Save Changes]│
└─────────────────────────────────────────────────┘
```

### Modal 4: Transition Analyzer

```ascii
┌───────────────────────────────────────────────────┐
│ 🔄 Transition Analyzer                        [X]│
│ ─────────────────────────────────────────────────│
│                                                   │
│ Track A: Titanium (128 BPM, 8A)                  │
│ Track B: Animals (128 BPM, 8A)                   │
│                                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ Compatibility Analysis                      │ │
│ │                                              │ │
│ │ Harmonic: ████████████ 100% (Perfect)      │ │
│ │ BPM:      ████████████ 100% (Same)         │ │
│ │ Energy:   █████████░░░  82% (Good)         │ │
│ │ Genre:    ████████████ 100% (Same)         │ │
│ │                                              │ │
│ │ Overall:  ████████████  95% EXCELLENT      │ │
│ └─────────────────────────────────────────────┘ │
│                                                   │
│ Recommended Transition:                          │
│ • Type: Long Blend (32 bars)                    │
│ • Start mixing at: 3:30 (Track A)               │
│ • Bring in Track B at: Bar 96                   │
│ • EQ Strategy: Gradual bass swap                │
│ • Effect: Optional reverb on Track A exit       │
│                                                   │
│ [Practice This Mix]        [Add to Transition Log]│
└───────────────────────────────────────────────────┘
```

### Modal 5: Energy Flow Planner

```ascii
┌──────────────────────────────────────────────────────┐
│ 📈 Energy Flow Planner - 2 Hour Set              [X]│
│ ──────────────────────────────────────────────────── │
│                                                       │
│  100 ┤                            ╱╲                 │
│   90 ┤                          ╱╱  ╲                │
│   80 ┤                        ╱╱    ╲╲              │
│   70 ┤                      ╱╱       ╲╲             │
│   60 ┤                    ╱╱         ╲╲            │
│   50 ┤                  ╱╱            ╲╲           │
│   40 ┤                ╱╱               ╲╲          │
│   30 ┤              ╱╱                  ╲╲         │
│   20 ┤            ╱╱                     ╲╲        │
│   10 ┤__________╱╱                        ╲╲_____  │
│    0 └────┬────┬────┬────┬────┬────┬────┬────┬────┤ │
│        0   15   30   45   60   75   90  105  120min │
│                                                       │
│ Phases: [Warmup][Build][Peak][Maintain][Cooldown]   │
│                                                       │
│ Current Playlist Energy Match: 78%                   │
│ Suggested Tracks to Add: 12                          │
│                                                       │
│ [Auto-Fill Gaps]  [Manual Adjust]  [Apply Template]  │
└──────────────────────────────────────────────────────┘
```

---

## 🎮 INTERACCIONES Y GESTOS

### Drag & Drop Operations

```ascii
SOURCE                 ACTION              DESTINATION
──────                 ──────              ───────────
Track in Library   →   DRAG        →      Playlist
Track in Playlist →   DRAG        →      Different Position
Multiple Tracks    →   CTRL+DRAG   →      New Playlist
Playlist          →   DRAG        →      Another Folder
External Files    →   DRAG        →      Drop Zone
```

### Multi-Selection Patterns

```ascii
Click Operations:
┌─────────────────────────────┐
│ □ Track 1                   │ ← Click: Select
│ ☑ Track 2                   │ ← Ctrl+Click: Add to selection
│ ☑ Track 3                   │ ← Shift+Click: Range select
│ ☑ Track 4                   │
│ □ Track 5                   │
└─────────────────────────────┘

Keyboard Selection:
↑/↓        : Navigate
Space      : Toggle selection
Shift+↑/↓  : Extend selection
Ctrl+A     : Select all
```

### Context Menu Actions

```ascii
Right-Click on Track:
┌──────────────────────┐
│ ▶ Play               │
│ + Add to Queue       │
│ ♥ Add to Favorites  │
│ ──────────────────── │
│ 📋 Copy              │
│ ✂️ Cut               │
│ 📌 Paste             │
│ ──────────────────── │
│ ✏️ Edit Info         │
│ 🎯 Find Similar      │
│ 🔄 Analyze Transition│
│ ──────────────────── │
│ 🗑️ Remove            │
└──────────────────────┘
```

---

## 🎨 ESTADOS Y FEEDBACK

### Visual States for Tracks

```ascii
Normal State:        │ 🎵 Track Name │
Hover State:         │ 🎵 Track Name │ (highlighted background)
Selected State:      │ ☑ Track Name  │ (blue background)
Playing State:       │ ▶ Track Name  │ (green indicator)
Loading State:       │ ⟳ Track Name  │ (spinning icon)
Error State:         │ ⚠️ Track Name │ (red text)
Dragging State:      │ 👆 Track Name │ (semi-transparent)
```

### Feedback Messages

```ascii
Success Toast:
┌────────────────────────────┐
│ ✅ Playlist created        │
│    "Summer Vibes" saved    │
└────────────────────────────┘

Error Toast:
┌────────────────────────────┐
│ ❌ Error loading track     │
│    File not found          │
└────────────────────────────┘

Info Toast:
┌────────────────────────────┐
│ ℹ️ Analyzing tracks...     │
│    23 of 89 processed      │
└────────────────────────────┘
```

### Loading States

```ascii
Playlist Loading:
┌─────────────────────┐
│ 📚 PLAYLISTS        │
│ ═══════════════════ │
│                     │
│ ⟳ Loading...        │
│ ░░░░░░░░░░░░░░░░   │
│                     │
└─────────────────────┘

Track Analysis:
┌─────────────────────────┐
│ Analyzing with HAMMS... │
│ ████████░░░░░░░ 60%    │
│ Finding similar tracks  │
└─────────────────────────┘
```

---

## ⌨️ NAVEGACIÓN Y SHORTCUTS

### Global Shortcuts

```ascii
┌─────────────────────────────────────┐
│ PLAYBACK                            │
│ Space       Play/Pause              │
│ →           Next Track              │
│ ←           Previous Track          │
│ ↑           Volume Up               │
│ ↓           Volume Down             │
│                                     │
│ NAVIGATION                          │
│ Tab         Switch Panels           │
│ Ctrl+F      Find in Playlist        │
│ Ctrl+L      Focus Library           │
│ /           Quick Search            │
│                                     │
│ PLAYLIST OPERATIONS                 │
│ Ctrl+N      New Playlist            │
│ Ctrl+S      Save Playlist           │
│ Ctrl+D      Duplicate Playlist      │
│ Delete      Remove Selected         │
│                                     │
│ SELECTION                           │
│ Ctrl+A      Select All              │
│ Ctrl+Click  Multi-Select            │
│ Shift+Click Range Select            │
│ Esc         Clear Selection         │
│                                     │
│ SPECIAL                             │
│ H           Show HAMMS Analysis     │
│ T           Transition Analyzer     │
│ E           Energy Flow Planner     │
│ F2          Rename Item             │
└─────────────────────────────────────┘
```

### Panel-Specific Navigation

```ascii
Library Panel:
├─ ↑/↓     Navigate playlists
├─ →       Expand folder
├─ ←       Collapse folder
└─ Enter   Load playlist

Track List:
├─ ↑/↓     Navigate tracks
├─ PgUp    Page up
├─ PgDn    Page down
├─ Home    First track
└─ End     Last track

Track Info:
├─ Tab     Next field
├─ S-Tab   Previous field
└─ Enter   Save changes
```

---

## 🎯 RESPONSIVE BEHAVIOR

### Breakpoints

```ascii
Desktop (>1400px):
[Playlist][Track List][Track Info]
   20%        50%         30%

Tablet (768-1400px):
[P][Track List][Info]
15%    55%      30%

Mobile (<768px):
[☰] Menu Toggle
[Track List Full Width]
[Swipe for panels]
```

### Adaptive Elements

```ascii
Wide Screen:
│ Title          │ Artist    │ Album     │ BPM │ Key │ Energy │

Medium Screen:
│ Title/Artist   │ BPM │ Key │ Energy │

Narrow Screen:
│ Title          │
│ Artist         │ ▼ More
```

---

## 🔧 TECHNICAL IMPLEMENTATION NOTES

### Component Structure
```javascript
// React/Vue/Vanilla Component Structure
MAP_UI = {
    components: {
        PlaylistPanel: {
            PlaylistTree: {},
            SmartPlaylistBuilder: {},
            TagManager: {}
        },
        TrackList: {
            TrackRow: {},
            SortControls: {},
            PaginationControls: {}
        },
        TrackInfo: {
            MetadataDisplay: {},
            HAMMSAnalyzer: {},
            ActionButtons: {}
        },
        PlayerBar: {
            PlaybackControls: {},
            ProgressBar: {},
            VolumeControl: {}
        }
    }
}
```

### State Management
```javascript
AppState = {
    playlists: [],
    currentPlaylist: null,
    selectedTracks: [],
    nowPlaying: null,
    ui: {
        activePanel: 'playlists',
        sortBy: 'energy',
        filterBy: null,
        viewMode: 'detailed'
    }
}
```

### Event Flow
```javascript
Events = {
    // User Actions
    'playlist:select': (playlistId) => {},
    'track:play': (trackId) => {},
    'track:select': (trackId, multi) => {},
    
    // Drag & Drop
    'drag:start': (item, type) => {},
    'drag:over': (target) => {},
    'drag:drop': (item, target) => {},
    
    // HAMMS
    'hamms:analyze': (trackId) => {},
    'hamms:recommend': (similarity) => {},
    
    // Updates
    'playlist:update': (changes) => {},
    'track:update': (metadata) => {}
}
```

---

## 📱 MOBILE ADAPTATION

### Mobile Layout

```ascii
┌─────────────────────┐
│ MAP 🎵  [☰] [🔍]   │
├─────────────────────┤
│ ◀ Playlists    ▼    │
├─────────────────────┤
│ ┌─────────────────┐ │
│ │ 🎵 Titanium     │ │
│ │ David Guetta    │ │
│ │ 128 BPM | 8A    │ │
│ ├─────────────────┤ │
│ │ 🎵 Animals      │ │
│ │ Martin Garrix   │ │
│ │ 128 BPM | 8A    │ │
│ └─────────────────┘ │
│                     │
│ [Load More ▼]       │
├─────────────────────┤
│ ▶ ━━━━●━━━━━ 2:34  │
└─────────────────────┘
```

### Touch Gestures
- **Swipe Right**: Open playlist panel
- **Swipe Left**: Open track info
- **Long Press**: Multi-select mode
- **Pinch**: Zoom track list
- **Pull Down**: Refresh

---

## 🎨 THEMING

### Color Schemes

```ascii
Light Theme:
Background: #FFFFFF
Primary:    #667EEA
Secondary:  #764BA2
Text:       #2D3748
Accent:     #F6AD55

Dark Theme:
Background: #1A202C
Primary:    #667EEA
Secondary:  #9F7AEA
Text:       #E2E8F0
Accent:     #ED8936

DJ Mode (High Contrast):
Background: #000000
Primary:    #00FF00
Secondary:  #FF00FF
Text:       #FFFFFF
Accent:     #FFFF00
```

---

## 📊 PERFORMANCE CONSIDERATIONS

### Optimization Strategies
1. **Virtual Scrolling**: Only render visible tracks
2. **Lazy Loading**: Load playlists on demand
3. **Debounced Search**: 300ms delay on typing
4. **Cached HAMMS**: Store calculations
5. **Progressive Loading**: Images load as needed

### Target Metrics
- Initial Load: < 2 seconds
- Playlist Switch: < 200ms
- Search Response: < 100ms
- Drag Feedback: < 16ms (60fps)
- HAMMS Analysis: < 500ms

---

## 🚀 IMPLEMENTATION PRIORITY

### Phase 1: Core (Week 1)
1. Basic three-panel layout
2. Playlist tree navigation
3. Track list with sorting
4. Basic playback controls

### Phase 2: Interactions (Week 2)
1. Drag & drop
2. Multi-selection
3. Context menus
4. Keyboard navigation

### Phase 3: Smart Features (Week 3)
1. Smart playlist builder
2. HAMMS integration
3. Transition analyzer
4. Energy flow planner

### Phase 4: Polish (Week 4)
1. Animations & transitions
2. Responsive design
3. Theme system
4. Performance optimization

---

**Documento creado**: 2025-08-15
**Última actualización**: 2025-08-15
**Estado**: Diseño Completo - Listo para Implementación