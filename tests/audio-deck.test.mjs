/**
 * Automated Unit & Integration Tests for Cyberpunk RED Night City Audio Deck
 * Uses Node.js native test runner (node --test)
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Setup Foundry VTT v12 Environment Mocks
class MockSound {
  constructor(data, parent) {
    this.id = data.id || "sound_" + Math.random().toString(36).substr(2, 9);
    this.name = data.name;
    this.path = data.path;
    this.volume = data.volume ?? 0.8;
    this.repeat = data.repeat ?? false;
    this.playing = false;
    this.parent = parent;
  }

  async update(data) {
    if ("volume" in data) this.volume = data.volume;
    if ("repeat" in data) this.repeat = data.repeat;
    return this;
  }
}

class MockPlaylist {
  constructor(data) {
    this.id = data.id || "pl_" + Math.random().toString(36).substr(2, 9);
    this.name = data.name;
    this.mode = data.mode;
    this.channel = data.channel;
    this.fade = data.fade;
    this.description = data.description;
    this._sounds = new Map();
  }

  get sounds() {
    return {
      contents: Array.from(this._sounds.values()),
      size: this._sounds.size,
      get: (id) => this._sounds.get(id),
      find: (fn) => Array.from(this._sounds.values()).find(fn),
      map: (fn) => Array.from(this._sounds.values()).map(fn),
      values: () => this._sounds.values(),
      [Symbol.iterator]: () => this._sounds.values()[Symbol.iterator]()
    };
  }

  async createEmbeddedDocuments(type, dataList) {
    const created = [];
    for (const d of dataList) {
      const s = new MockSound(d, this);
      this._sounds.set(s.id, s);
      created.push(s);
    }
    return created;
  }

  async playSound(sound) {
    sound.playing = true;
    return sound;
  }

  async stopSound(sound) {
    sound.playing = false;
    return sound;
  }

  async stopAll() {
    for (const s of this._sounds.values()) {
      s.playing = false;
    }
  }

  static async create(data) {
    const pl = new MockPlaylist(data);
    global.game.playlists._list.set(pl.name, pl);
    return pl;
  }
}

class MockScene {
  constructor(name) {
    this.id = "scene_" + Math.random().toString(36).substr(2, 9);
    this.name = name;
    this.isView = true;
    this.flags = {};
  }

  getFlag(scope, key) {
    return this.flags[`${scope}.${key}`];
  }

  async setFlag(scope, key, val) {
    this.flags[`${scope}.${key}`] = val;
    return val;
  }
}

function initFoundryGlobals() {
  const playlistsMap = new Map();

  global.Playlist = MockPlaylist;

  global.game = {
    user: { isGM: true, id: "gm_user" },
    settings: {
      _data: new Map([
        ["cyberpunk-red-audio-deck.autoCombatStart", true],
        ["cyberpunk-red-audio-deck.autoCombatEnd", true],
        ["cyberpunk-red-audio-deck.autoCriticalHP", true],
        ["cyberpunk-red-audio-deck.autoBossTurn", true],
        ["cyberpunk-red-audio-deck.crossfadeDuration", 2500]
      ]),
      get(mod, key) {
        return this._data.get(`${mod}.${key}`);
      },
      async set(mod, key, val) {
        this._data.set(`${mod}.${key}`, val);
        return val;
      },
      register() {}
    },
    playlists: {
      _list: playlistsMap,
      getName: (name) => playlistsMap.get(name),
      get: (id) => Array.from(playlistsMap.values()).find(p => p.id === id),
      find: (fn) => Array.from(playlistsMap.values()).find(fn),
      [Symbol.iterator]: () => playlistsMap.values()[Symbol.iterator]()
    },
    scenes: [new MockScene("Afterlife Bar"), new MockScene("Waterfront Docks")],
    socket: {
      emitted: [],
      emit(channel, data) {
        this.emitted.push({ channel, data });
      }
    }
  };

  global.FilePicker = {
    directoriesCreated: [],
    filesByFolder: {
      "music/combat": ["Against the Tide.mp3", "Drive Or Die.mp3"],
      "music/ambience": ["City With Horns.mp3", "Badlands wind.mp3"],
      "music/weather": ["Industrial Skyline Layer.mp3", "Skyline Ambience - BBC.mp3"],
      "music/clubs": ["Flowers of Time.mp3"],
      "music/netrunning": ["Industrial Skyline White.mp3"],
      "music/sfx": ["Distant Gunfire - BBC.mp3"]
    },
    async createDirectory({ target }) {
      this.directoriesCreated.push(target);
      return target;
    },
    async browse(source, folder) {
      const files = (this.filesByFolder[folder] || []).map(f => `${folder}/${f}`);
      return { files };
    },
    async upload(source, targetFolder, file) {
      return { path: `${targetFolder}/${file.name}` };
    }
  };

  global.ui = {
    notifications: {
      info() {},
      warn() {},
      error() {}
    }
  };

  global.canvas = {
    scene: global.game.scenes[0]
  };

  global.foundry = {
    utils: {
      mergeObject: (a, b) => Object.assign({}, a, b)
    },
    audio: {
      AudioHelper: {
        played: [],
        play(opts) {
          this.played.push(opts);
        }
      }
    }
  };

  // Mock AudioContext for Web Audio API
  global.window = {
    AudioContext: class {
      constructor() {
        this.state = "running";
        this.currentTime = 0;
        this.sampleRate = 44100;
      }
      createOscillator() {
        return {
          type: "sine",
          frequency: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
          start() {},
          stop() {}
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {}
        };
      }
      createBiquadFilter() {
        return {
          type: "lowpass",
          frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          Q: { value: 1 },
          connect() {}
        };
      }
      createBuffer(ch, len, rate) {
        return {
          getChannelData: () => new Float32Array(len)
        };
      }
      createBufferSource() {
        return {
          buffer: null,
          connect() {},
          start() {},
          stop() {}
        };
      }
    }
  };
}

describe("Cyberpunk RED Night City Audio Deck Test Suite", async () => {
  let CPRAudioController;
  let proceduralSFX;

  beforeEach(async () => {
    initFoundryGlobals();
    const mod = await import("../scripts/audio-controller.js");
    CPRAudioController = mod.CPRAudioController;
    const sfxMod = await import("../scripts/procedural-sfx.js");
    proceduralSFX = sfxMod.proceduralSFX;
  });

  it("1. Standard playlists & directory hierarchy initialization", async () => {
    const controller = new CPRAudioController();
    await controller.ensureServerDirectories();
    const created = await controller.ensureStandardPlaylists();

    assert.equal(created.length, 6, "Must create 6 standard playlists including Weather & Drones");

    const weatherPl = game.playlists.getName("NC Audio // Weather & Drones");
    assert.ok(weatherPl, "NC Audio // Weather & Drones must exist");
    assert.equal(weatherPl.channel, "environment", "Weather playlist must use environment channel");

    const expectedFolders = [
      "music/combat", "music/ambience", "music/weather",
      "music/clubs", "music/netrunning", "music/sfx"
    ];
    for (const f of expectedFolders) {
      assert.ok(global.FilePicker.directoriesCreated.includes(f), `Directory ${f} must be verified`);
    }
  });

  it("2. Server folder scanning, importing and deduplication", async () => {
    const controller = new CPRAudioController();
    const importedCount = await controller.syncServerFolder(false);

    assert.ok(importedCount > 0, "Must import files from mock server directories");

    const weatherPl = game.playlists.getName("NC Audio // Weather & Drones");
    assert.equal(weatherPl.sounds.size, 2, "Weather playlist must contain the 2 scanned tracks");

    // Re-sync should not create duplicates
    const duplicateCount = await controller.syncServerFolder(false);
    assert.equal(duplicateCount, 0, "Re-sync must create 0 duplicates");
  });

  it("3. 4-Channel Isolation: Weather tracks must not leak into Ambience", async () => {
    const controller = new CPRAudioController();
    await controller.syncServerFolder(false);

    const weatherPl = game.playlists.getName("NC Audio // Weather & Drones");
    const ambiencePl = game.playlists.getName("NC Audio // Ambience");
    const musicPl = game.playlists.getName("NC Audio // Combat");

    const weatherSound = weatherPl.sounds.contents[0];
    const ambSound = ambiencePl.sounds.contents[0];
    const musicSound = musicPl.sounds.contents[0];

    // Play track on weather channel
    await controller.playChannelTrack("weather", weatherSound.id);
    assert.equal(controller.channelState.weather.activeSoundId, weatherSound.id, "Weather active sound must match");
    assert.equal(controller.getChannelActiveSound("weather").id, weatherSound.id);

    // Play track on ambience channel
    await controller.playChannelTrack("ambience", ambSound.id);
    assert.equal(controller.channelState.ambience.activeSoundId, ambSound.id, "Ambience active sound must match");
    assert.equal(controller.getChannelActiveSound("ambience").id, ambSound.id);

    // Verify weather channel was NOT overwritten
    assert.equal(controller.getChannelActiveSound("weather").id, weatherSound.id, "Weather sound must remain untouched");

    // Play track on music channel
    await controller.playChannelTrack("music", musicSound.id);
    assert.equal(controller.getChannelActiveSound("music").id, musicSound.id);
    assert.equal(controller.getChannelActiveSound("weather").id, weatherSound.id);
    assert.equal(controller.getChannelActiveSound("ambience").id, ambSound.id);
  });

  it("4. Channel Volume, Master Volume Scaling, Loop, Solo and Mute Engine", async () => {
    const controller = new CPRAudioController();
    await controller.syncServerFolder(false);

    const weatherSound = game.playlists.getName("NC Audio // Weather & Drones").sounds.contents[0];
    const musicSound = game.playlists.getName("NC Audio // Combat").sounds.contents[0];

    await controller.playChannelTrack("weather", weatherSound.id);
    await controller.playChannelTrack("music", musicSound.id);

    // Test Channel Volume & Master Scaling
    await controller.setChannelVolume("weather", 0.5);
    await controller.setMasterVolume(0.8);
    assert.equal(controller.getEffectiveVolume("weather"), 0.5 * 0.8, "Effective volume must be ch.volume * masterVolume");

    // Test Loop Toggle
    const loopVal = await controller.toggleLoop("weather");
    assert.equal(loopVal, false, "Loop was true, must now be false");
    assert.equal(weatherSound.repeat, false, "Sound repeat flag must match");

    // Test Solo Logic
    await controller.toggleSolo("music");
    assert.equal(controller.channelState.music.solo, true, "Music must be soloed");
    assert.equal(controller.getEffectiveVolume("weather"), 0, "Non-soloed channel volume must be 0");
    assert.ok(controller.getEffectiveVolume("music") > 0, "Soloed channel volume must be active");
    assert.equal(controller.channelState.weather.volume, 0.5, "Weather configured slider volume must not be destroyed");

    // Turn Solo Off
    await controller.toggleSolo("music");
    assert.equal(controller.getEffectiveVolume("weather"), 0.4, "Weather effective volume must be restored");

    // Test Mute Logic
    await controller.toggleMute("weather");
    assert.equal(controller.channelState.weather.muted, true);
    assert.equal(controller.getEffectiveVolume("weather"), 0, "Muted channel effective volume must be 0");
    await controller.toggleMute("weather");
    assert.equal(controller.getEffectiveVolume("weather"), 0.4, "Unmuted channel effective volume restored");
  });

  it("5. Stinger playback, -8dB auto-ducking, and procedural WebAudio synthesizer", async () => {
    const controller = new CPRAudioController();
    await controller.syncServerFolder(false);

    const musicSound = game.playlists.getName("NC Audio // Combat").sounds.contents[0];
    await controller.playChannelTrack("music", musicSound.id);

    // Trigger procedural stinger
    await controller.playStinger("emp");

    assert.equal(controller.isDucked, true, "Ducking must be engaged during stinger");
    assert.ok(game.socket.emitted.length > 0, "Procedural stinger must be emitted to socket");
    assert.equal(game.socket.emitted[0].data.type, "emp");
  });

  it("6. Mood Matrix crossfade", async () => {
    const controller = new CPRAudioController();
    await controller.syncServerFolder(false);

    await controller.triggerMood("combat");
    assert.ok(controller.channelState.music.activeSoundId !== null, "Music channel must engage for combat mood");
    assert.ok(controller.channelState.ambience.activeSoundId !== null, "Ambience channel must engage for combat mood");
  });

  it("7. Combat Automation & Scene Audio Preset Binding", async () => {
    const controller = new CPRAudioController();
    await controller.syncServerFolder(false);

    const weatherSound = game.playlists.getName("NC Audio // Weather & Drones").sounds.contents[0];
    await controller.playChannelTrack("weather", weatherSound.id);

    // Test Scene Preset Binding
    const bound = await controller.bindActiveScene();
    assert.ok(bound.length > 0, "Active scene must bind playing tracks");
    assert.equal(bound[0].channel, "weather");

    // Test Combat Start
    await controller.handleCombatStart({});
    assert.ok(controller.channelState.music.activeSoundId !== null, "Combat start must launch combat music");
    assert.ok(controller.preCombatState !== null, "Pre-combat state snapshot must be recorded");

    // Test Combat End
    await controller.handleCombatEnd({});
    assert.equal(controller.preCombatState, null, "Pre-combat state must be cleared after restoration");
  });

  it("8. Self-test diagnostic audit routine (/cpr-music-test)", async () => {
    const controller = new CPRAudioController();
    const report = await controller.runSelfTest();

    assert.ok(report.playlists.length >= 6, "Must monitor all 6 playlists");
    assert.equal(report.errors.length, 0, "Must report 0 errors");
    assert.ok("music" in report.channels);
    assert.ok("weather" in report.channels);
  });

  it("9. Bulk Uploader Tab 2 playlist grouping, filtering, and completed track compression state", async () => {
    global.FormApplication = class {
      constructor() {}
      static get defaultOptions() { return {}; }
    };
    const { CPRAudioDeckApp } = await import("../scripts/audio-deck-app.js");
    await CPRAudioController.instance.syncServerFolder(false);

    const app = new CPRAudioDeckApp();
    const data = app.getData();

    assert.ok(Array.isArray(data.playlistGroups), "Must return grouped playlists for accordion collapse");
    assert.equal(data.playlistGroups.length, 6, "Must group all 6 standard playlists");
    assert.ok(data.totalTrackCount >= 8, "Must count all synced tracks across playlists");
    assert.equal(data.compressCompleted, false, "Default compressCompleted state must be false");

    // Toggle compression and filter state
    app.compressCompleted = true;
    app.activeCategoryFilter = "weather";
    app.searchQuery = "skyline";
    const updatedData = app.getData();
    assert.equal(updatedData.compressCompleted, true, "compressCompleted state must update");
    assert.equal(updatedData.activeCategoryFilter, "weather", "activeCategoryFilter must update");
    assert.equal(updatedData.searchQuery, "skyline", "searchQuery must update");
  });
});
