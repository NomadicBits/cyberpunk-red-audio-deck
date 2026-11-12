# Cyberpunk RED: Night City Audio Deck & DM Music Manager

A Foundry VTT v12 module engineered for Cyberpunk RED (`cyberpunk-red-core`). Features a live 4-channel soundboard, mood crossfader, bulk drag-and-drop audio uploader, server folder auto-synchronization, and combat/scene audio automation.

## Features

1. **Live DM Soundboard & Mood Mixer**:
   - Master volume with smooth **Panic Fade All (2s)**.
   - **4 Concurrent Channel Strips**: MUSIC, AMBIENCE, WEATHER/DRONE, SFX/STINGER with independent volume sliders, loop toggles, Solo (S), Mute (M).
   - **Mood & Situation Quick-Trigger Matrix**: One-click crossfading for `Street Exploration`, `Corp Stealth`, `Fixer Lounge / Afterlife`, `Cyberpsycho Combat`, `Netrun / Cyberspace`, `Boss Fight // Smasher`.
   - **Stinger Pad Grid (8 Instant SFX Buttons)**: Zero-latency one-shots for Trauma Team Siren, NCPD Alarm, EMP Blast, Breach Complete, Flatline Beep, Door Hack, Distant Gunfire, and Crowd Panic with procedural Web Audio synthesis fallback.

2. **Bulk Drag-and-Drop Uploader & Auto-Organizer**:
   - Direct multi-file drag-and-drop supporting MP3, OGG, WAV, FLAC, and WEBM.
   - Target subfolder routing under `Data/music/` (`combat`, `ambience`, `clubs`, `netrunning`, `sfx`).
   - One-click **Sync Existing Server Folder** that scans server storage and registers untracked audio into playlists automatically without duplicates.

3. **Combat & Scene Automation Rules**:
   - **Combat Start (`combatStart`)**: Auto-crossfades to high-intensity combat audio with customizable fade curve and ambience ducking.
   - **Combat End (`deleteCombat`)**: Fades combat music out smoothly and seamlessly restores pre-combat exploration ambience.
   - **Critical HP Alert (`updateActor`)**: Triggers an alert heartbeat/stinger when a PC drops below 25% HP.
   - **Elite / Boss Turn (`updateCombat`)**: Audio stinger and background ducking when an elite or boss combatant acts.
   - **Scene Audio Preset Binder (`canvasReady`)**: One-click binding of active audio layers to scenes for automated atmospheric transitions on scene change.

## Compatibility
- Foundry VTT: v12+
- System: `cyberpunk-red-core` (v0.90+)

## Installation
Clone or copy into your Foundry `Data/modules/` directory:
```bash
git clone https://github.com/NomadicBits/cyberpunk-red-audio-deck.git
```
