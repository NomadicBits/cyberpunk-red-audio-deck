/**
 * Cyberpunk RED Audio Deck - Core Audio Controller & Crossfade Engine
 */

import { proceduralSFX } from "./procedural-sfx.js";

export class CPRAudioController {
  constructor() {
    this.fadeDuration = 2500;
    this.sfxDucking = true;
    this.duckAmount = 0.35; // Multiply by ~0.35 (-9dB) during stingers
    this.isDucked = false;
    this.preCombatState = null;
    this.activeFades = new Set();

    // Master Volume (0.0 to 1.0)
    this.masterVolume = 0.9;

    // Explicit Per-Channel State Map (Total Isolation)
    this.channelState = {
      music:    { activeSoundId: null, activePlaylistId: null, volume: 0.8, savedVolume: 0.8, muted: false, solo: false, loop: true },
      ambience: { activeSoundId: null, activePlaylistId: null, volume: 0.6, savedVolume: 0.6, muted: false, solo: false, loop: true },
      weather:  { activeSoundId: null, activePlaylistId: null, volume: 0.4, savedVolume: 0.4, muted: false, solo: false, loop: true },
      sfx:      { activeSoundId: null, activePlaylistId: null, volume: 0.9, savedVolume: 0.9, muted: false, solo: false, loop: false }
    };
  }

  static get instance() {
    if (!this._instance) {
      this._instance = new CPRAudioController();
    }
    return this._instance;
  }

  /**
   * Standard NC Audio Playlists
   */
  static PLAYLIST_DEFS = [
    { name: "NC Audio // Combat", folder: "music/combat", mode: 0, channel: "music", fade: 2500 },
    { name: "NC Audio // Ambience", folder: "music/ambience", mode: 0, channel: "environment", fade: 2500 },
    { name: "NC Audio // Weather & Drones", folder: "music/weather", mode: 0, channel: "environment", fade: 2500 },
    { name: "NC Audio // Clubs & Lounge", folder: "music/clubs", mode: 0, channel: "music", fade: 2000 },
    { name: "NC Audio // Netrunning", folder: "music/netrunning", mode: 0, channel: "environment", fade: 2000 },
    { name: "NC Audio // SFX & Stingers", folder: "music/sfx", mode: -1, channel: "interface", fade: 500 }
  ];

  /**
   * Find or create standard playlists
   */
  async ensureStandardPlaylists() {
    const created = [];
    for (const def of CPRAudioController.PLAYLIST_DEFS) {
      let pl = game.playlists.getName(def.name);
      if (!pl) {
        pl = await Playlist.create({
          name: def.name,
          mode: def.mode,
          channel: def.channel,
          fade: def.fade,
          description: `Managed by Night City Audio Deck for ${def.folder}`
        });
        created.push(pl);
      }
    }
    return created;
  }

  /**
   * Ensure server directories exist
   */
  async ensureServerDirectories() {
    if (!game.user.isGM) return;
    const folders = [
      "music/combat",
      "music/ambience",
      "music/weather",
      "music/clubs",
      "music/netrunning",
      "music/sfx"
    ];
    for (const f of folders) {
      try {
        await FilePicker.createDirectory({ source: "data", target: f });
      } catch (err) {
        // Directory may already exist, ignore
      }
    }
  }

  /**
   * Sync existing server folders into Foundry Playlists
   */
  async syncServerFolder(notify = true) {
    if (!game.user.isGM) return;

    await this.ensureServerDirectories();
    await this.ensureStandardPlaylists();

    let totalImported = 0;

    for (const def of CPRAudioController.PLAYLIST_DEFS) {
      const pl = game.playlists.getName(def.name);
      if (!pl) continue;

      let files = [];
      try {
        const browse = await FilePicker.browse("data", def.folder);
        files = browse.files.filter(f => /\.(mp3|ogg|wav|flac|webm|m4a|opus)$/i.test(f));
      } catch (err) {
        console.warn(`CPRAudioDeck | Could not browse ${def.folder}:`, err);
        continue;
      }

      const existingPaths = new Set(pl.sounds.map(s => s.path));
      const soundsToCreate = [];

      for (const filePath of files) {
        if (existingPaths.has(filePath)) continue;

        const decoded = decodeURIComponent(filePath.split("/").pop());
        const cleanName = decoded.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

        soundsToCreate.push({
          name: cleanName,
          path: filePath,
          volume: 0.8,
          repeat: def.channel !== "interface",
          fade: def.fade
        });
      }

      if (soundsToCreate.length > 0) {
        await pl.createEmbeddedDocuments("PlaylistSound", soundsToCreate);
        totalImported += soundsToCreate.length;
      }
    }

    if (notify && typeof ui !== "undefined" && ui.notifications) {
      ui.notifications.info(`Night City Audio Deck: Synchronized ${totalImported} new audio track(s) from server.`);
    }
    return totalImported;
  }

  /**
   * Calculate effective volume for a specific channel
   * Factors in: channel slider volume, master volume, solo states, and mute state.
   */
  getEffectiveVolume(channel) {
    const ch = this.channelState[channel];
    if (!ch) return 0;

    // Check if ANY channel currently has solo active
    const anySolo = Object.values(this.channelState).some(c => c.solo);
    if (anySolo) {
      // If channels are soloed, only soloed AND unmuted channels output sound
      if (!ch.solo || ch.muted) return 0;
      return ch.volume * this.masterVolume;
    }

    // Normal mode: check mute
    if (ch.muted) return 0;
    return ch.volume * this.masterVolume;
  }

  /**
   * Update all actively playing sounds across all channels to match their effective volumes
   */
  async applyEffectiveVolumes() {
    for (const [channelName, state] of Object.entries(this.channelState)) {
      const sound = this.getChannelActiveSound(channelName);
      if (sound && sound.playing) {
        const effVol = this.getEffectiveVolume(channelName);
        try {
          await sound.update({ volume: Math.max(effVol, 0.0001) });
        } catch (e) {}
      }
    }
  }

  /**
   * Set Master Volume (0.0 to 1.0)
   */
  async setMasterVolume(vol) {
    this.masterVolume = Math.min(Math.max(vol, 0), 1.0);
    await this.applyEffectiveVolumes();
    return this.masterVolume;
  }

  /**
   * Set Channel Volume (0.0 to 1.0)
   */
  async setChannelVolume(channel, vol) {
    const ch = this.channelState[channel];
    if (!ch) return 0;
    ch.volume = Math.min(Math.max(vol, 0), 1.0);
    ch.savedVolume = ch.volume;
    await this.applyEffectiveVolumes();
    return ch.volume;
  }

  /**
   * Toggle Solo for a Channel
   */
  async toggleSolo(channel) {
    const ch = this.channelState[channel];
    if (!ch) return false;
    ch.solo = !ch.solo;
    await this.applyEffectiveVolumes();
    return ch.solo;
  }

  /**
   * Toggle Mute for a Channel
   */
  async toggleMute(channel) {
    const ch = this.channelState[channel];
    if (!ch) return false;
    ch.muted = !ch.muted;
    await this.applyEffectiveVolumes();
    return ch.muted;
  }

  /**
   * Toggle Loop for a Channel
   */
  async toggleLoop(channel) {
    const ch = this.channelState[channel];
    if (!ch) return false;
    ch.loop = !ch.loop;
    const sound = this.getChannelActiveSound(channel);
    if (sound) {
      await sound.update({ repeat: ch.loop });
    }
    return ch.loop;
  }

  /**
   * Resolve currently active sound for a specific channel
   */
  getChannelActiveSound(channel) {
    const ch = this.channelState[channel];
    if (!ch || !ch.activeSoundId) return null;

    if (ch.activePlaylistId) {
      const pl = game.playlists.get(ch.activePlaylistId);
      if (pl) {
        const sound = pl.sounds.get(ch.activeSoundId);
        if (sound) return sound;
      }
    }

    for (const pl of game.playlists) {
      const sound = pl.sounds.get(ch.activeSoundId);
      if (sound) return sound;
    }
    return null;
  }

  /**
   * Play track on specific channel with crossfade and total channel isolation
   */
  async playChannelTrack(channel, soundId) {
    const ch = this.channelState[channel];
    if (!ch) return null;

    let targetSound = null;
    let targetPlaylist = null;

    for (const pl of game.playlists) {
      const s = pl.sounds.get(soundId);
      if (s) {
        targetSound = s;
        targetPlaylist = pl;
        break;
      }
    }

    if (!targetSound || !targetPlaylist) return null;

    // Fade out / stop ONLY the prior sound in this specific channel
    if (ch.activeSoundId && ch.activeSoundId !== targetSound.id) {
      const prevSound = this.getChannelActiveSound(channel);
      if (prevSound && prevSound.playing) {
        this.fadeSoundOut(prevSound, this.fadeDuration * 0.75);
      }
    }

    ch.activeSoundId = targetSound.id;
    ch.activePlaylistId = targetPlaylist.id;

    // Apply repeat flag
    await targetSound.update({ repeat: ch.loop });

    const effVol = this.getEffectiveVolume(channel);
    if (!targetSound.playing) {
      await targetPlaylist.playSound(targetSound);
      await this.fadeSoundIn(targetSound, this.fadeDuration, effVol);
    } else {
      await targetSound.update({ volume: Math.max(effVol, 0.0001) });
    }

    return targetSound;
  }

  /**
   * Stop specific channel
   */
  async stopChannel(channel) {
    const ch = this.channelState[channel];
    if (!ch) return;
    const sound = this.getChannelActiveSound(channel);
    if (sound && sound.playing) {
      await sound.parent.stopSound(sound);
    }
    ch.activeSoundId = null;
    ch.activePlaylistId = null;
  }

  /**
   * Panic Fade All: Smoothly decay all audio to 0 over 2 seconds then stop
   */
  async panicFadeAll(duration = 2000) {
    if (typeof ui !== "undefined" && ui.notifications) {
      ui.notifications.warn("PANIC FADE: Cutting all Night City Audio...");
    }
    const activeSounds = [];

    for (const pl of game.playlists) {
      for (const sound of pl.sounds) {
        if (sound.playing) {
          activeSounds.push({ sound, startVol: sound.volume || 0.8 });
        }
      }
    }

    if (activeSounds.length === 0) return;

    const startTime = performance.now();
    const interval = 50;

    return new Promise((resolve) => {
      const timer = setInterval(async () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1.0);
        const curve = 1.0 - progress;

        for (const item of activeSounds) {
          try {
            await item.sound.update({ volume: Math.max(item.startVol * curve, 0.0001) });
          } catch (e) {}
        }

        if (progress >= 1.0) {
          clearInterval(timer);
          for (const pl of game.playlists) {
            try {
              await pl.stopAll();
            } catch (e) {}
          }
          // Reset channel states
          for (const ch of Object.values(this.channelState)) {
            ch.activeSoundId = null;
            ch.activePlaylistId = null;
          }
          if (typeof ui !== "undefined" && ui.notifications) {
            ui.notifications.info("All audio channels silenced.");
          }
          resolve();
        }
      }, interval);
    });
  }

  /**
   * Fade sound out then stop
   */
  fadeSoundOut(sound, duration = 2000) {
    if (!sound || !sound.playing) return;
    const startVol = sound.volume || 0.8;
    const startTime = performance.now();

    const interval = setInterval(async () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const newVol = startVol * (1.0 - progress);

      try {
        await sound.update({ volume: Math.max(newVol, 0.0001) });
      } catch (e) {}

      if (progress >= 1.0) {
        clearInterval(interval);
        try {
          await sound.parent.stopSound(sound);
          await sound.update({ volume: startVol });
        } catch (e) {}
      }
    }, 50);
  }

  /**
   * Fade sound in
   */
  fadeSoundIn(sound, duration = 2500, targetVol = null) {
    if (!sound) return;
    const finalVol = targetVol !== null ? targetVol : (sound.volume || 0.8);
    sound.update({ volume: 0.01 });

    const startTime = performance.now();
    const interval = setInterval(async () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const newVol = finalVol * progress;

      try {
        await sound.update({ volume: Math.max(newVol, 0.01) });
      } catch (e) {}

      if (progress >= 1.0) {
        clearInterval(interval);
        try {
          await sound.update({ volume: finalVol });
        } catch (e) {}
      }
    }, 50);
  }

  /**
   * Trigger Stinger with SFX Auto-Ducking
   */
  async playStinger(type, customPath = null) {
    if (this.sfxDucking && !this.isDucked) {
      this.isDucked = true;
      this._applyDucking(this.duckAmount);
      setTimeout(() => {
        this._restoreDucking();
        this.isDucked = false;
      }, 3500);
    }

    if (customPath) {
      foundry.audio.AudioHelper.play({ src: customPath, volume: 0.9, autoplay: true, loop: false }, true);
      return;
    }

    const sfxPlaylist = game.playlists.getName("NC Audio // SFX & Stingers");
    let matchedSound = null;
    if (sfxPlaylist) {
      matchedSound = sfxPlaylist.sounds.find(s => s.name.toLowerCase().includes(type.toLowerCase()));
    }

    if (matchedSound) {
      await sfxPlaylist.playSound(matchedSound);
    } else {
      proceduralSFX.play(type, 0.9);
      if (game.socket) {
        game.socket.emit("module.cyberpunk-red-audio-deck", { action: "proceduralSFX", type });
      }
    }
  }

  _applyDucking(factor) {
    for (const pl of game.playlists) {
      if (pl.name.includes("Combat") || pl.name.includes("Ambience") || pl.name.includes("Weather") || pl.name.includes("Clubs")) {
        for (const s of pl.sounds) {
          if (s.playing) {
            s.update({ volume: Math.max((s.volume || 0.8) * factor, 0.05) });
          }
        }
      }
    }
  }

  _restoreDucking() {
    this.applyEffectiveVolumes();
  }

  /**
   * Trigger Mood Preset
   */
  async triggerMood(mood) {
    let musicPlName = "NC Audio // Combat";
    let ambPlName = "NC Audio // Ambience";

    switch (mood) {
      case "street":
        musicPlName = "NC Audio // Clubs & Lounge";
        ambPlName = "NC Audio // Ambience";
        break;
      case "stealth":
        musicPlName = null;
        ambPlName = "NC Audio // Weather & Drones";
        break;
      case "afterlife":
        musicPlName = "NC Audio // Clubs & Lounge";
        ambPlName = "NC Audio // Ambience";
        break;
      case "combat":
      case "boss":
        musicPlName = "NC Audio // Combat";
        ambPlName = "NC Audio // Weather & Drones";
        break;
      case "netrun":
        musicPlName = null;
        ambPlName = "NC Audio // Netrunning";
        break;
    }

    if (musicPlName) {
      const pl = game.playlists.getName(musicPlName);
      if (pl && pl.sounds.size > 0) {
        const sound = pl.sounds.contents[0];
        await this.playChannelTrack("music", sound.id);
      }
    }

    if (ambPlName) {
      const pl = game.playlists.getName(ambPlName);
      if (pl && pl.sounds.size > 0) {
        const sound = pl.sounds.contents[0];
        await this.playChannelTrack("ambience", sound.id);
      }
    }
  }

  /**
   * Save currently playing layers as active scene preset
   */
  async bindActiveScene() {
    const scene = canvas?.scene;
    if (!scene) {
      if (typeof ui !== "undefined") ui.notifications.warn("No active scene to bind audio preset.");
      return;
    }

    const playingTracks = [];
    for (const [channelName, state] of Object.entries(this.channelState)) {
      const sound = this.getChannelActiveSound(channelName);
      if (sound) {
        playingTracks.push({
          channel: channelName,
          playlistName: sound.parent.name,
          soundName: sound.name,
          soundId: sound.id,
          volume: state.volume,
          repeat: state.loop
        });
      }
    }

    await scene.setFlag("cyberpunk-red-audio-deck", "preset", playingTracks);
    if (typeof ui !== "undefined") {
      ui.notifications.info(`Night City Audio Deck: Bound ${playingTracks.length} active track(s) to Scene "${scene.name}".`);
    }
    return playingTracks;
  }

  /**
   * Apply preset bound to scene
   */
  async applyScenePreset(scene) {
    if (!scene) return;
    const preset = scene.getFlag("cyberpunk-red-audio-deck", "preset");
    if (!preset || !Array.isArray(preset) || preset.length === 0) return;

    if (typeof ui !== "undefined") {
      ui.notifications.info(`Night City Audio Deck: Transitioning atmosphere for ${scene.name}...`);
    }

    for (const item of preset) {
      if (item.channel && item.soundId) {
        await this.playChannelTrack(item.channel, item.soundId);
      }
    }
  }

  /**
   * Automation: On Combat Start
   */
  async handleCombatStart(combat) {
    const autoCombat = game.settings.get("cyberpunk-red-audio-deck", "autoCombatStart");
    if (!autoCombat) return;

    this.preCombatState = {
      music: { ...this.channelState.music },
      ambience: { ...this.channelState.ambience }
    };

    const combatPl = game.playlists.getName("NC Audio // Combat");
    if (combatPl && combatPl.sounds.size > 0) {
      if (typeof ui !== "undefined") {
        ui.notifications.info("INITIATIVE DETECTED: Engaging Cyberpunk Combat Audio!");
      }
      const sound = combatPl.sounds.contents[0];
      await this.playChannelTrack("music", sound.id);
    }
  }

  /**
   * Automation: On Combat End
   */
  async handleCombatEnd(combat) {
    const autoCombat = game.settings.get("cyberpunk-red-audio-deck", "autoCombatEnd");
    if (!autoCombat) return;

    await this.stopChannel("music");
    this.playStinger("breach");

    if (this.preCombatState) {
      if (this.preCombatState.music?.activeSoundId) {
        await this.playChannelTrack("music", this.preCombatState.music.activeSoundId);
      }
      this.preCombatState = null;
    } else if (canvas?.scene) {
      await this.applyScenePreset(canvas.scene);
    }
  }

  /**
   * Self-test diagnostics routine (can be invoked from chat with /cpr-music-test)
   */
  async runSelfTest() {
    const results = {
      timestamp: new Date().toISOString(),
      directories: [],
      playlists: [],
      channels: {},
      automation: {},
      errors: []
    };

    try {
      await this.ensureServerDirectories();
      await this.ensureStandardPlaylists();

      for (const def of CPRAudioController.PLAYLIST_DEFS) {
        const pl = game.playlists.getName(def.name);
        results.playlists.push({
          name: def.name,
          exists: !!pl,
          soundCount: pl ? pl.sounds.size : 0
        });
      }

      for (const [ch, state] of Object.entries(this.channelState)) {
        results.channels[ch] = {
          volume: state.volume,
          effectiveVolume: this.getEffectiveVolume(ch),
          muted: state.muted,
          solo: state.solo,
          loop: state.loop
        };
      }

      results.automation = {
        combatStart: game.settings.get("cyberpunk-red-audio-deck", "autoCombatStart"),
        combatEnd: game.settings.get("cyberpunk-red-audio-deck", "autoCombatEnd"),
        criticalHP: game.settings.get("cyberpunk-red-audio-deck", "autoCriticalHP"),
        bossTurn: game.settings.get("cyberpunk-red-audio-deck", "autoBossTurn")
      };
    } catch (err) {
      results.errors.push(err.message);
    }

    return results;
  }
}
