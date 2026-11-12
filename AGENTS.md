# Cyberpunk RED Night City Audio Deck

## Architecture Overview
An automated 4-channel soundboard, bulk audio uploader, server folder synchronizer, and combat/scene audio automation module built for **Foundry VTT v12** and **Cyberpunk RED (cyberpunk-red-core)**.

- **Foundry Compatibility**: v12.343+
- **System Target**: `cyberpunk-red-core` (v0.90+)
- **Storage Target**: `/Data/music/` (`combat`, `ambience`, `clubs`, `netrunning`, `sfx`)

## Core Components
- `scripts/main.js`: Hooks integration (`combatStart`, `deleteCombat`, `updateCombat`, `updateActor`, `canvasReady`, `renderPlaylistDirectory`, `getSceneControlButtons`, `chatMessage`).
- `scripts/audio-controller.js`: Audio singleton controlling crossfading, panic fade, audio ducking, server folder scanning/playlist syncing, and scene preset bindings.
- `scripts/audio-deck-app.js`: Main FormApplication window with 3 tabs (Mixer, Uploader, Automation).
- `scripts/procedural-sfx.js`: Web Audio API synthesizer for instant tactical sound effects without external file dependencies.
- `templates/audio-deck.hbs`: Handlebars template rendering the Dark Neon Night City HUD.
- `styles/cyberpunk-red-audio-deck.css`: Scoped CSS styles using `#0d0e12`, `#ff003c`, `#00f0ff`, `#ffe600`, and `#00ff66`.
