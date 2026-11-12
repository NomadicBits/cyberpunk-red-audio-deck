/**
 * Cyberpunk RED Audio Deck - Main Application Window
 */

import { CPRAudioController } from "./audio-controller.js";

export class CPRAudioDeckApp extends FormApplication {
  constructor(options = {}) {
    super({}, options);
    this.activeTab = "mixer";
    this.compressCompleted = false;
    this.activeCategoryFilter = "all";
    this.searchQuery = "";
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "cpr-audio-deck-app",
      title: "Night City Audio Deck // v12 DM Sound System",
      template: "modules/cyberpunk-red-audio-deck/templates/audio-deck.hbs",
      width: 940,
      height: 800,
      resizable: true,
      classes: ["cpr-audio-window"],
      tabs: [{ navSelector: ".cpr-audio-tabs", contentSelector: ".cpr-audio-body", initial: "mixer" }]
    });
  }

  getData() {
    const controller = CPRAudioController.instance;

    // Playlists
    const combatPl = game.playlists.getName("NC Audio // Combat");
    const clubsPl = game.playlists.getName("NC Audio // Clubs & Lounge");
    const ambiencePl = game.playlists.getName("NC Audio // Ambience");
    const weatherPl = game.playlists.getName("NC Audio // Weather & Drones");
    const netPl = game.playlists.getName("NC Audio // Netrunning");
    const sfxPl = game.playlists.getName("NC Audio // SFX & Stingers");

    // Helper to resolve channel data
    const resolveChannel = (chKey, defaultLabel) => {
      const state = controller.channelState[chKey];
      const sound = controller.getChannelActiveSound(chKey);
      const isPlaying = sound ? sound.playing : false;

      return {
        key: chKey,
        activeSoundId: state.activeSoundId,
        trackName: sound ? sound.name : defaultLabel,
        playing: isPlaying,
        volume: Math.round(state.volume * 100),
        effectiveVolume: Math.round(controller.getEffectiveVolume(chKey) * 100),
        muted: state.muted,
        solo: state.solo,
        loop: state.loop,
        progress: isPlaying ? 55 : 0
      };
    };

    const channels = {
      music: resolveChannel("music", "No Music Track (Standby)"),
      ambience: resolveChannel("ambience", "No Ambience Track (Standby)"),
      weather: resolveChannel("weather", "No Weather / Drone (Standby)"),
      sfx: resolveChannel("sfx", "Tactical One-Shots Ready")
    };

    const mapChannelSounds = (sounds, activeSoundId) =>
      sounds.map(s => ({
        id: s.id,
        name: s.name,
        playing: s.playing,
        selected: s.id === activeSoundId
      }));

    // Build channel-specific sound lists
    const musicSounds = mapChannelSounds([
      ...(combatPl?.sounds.contents || []),
      ...(clubsPl?.sounds.contents || [])
    ], channels.music.activeSoundId);
    const ambienceSounds = mapChannelSounds(ambiencePl?.sounds.contents || [], channels.ambience.activeSoundId);
    const weatherSounds = mapChannelSounds([
      ...(weatherPl?.sounds.contents || []),
      ...(netPl?.sounds.contents || [])
    ], channels.weather.activeSoundId);
    const sfxSounds = mapChannelSounds(sfxPl?.sounds.contents || [], channels.sfx.activeSoundId);

    const activeMood = controller.activeMood;
    const moods = {
      street: activeMood === "street",
      stealth: activeMood === "stealth",
      afterlife: activeMood === "afterlife",
      combat: activeMood === "combat",
      netrun: activeMood === "netrun",
      boss: activeMood === "boss"
    };

    // Tab 2: Synced Tracks Library grouped by Playlist
    const playlistGroups = [];
    const allSyncedTracks = [];

    const groupDefs = [
      { pl: combatPl, type: "music", label: "MUSIC" },
      { pl: clubsPl, type: "music", label: "MUSIC" },
      { pl: ambiencePl, type: "ambience", label: "AMBIENCE" },
      { pl: weatherPl, type: "weather", label: "WEATHER" },
      { pl: netPl, type: "weather", label: "NETRUN / DRONE" },
      { pl: sfxPl, type: "sfx", label: "SFX" }
    ];

    for (const g of groupDefs) {
      if (!g.pl) continue;
      const tracks = [];
      for (const s of g.pl.sounds) {
        const item = {
          id: s.id,
          name: s.name,
          playlistName: g.pl.name,
          channelType: g.type,
          channelLabel: g.label,
          repeat: s.repeat,
          volumePercent: Math.round((s.volume ?? 0.8) * 100),
          path: s.path
        };
        tracks.push(item);
        allSyncedTracks.push(item);
      }
      playlistGroups.push({
        playlistName: g.pl.name,
        channelType: g.type,
        channelLabel: g.label,
        count: tracks.length,
        tracks
      });
    }

    // Automation settings
    const automation = {
      autoCombatStart: game.settings.get("cyberpunk-red-audio-deck", "autoCombatStart"),
      autoCombatEnd: game.settings.get("cyberpunk-red-audio-deck", "autoCombatEnd"),
      autoCriticalHP: game.settings.get("cyberpunk-red-audio-deck", "autoCriticalHP"),
      autoBossTurn: game.settings.get("cyberpunk-red-audio-deck", "autoBossTurn")
    };

    // Scenes list
    const scenesList = (game.scenes || []).map(scene => {
      const preset = scene.getFlag("cyberpunk-red-audio-deck", "preset") || [];
      const musicItem = preset.find(p => p.channel === "music" || p.playlistName?.includes("Combat") || p.playlistName?.includes("Clubs"));
      const ambItem = preset.find(p => p.channel === "ambience" || p.playlistName?.includes("Ambience"));
      const droneItem = preset.find(p => p.channel === "weather" || p.playlistName?.includes("Weather") || p.playlistName?.includes("Netrunning"));

      return {
        id: scene.id,
        name: scene.name,
        isActive: scene.isView,
        musicBinding: musicItem ? `${musicItem.soundName} (${Math.round((musicItem.volume || 0.8)*100)}%)` : "Default Combat/Lounge (65%)",
        ambienceBinding: ambItem ? `${ambItem.soundName} (${Math.round((ambItem.volume || 0.6)*100)}%)` : "City Ambience (50%)",
        droneBinding: droneItem ? `${droneItem.soundName} (${Math.round((droneItem.volume || 0.4)*100)}%)` : "None"
      };
    });

    return {
      masterVolume: Math.round(controller.masterVolume * 100),
      crossfade: controller.fadeDuration,
      activeMood,
      moods,
      channels,
      channelSounds: {
        music: musicSounds,
        ambience: ambienceSounds,
        weather: weatherSounds,
        sfx: sfxSounds
      },
      playlistGroups,
      syncedTracks: allSyncedTracks,
      totalTrackCount: allSyncedTracks.length,
      compressCompleted: this.compressCompleted,
      activeCategoryFilter: this.activeCategoryFilter,
      searchQuery: this.searchQuery,
      automation,
      scenesList
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const controller = CPRAudioController.instance;

    // Tab switching
    html.find(".cpr-audio-tab-btn").on("click", (ev) => {
      ev.preventDefault();
      const tabName = $(ev.currentTarget).data("tab");
      this.activeTab = tabName;

      html.find(".cpr-audio-tab-btn").removeClass("active");
      $(ev.currentTarget).addClass("active");

      html.find(".cpr-tab-content").removeClass("active");
      html.find(`#tab-${tabName}`).addClass("active");
    });

    // Panic Fade All Button
    html.find(".action-panic-fade").on("click", async () => {
      await controller.panicFadeAll(2000);
      this.render(false);
    });

    // Master Volume Slider
    html.find(".cpr-master-slider").on("input", async (ev) => {
      const val = parseInt(ev.target.value, 10);
      html.find(".cpr-master-vol-label").text(`${val}%`);
      await controller.setMasterVolume(val / 100);
    });

    // Crossfade Selector
    html.find(".cpr-crossfade-select").on("change", (ev) => {
      controller.fadeDuration = parseInt(ev.target.value, 10);
      if (typeof ui !== "undefined") {
        ui.notifications.info(`Crossfade duration set to ${controller.fadeDuration}ms.`);
      }
    });

    // Channel Volume Sliders
    html.find(".channel-vol-slider").on("input", async (ev) => {
      const channel = $(ev.currentTarget).data("channel");
      const val = parseInt(ev.target.value, 10);
      $(ev.currentTarget).closest(".cpr-channel-strip").find(".vol-label").text(`${val}%`);
      await controller.setChannelVolume(channel, val / 100);
    });

    // Channel Loop Buttons
    html.find(".btn-loop").on("click", async (ev) => {
      const channel = $(ev.currentTarget).data("channel");
      const isLoop = await controller.toggleLoop(channel);
      $(ev.currentTarget).toggleClass("active-loop", isLoop);
    });

    // Channel Solo Buttons
    html.find(".btn-solo").on("click", async (ev) => {
      const channel = $(ev.currentTarget).data("channel");
      const isSolo = await controller.toggleSolo(channel);
      $(ev.currentTarget).toggleClass("active-solo", isSolo);
      this.render(false);
    });

    // Channel Mute Buttons
    html.find(".btn-mute").on("click", async (ev) => {
      const channel = $(ev.currentTarget).data("channel");
      const isMuted = await controller.toggleMute(channel);
      $(ev.currentTarget).toggleClass("active-mute", isMuted);
      this.render(false);
    });

    // Channel Play / Pause Buttons
    html.find(".btn-play").on("click", async (ev) => {
      const channel = $(ev.currentTarget).data("channel");
      const activeSound = controller.getChannelActiveSound(channel);

      if (activeSound && activeSound.playing) {
        await activeSound.parent.stopSound(activeSound);
        this.render(false);
      } else {
        // Select first available sound if none active
        const select = html.find(`.channel-sound-select[data-channel="${channel}"]`);
        const firstSoundId = select.val() || select.find("option:eq(1)").val();
        if (firstSoundId) {
          await controller.playChannelTrack(channel, firstSoundId);
          this.render(false);
        }
      }
    });

    // Channel Stop Button
    html.find(".btn-stop").on("click", async (ev) => {
      const channel = $(ev.currentTarget).data("channel");
      await controller.stopChannel(channel);
      this.render(false);
    });

    // Channel Sound Dropdown Selection (Strictly Isolated per Channel)
    html.find(".channel-sound-select").on("change", async (ev) => {
      const channel = $(ev.currentTarget).data("channel");
      const soundId = ev.target.value;
      if (!soundId) return;

      await controller.playChannelTrack(channel, soundId);
      this.render(false);
    });

    // Stinger Pad Grid Click
    html.find(".btn-play-stinger").on("click", async (ev) => {
      const type = $(ev.currentTarget).data("stinger");
      $(ev.currentTarget).addClass("active");
      setTimeout(() => $(ev.currentTarget).removeClass("active"), 400);

      await controller.playStinger(type);
    });

    // Mood Pads Trigger
    html.find(".btn-trigger-mood").on("click", async (ev) => {
      const mood = $(ev.currentTarget).data("mood");
      html.find(".btn-trigger-mood").removeClass("active");
      $(ev.currentTarget).addClass("active");

      await controller.triggerMood(mood);
      this.render(false);
    });

    // TAB 2: Filter & Compression Controls
    const searchInput = html.find(".filter-search-input");
    const queueContainer = html.find(".cpr-queue-container");
    const countLabel = html.find(".cpr-filtered-count");

    const applyTableFilters = () => {
      const query = (searchInput.val() || "").trim().toLowerCase();
      const filter = this.activeCategoryFilter;
      const compress = this.compressCompleted;

      let visibleCount = 0;

      html.find(".cpr-track-row").each(function () {
        const row = $(this);
        const name = (row.data("track-name") || "").toString().toLowerCase();
        const cat = row.data("category") || "all";
        const isSynced = row.data("synced") === true;

        const matchesQuery = !query || name.includes(query);
        const matchesCat = filter === "all" || cat === filter;
        const matchesCompress = !compress || !isSynced;

        if (matchesQuery && matchesCat && matchesCompress) {
          row.show();
          visibleCount++;
        } else {
          row.hide();
        }
      });

      // Update group headers visibility
      html.find(".cpr-group-header").each(function () {
        const header = $(this);
        const groupCat = header.data("category");
        if (filter !== "all" && groupCat !== filter) {
          header.hide();
        } else {
          header.show();
        }
      });

      if (countLabel.length > 0) {
        countLabel.text(`Showing ${visibleCount} Track(s)`);
      }
    };

    // Search Input Real-Time Filter
    searchInput.on("input", () => {
      this.searchQuery = searchInput.val();
      applyTableFilters();
    });

    // Category Filter Pills
    html.find(".cpr-filter-pill").on("click", (ev) => {
      ev.preventDefault();
      const pill = $(ev.currentTarget);
      this.activeCategoryFilter = pill.data("filter") || "all";

      html.find(".cpr-filter-pill").removeClass("active");
      pill.addClass("active");

      applyTableFilters();
    });

    // Compress / Collapse Completed Tracks Toggle
    html.find(".btn-compress-toggle").on("click", (ev) => {
      ev.preventDefault();
      this.compressCompleted = !this.compressCompleted;
      $(ev.currentTarget).toggleClass("active", this.compressCompleted);
      queueContainer.toggleClass("compressed-view", this.compressCompleted);

      const label = this.compressCompleted ? "[SHOW COMPLETED TRACKS]" : "[COMPRESS / HIDE COMPLETED TRACKS]";
      $(ev.currentTarget).html(`<i class="fas fa-compress-alt"></i> ${label}`);

      applyTableFilters();
    });

    // Collapsible Group Accordion Headers
    html.find(".cpr-group-header").on("click", (ev) => {
      const header = $(ev.currentTarget);
      const groupKey = header.data("group");
      const icon = header.find(".group-chevron");

      const rows = html.find(`.cpr-track-row[data-group="${groupKey}"]`);
      rows.toggle();
      const isVisible = rows.is(":visible");
      icon.toggleClass("fa-chevron-down", isVisible);
      icon.toggleClass("fa-chevron-right", !isVisible);
    });

    // Server Sync Button
    html.find(".action-sync-server").on("click", async () => {
      if (typeof ui !== "undefined") {
        ui.notifications.info("Scanning server storage (/Data/music/)...");
      }
      await controller.syncServerFolder(true);
      this.render(false);
    });

    // New Folder Button
    html.find(".action-new-folder").on("click", async () => {
      new Dialog({
        title: "Create Music Subfolder",
        content: `
          <div style="padding: 10px; font-family: var(--cpr-audio-font-display);">
            <p>Enter new directory name under <code>Data/music/</code>:</p>
            <input type="text" id="new-folder-name" class="cpr-select" style="width: 100%;" placeholder="e.g. boss-fights">
          </div>
        `,
        buttons: {
          create: {
            icon: '<i class="fas fa-check"></i>',
            label: "Create Directory",
            callback: async (dHtml) => {
              const name = dHtml.find("#new-folder-name").val().trim();
              if (!name) return;
              try {
                await FilePicker.createDirectory({ source: "data", target: `music/${name}` });
                if (typeof ui !== "undefined") {
                  ui.notifications.info(`Created directory: Data/music/${name}`);
                }
                this.render(false);
              } catch (err) {
                if (typeof ui !== "undefined") {
                  ui.notifications.error(`Failed to create directory: ${err.message}`);
                }
              }
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel"
          }
        }
      }).render(true);
    });

    // Dropzone Click to Browse
    const fileInput = html.find(".cpr-file-input");
    html.find(".cpr-dropzone").on("click", () => {
      fileInput.click();
    });

    // Dropzone Drag & Drop
    const dropzone = html.find(".cpr-dropzone");
    dropzone.on("dragover", (ev) => {
      ev.preventDefault();
      dropzone.addClass("dragover");
    });
    dropzone.on("dragleave", () => {
      dropzone.removeClass("dragover");
    });
    dropzone.on("drop", async (ev) => {
      ev.preventDefault();
      dropzone.removeClass("dragover");

      const files = ev.originalEvent.dataTransfer.files;
      if (files && files.length > 0) {
        await this._handleUploadedFiles(files, html);
      }
    });

    fileInput.on("change", async (ev) => {
      const files = ev.target.files;
      if (files && files.length > 0) {
        await this._handleUploadedFiles(files, html);
      }
    });

    // Rule Badges Toggle
    html.find(".btn-toggle-rule").on("click", async (ev) => {
      const ruleKey = $(ev.currentTarget).data("rule");
      const current = game.settings.get("cyberpunk-red-audio-deck", ruleKey);
      await game.settings.set("cyberpunk-red-audio-deck", ruleKey, !current);
      if (typeof ui !== "undefined") {
        ui.notifications.info(`Rule ${ruleKey} set to ${!current ? "ACTIVE" : "DISABLED"}`);
      }
      this.render(false);
    });

    // Bind Active Scene Button
    html.find(".action-bind-active-scene").on("click", async () => {
      await controller.bindActiveScene();
      this.render(false);
    });

    // Trigger Scene Preset Button
    html.find(".btn-apply-scene").on("click", async (ev) => {
      const sceneId = $(ev.currentTarget).data("scene-id");
      const scene = game.scenes.get(sceneId);
      if (scene) {
        await controller.applyScenePreset(scene);
      }
    });

    // Preview Track Button in Table
    html.find(".btn-preview-track").on("click", (ev) => {
      const path = $(ev.currentTarget).data("path");
      if (path) {
        foundry.audio.AudioHelper.play({ src: path, volume: 0.8, autoplay: true, loop: false }, false);
      }
    });
  }

  async _handleUploadedFiles(files, html) {
    const targetFolder = html.find(".target-folder-select").val() || "music/combat";
    if (typeof ui !== "undefined") {
      ui.notifications.info(`Uploading ${files.length} audio file(s) to ${targetFolder}...`);
    }

    let uploadedCount = 0;
    for (const file of Array.from(files)) {
      try {
        await FilePicker.upload("data", targetFolder, file, {}, { notify: false });
        uploadedCount++;
      } catch (err) {
        console.error(`CPRAudioDeck | Upload failed for ${file.name}:`, err);
      }
    }

    if (typeof ui !== "undefined") {
      ui.notifications.info(`Successfully uploaded ${uploadedCount} file(s). Syncing playlists...`);
    }
    await CPRAudioController.instance.syncServerFolder(false);
    this.render(false);
  }
}
