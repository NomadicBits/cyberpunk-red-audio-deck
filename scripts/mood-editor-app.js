/**
 * Cyberpunk RED Audio Deck - Mood & Situation Matrix Configurator Window
 * Allows the DM to customize tracks, mix volumes, icons, and add new Mood Pads.
 */

import { CPRAudioController } from "./audio-controller.js";

export class CPRMoodEditorApp extends FormApplication {
  constructor(options = {}) {
    super({}, options);
    this.selectedMoodKey = options.selectedMood || "street";
    this.isCreatingNew = options.isCreatingNew || false;
    this.draftNewMood = null;
    this.onSaveCallback = options.onSave || null;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "cpr-mood-editor-app",
      title: "Mood & Situation Matrix Configurator // Track & Mix Editor",
      template: "modules/cyberpunk-red-audio-deck/templates/mood-editor.hbs",
      width: 820,
      height: 620,
      resizable: true,
      classes: ["cpr-audio-window", "cpr-mood-editor-window"]
    });
  }

  getData() {
    const controller = CPRAudioController.instance;
    const moodList = controller.getMoodPresetList();

    if (!this.isCreatingNew && !moodList.some(m => m.key === this.selectedMoodKey) && moodList.length > 0) {
      this.selectedMoodKey = moodList[0].key;
    }

    let currentMood = null;
    if (this.isCreatingNew) {
      currentMood = this.draftNewMood || {
        key: "new_custom_mood",
        label: "New Night City Mood",
        desc: "Custom multi-layer atmosphere mix",
        icon: "fas fa-sliders-h",
        colorHex: "#00f0ff",
        fade: 2500,
        stinger: "none",
        isDefault: false,
        isCustom: true,
        music: { mode: "auto", volume: 0.70 },
        ambience: { mode: "auto", volume: 0.55 },
        weather: { mode: "off", volume: 0.40 }
      };
    } else {
      currentMood = moodList.find(m => m.key === this.selectedMoodKey) || moodList[0];
    }

    const resolveLayerEditorState = (layer, defaultVol) => {
      if (!layer || layer.mode === "off" || layer.soundId === "off" || layer.enabled === false) {
        return { mode: "off", soundId: "off", volPct: Math.round((layer?.volume ?? defaultVol) * 100) };
      }
      const volPct = Math.round((layer.volume ?? defaultVol) * 100);
      if (layer.soundId && layer.soundId !== "auto") {
        return { mode: "track", soundId: layer.soundId, volPct };
      }
      return { mode: "auto", soundId: "auto", volPct };
    };

    const musicState = resolveLayerEditorState(currentMood?.music, 0.70);
    const ambState = resolveLayerEditorState(currentMood?.ambience, 0.55);
    const weatherState = resolveLayerEditorState(currentMood?.weather, 0.45);

    // Collect tracks by category for dropdowns
    const collectPlaylistTracks = (plNames, selectedId) => {
      const list = [];
      for (const name of plNames) {
        const pl = game.playlists.getName(name);
        if (!pl) continue;
        for (const s of pl.sounds) {
          list.push({
            id: s.id,
            name: s.name,
            playlistName: pl.name.replace("NC Audio // ", ""),
            selected: s.id === selectedId
          });
        }
      }
      return list;
    };

    const musicTracks = collectPlaylistTracks(["NC Audio // Combat", "NC Audio // Clubs & Lounge"], musicState.soundId);
    const ambienceTracks = collectPlaylistTracks(["NC Audio // Ambience"], ambState.soundId);
    const weatherTracks = collectPlaylistTracks(["NC Audio // Weather & Drones", "NC Audio // Netrunning"], weatherState.soundId);

    const musicIds = new Set(musicTracks.map(t => t.id));
    const ambIds = new Set(ambienceTracks.map(t => t.id));
    const weatherIds = new Set(weatherTracks.map(t => t.id));

    const allTracks = [];
    for (const pl of game.playlists) {
      for (const s of pl.sounds) {
        allTracks.push({
          id: s.id,
          name: s.name,
          playlistName: pl.name.replace("NC Audio // ", ""),
          selectedOtherMusic: !musicIds.has(s.id) && s.id === musicState.soundId,
          selectedOtherAmbience: !ambIds.has(s.id) && s.id === ambState.soundId,
          selectedOtherWeather: !weatherIds.has(s.id) && s.id === weatherState.soundId
        });
      }
    }

    const iconChoices = [
      { value: "fas fa-walking", label: "Street / Walking" },
      { value: "fas fa-user-secret", label: "Stealth / Infiltration" },
      { value: "fas fa-cocktail", label: "Club / Lounge / Fixer" },
      { value: "fas fa-fire", label: "Combat / Firefight" },
      { value: "fas fa-network-wired", label: "Netrun / Cyberspace" },
      { value: "fas fa-skull", label: "Boss / Cyberpsycho" },
      { value: "fas fa-car", label: "Vehicle Chase / Nomad" },
      { value: "fas fa-ambulance", label: "Trauma Team / Medtech" },
      { value: "fas fa-building", label: "Corp Plaza / Arasaka" },
      { value: "fas fa-biohazard", label: "Combat Zone / Red Chrome" },
      { value: "fas fa-sliders-h", label: "Custom Soundscape" }
    ];

    const colorChoices = [
      { value: "#00f0ff", label: "Neon Cyan (#00f0ff)" },
      { value: "#ff003c", label: "Crimson Red (#ff003c)" },
      { value: "#ffe600", label: "Cyber Yellow (#ffe600)" },
      { value: "#00ff66", label: "Biotech Green (#00ff66)" },
      { value: "#a855f7", label: "Stealth Purple (#a855f7)" },
      { value: "#38bdf8", label: "Netrun Ice Blue (#38bdf8)" },
      { value: "#ec4899", label: "Neon Magenta (#ec4899)" }
    ];

    const fadeChoices = [
      { value: 1500, label: "1.5s Fast Cut" },
      { value: 2000, label: "2.0s Standard" },
      { value: 2500, label: "2.5s Smooth S-Curve" },
      { value: 3000, label: "3.0s Atmospheric" },
      { value: 4000, label: "4.0s Slow Cinematic" }
    ];

    const stingerChoices = [
      { value: "none", label: "None (Crossfade Only)" },
      { value: "trauma", label: "Trauma Team Siren" },
      { value: "ncpd", label: "NCPD Alarm Pulse" },
      { value: "emp", label: "EMP Blast Shockwave" },
      { value: "breach", label: "Breach Complete" },
      { value: "flatline", label: "Flatline Beep" },
      { value: "door", label: "Door Hack Bypass" },
      { value: "gunfire", label: "Distant Gunfire" },
      { value: "panic", label: "Crowd Panic / Riot" }
    ];

    return {
      isCreatingNew: this.isCreatingNew,
      moodList: moodList.map(m => ({
        ...m,
        isSelected: !this.isCreatingNew && m.key === currentMood?.key
      })),
      editing: {
        key: currentMood?.key || "new_custom_mood",
        label: currentMood?.label || "New Mood",
        desc: currentMood?.desc || "",
        icon: currentMood?.icon || "fas fa-sliders-h",
        colorHex: currentMood?.colorHex || "#00f0ff",
        fade: currentMood?.fade || 2500,
        stinger: currentMood?.stinger || "none",
        isDefault: !!currentMood?.isDefault,
        isCustom: !!currentMood?.isCustom,
        isCustomized: !!currentMood?.isCustomized,
        musicMode: musicState.soundId,
        musicVolPct: musicState.volPct,
        ambienceMode: ambState.soundId,
        ambienceVolPct: ambState.volPct,
        weatherMode: weatherState.soundId,
        weatherVolPct: weatherState.volPct
      },
      canDeleteOrReset: !this.isCreatingNew && (currentMood?.isCustom || currentMood?.isCustomized),
      iconOptions: iconChoices.map(o => ({ ...o, selected: o.value === (currentMood?.icon || "fas fa-sliders-h") })),
      colorOptions: colorChoices.map(o => ({ ...o, selected: o.value === (currentMood?.colorHex || "#00f0ff") })),
      fadeOptions: fadeChoices.map(o => ({ ...o, selected: o.value === parseInt(currentMood?.fade || 2500, 10) })),
      stingerOptions: stingerChoices.map(o => ({ ...o, selected: o.value === (currentMood?.stinger || "none") })),
      trackOptions: {
        music: musicTracks,
        ambience: ambienceTracks,
        weather: weatherTracks,
        all: allTracks
      }
    };
  }

  _readFormPresetData(html) {
    const label = html.find(".mood-input-label").val()?.trim() || "Custom Mood";
    const desc = html.find(".mood-input-desc").val()?.trim() || "Custom multi-layer atmosphere mix";
    const icon = html.find(".mood-input-icon").val() || "fas fa-sliders-h";
    const colorHex = html.find(".mood-input-color").val() || "#00f0ff";
    const fade = parseInt(html.find(".mood-input-fade").val() || "2500", 10);
    const stinger = html.find(".mood-input-stinger").val() || "none";

    const buildLayerFromSelect = (selectVal, volVal) => {
      const volume = Math.min(Math.max(parseInt(volVal || "60", 10) / 100, 0), 1);
      if (!selectVal || selectVal === "off") {
        return { mode: "off", soundId: "off", volume };
      }
      if (selectVal === "auto") {
        return { mode: "auto", soundId: "auto", volume };
      }
      return { mode: "track", soundId: selectVal, volume };
    };

    return {
      label,
      desc,
      icon,
      colorHex,
      fade,
      stinger,
      music: buildLayerFromSelect(html.find(".mood-music-track").val(), html.find(".mood-music-vol").val()),
      ambience: buildLayerFromSelect(html.find(".mood-ambience-track").val(), html.find(".mood-ambience-vol").val()),
      weather: buildLayerFromSelect(html.find(".mood-weather-track").val(), html.find(".mood-weather-vol").val())
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const controller = CPRAudioController.instance;

    // Select Mood from Sidebar
    html.find(".cpr-mood-list-item").on("click", (ev) => {
      const key = $(ev.currentTarget).data("mood-key");
      this.selectedMoodKey = key;
      this.isCreatingNew = false;
      this.render(false);
    });

    // + Add New Mood Selection Button
    html.find(".btn-new-mood").on("click", () => {
      this.isCreatingNew = true;
      this.draftNewMood = {
        key: "new_custom_mood",
        label: "New Night City Mood",
        desc: "Custom multi-layer atmosphere mix",
        icon: "fas fa-sliders-h",
        colorHex: "#00f0ff",
        fade: 2500,
        stinger: "none",
        music: { mode: "auto", volume: 0.70 },
        ambience: { mode: "auto", volume: 0.55 },
        weather: { mode: "off", volume: 0.40 }
      };
      this.render(false);
    });

    // Capture Live Mix as New Mood
    html.find(".btn-capture-live-mood").on("click", async () => {
      const created = await controller.createMoodFromActiveMix(
        `Live Mix (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
        "Captured from active 4-channel soundboard mix",
        "#00ff66",
        "fas fa-sliders-h"
      );
      this.isCreatingNew = false;
      this.selectedMoodKey = created.key;
      if (typeof ui !== "undefined" && ui.notifications) {
        ui.notifications.info(`Captured active mix as "${created.label}"!`);
      }
      this.render(false);
      if (this.onSaveCallback) this.onSaveCallback();
    });

    // Live Volume Slider Readouts
    html.find(".mood-music-vol").on("input", (ev) => {
      html.find(".music-vol-label").text(`${ev.target.value}%`);
    });
    html.find(".mood-ambience-vol").on("input", (ev) => {
      html.find(".ambience-vol-label").text(`${ev.target.value}%`);
    });
    html.find(".mood-weather-vol").on("input", (ev) => {
      html.find(".weather-vol-label").text(`${ev.target.value}%`);
    });

    // Save Mood Selection
    html.find(".btn-save-mood").on("click", async () => {
      const formData = this._readFormPresetData(html);
      const targetKey = this.isCreatingNew ? null : this.selectedMoodKey;
      const saved = await controller.saveMoodPreset(targetKey, formData);

      this.isCreatingNew = false;
      this.selectedMoodKey = saved.key;

      if (typeof ui !== "undefined" && ui.notifications) {
        ui.notifications.info(`Saved Mood Preset: "${saved.label}"`);
      }

      this.render(false);
      if (this.onSaveCallback) this.onSaveCallback();
    });

    // Test / Preview Mix Live
    html.find(".btn-preview-mood-mix").on("click", async () => {
      const formData = this._readFormPresetData(html);
      const targetKey = this.isCreatingNew ? null : this.selectedMoodKey;
      const saved = await controller.saveMoodPreset(targetKey, formData);

      this.isCreatingNew = false;
      this.selectedMoodKey = saved.key;

      await controller.triggerMood(saved.key);
      this.render(false);
      if (this.onSaveCallback) this.onSaveCallback();
    });

    // Delete Custom Mood / Reset Default Mood
    html.find(".btn-delete-mood").on("click", async () => {
      if (this.isCreatingNew) return;
      await controller.deleteMoodPreset(this.selectedMoodKey);
      if (typeof ui !== "undefined" && ui.notifications) {
        ui.notifications.info(`Reset / removed mood preset "${this.selectedMoodKey}".`);
      }
      this.selectedMoodKey = "street";
      this.render(false);
      if (this.onSaveCallback) this.onSaveCallback();
    });

    // Reset All to Factory Defaults
    html.find(".btn-reset-all-moods").on("click", async () => {
      await controller.resetMoodPresets();
      this.isCreatingNew = false;
      this.selectedMoodKey = "street";
      if (typeof ui !== "undefined" && ui.notifications) {
        ui.notifications.info("All Mood Matrix presets restored to factory defaults.");
      }
      this.render(false);
      if (this.onSaveCallback) this.onSaveCallback();
    });
  }
}
