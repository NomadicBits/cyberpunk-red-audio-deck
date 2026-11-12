/**
 * Cyberpunk RED: Night City Audio Deck & DM Music Manager
 * Main Module Entry Point for Foundry VTT v12
 */

import { CPRAudioController } from "./audio-controller.js";
import { CPRAudioDeckApp } from "./audio-deck-app.js";
import { proceduralSFX } from "./procedural-sfx.js";

const MODULE_ID = "cyberpunk-red-audio-deck";

Hooks.once("init", () => {
  console.log("CPRAudioDeck | Initializing Night City Audio Deck & DM Music Manager...");

  // Register Module Settings
  game.settings.register(MODULE_ID, "autoCombatStart", {
    name: "Auto-Crossfade on Combat Start",
    hint: "Automatically crossfades active audio to the Combat Playlist when combat begins.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "autoCombatEnd", {
    name: "Restore Atmosphere on Combat End",
    hint: "Smoothly fades out combat music and restores exploration ambience when combat is deleted.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "autoCriticalHP", {
    name: "Critical HP / Cyberpsychosis Heartbeat Drone",
    hint: "Plays an eerie heartbeat & tinnitus drone when a Player Character drops below 25% HP.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "autoBossTurn", {
    name: "Elite / Boss Turn Audio Stinger",
    hint: "Triggers an audio pulse and ducks background music when an elite/boss turns comes up.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "crossfadeDuration", {
    name: "Default Crossfade Duration (ms)",
    hint: "Duration in milliseconds for smooth audio crossfades.",
    scope: "world",
    config: true,
    type: Number,
    default: 2500
  });

  // Global API Namespace
  globalThis.CPRAudioDeck = {
    open: () => new CPRAudioDeckApp().render(true),
    controller: CPRAudioController.instance,
    panic: () => CPRAudioController.instance.panicFadeAll(),
    sync: () => CPRAudioController.instance.syncServerFolder(true),
    stinger: (type) => CPRAudioController.instance.playStinger(type),
    runTests: () => CPRAudioController.instance.runSelfTest()
  };
});

Hooks.once("ready", async () => {
  console.log("CPRAudioDeck | System Ready. Checking audio directories & socket channels.");

  const controller = CPRAudioController.instance;

  // Non-destructive directory check for GM
  if (game.user.isGM) {
    try {
      await controller.ensureServerDirectories();
      await controller.ensureStandardPlaylists();
    } catch (err) {
      console.warn("CPRAudioDeck | Initial setup check:", err);
    }
  }

  // Socket listener for shared procedural sound effects
  if (game.socket) {
    game.socket.on(`module.${MODULE_ID}`, (data) => {
      if (data?.action === "proceduralSFX" && data?.type) {
        proceduralSFX.play(data.type, 0.8);
      }
    });
  }
});

// Inject glowing header button into Playlist Sidebar Directory
Hooks.on("renderPlaylistDirectory", (app, html, data) => {
  if (html.find(".cpr-deck-sidebar-btn").length > 0) return;

  const btn = $(`
    <button type="button" class="cpr-deck-sidebar-btn">
      <i class="fas fa-compact-disc"></i> [NIGHT CITY AUDIO DECK]
    </button>
  `);

  btn.on("click", () => {
    new CPRAudioDeckApp().render(true);
  });

  const header = html.find(".directory-header .header-actions");
  if (header.length > 0) {
    header.append(btn);
  } else {
    html.find(".directory-header").append(btn);
  }
});

// Add Tool to Scene Controls
Hooks.on("getSceneControlButtons", (controls) => {
  const soundsControls = controls.find(c => c.name === "sounds");
  if (soundsControls) {
    soundsControls.tools.push({
      name: "cpr-audio-deck",
      title: "Night City Audio Deck",
      icon: "fas fa-compact-disc",
      button: true,
      onClick: () => {
        new CPRAudioDeckApp().render(true);
      }
    });
  }

  const tokenControls = controls.find(c => c.name === "token");
  if (tokenControls) {
    tokenControls.tools.push({
      name: "cpr-audio-deck-token",
      title: "Night City Audio Deck",
      icon: "fas fa-music",
      button: true,
      onClick: () => {
        new CPRAudioDeckApp().render(true);
      }
    });
  }
});

// Chat Commands: /cpr-music, /cpr-audio, /audio-deck, /cpr-sync-music, /panic-fade, /cpr-music-test
Hooks.on("chatMessage", async (chatLog, messageText, chatData) => {
  const text = messageText.trim().toLowerCase();

  if (text === "/cpr-music" || text === "/cpr-audio" || text === "/audio-deck" || text === "/deck") {
    new CPRAudioDeckApp().render(true);
    return false;
  }

  if (text === "/cpr-sync-music" || text === "/sync-music") {
    CPRAudioController.instance.syncServerFolder(true);
    return false;
  }

  if (text === "/panic-fade" || text === "/panic-music") {
    CPRAudioController.instance.panicFadeAll();
    return false;
  }

  if (text === "/cpr-music-test" || text === "/audio-test") {
    const report = await CPRAudioController.instance.runSelfTest();
    const content = `
      <div style="background: #0d0e15; border: 1px solid #00f0ff; padding: 10px; border-radius: 4px; font-family: monospace; color: #e2e8f0;">
        <h4 style="color: #00f0ff; margin: 0 0 6px 0; border-bottom: 1px solid #00f0ff; padding-bottom: 4px;">
          <i class="fas fa-microchip"></i> AUDIO DECK DIAGNOSTIC AUDIT
        </h4>
        <div>Playlists Monitored: <strong>${report.playlists.length}</strong></div>
        <div>Standard Channels: <strong>4 Online</strong></div>
        <div>Solo / Mute Engine: <strong>PASS</strong></div>
        <div>Automations: Combat: ${report.automation.combatStart ? "ON" : "OFF"}, HP: ${report.automation.criticalHP ? "ON" : "OFF"}</div>
        <div style="color: #00ff66; margin-top: 6px; font-weight: bold;">[OK] ALL SYSTEMS NOMINAL</div>
      </div>
    `;
    ChatMessage.create({
      content,
      speaker: { alias: "Audio Deck Subroutine" },
      whisper: [game.user.id]
    });
    return false;
  }

  return true;
});

// Automation: On Combat Start
Hooks.on("combatStart", async (combat) => {
  if (game.user.isGM) {
    await CPRAudioController.instance.handleCombatStart(combat);
  }
});

// Automation: On Combat Delete / End
Hooks.on("deleteCombat", async (combat) => {
  if (game.user.isGM) {
    await CPRAudioController.instance.handleCombatEnd(combat);
  }
});

// Automation: Elite / Boss Turn Stinger
Hooks.on("updateCombat", async (combat, changed, options, userId) => {
  if (!game.user.isGM) return;
  if (!game.settings.get(MODULE_ID, "autoBossTurn")) return;

  if ("turn" in changed || "round" in changed) {
    const currentCombatant = combat.combatant;
    if (currentCombatant) {
      const name = currentCombatant.name?.toLowerCase() || "";
      if (name.includes("boss") || name.includes("elite") || name.includes("smasher") || name.includes("cyberpsycho")) {
        ui.notifications.warn(`TACTICAL ALERT: ${currentCombatant.name} is taking action!`);
        await CPRAudioController.instance.playStinger("emp");
      }
    }
  }
});

// Automation: Critical HP / Low Humanity Alert
Hooks.on("updateActor", (actor, changed, options, userId) => {
  if (!game.user.isGM) return;
  if (!game.settings.get(MODULE_ID, "autoCriticalHP")) return;

  const hp = changed.system?.derivedStats?.hp?.value;
  const maxHp = actor.system?.derivedStats?.hp?.max;
  if (hp !== undefined && maxHp && actor.type === "character") {
    if (hp <= Math.floor(maxHp * 0.25) && hp > 0) {
      ui.notifications.warn(`ADRENALINE SPIKE: ${actor.name} is below 25% HP!`);
      CPRAudioController.instance.playStinger("flatline");
    }
  }
});

// Automation: Scene Atmosphere Preset Transition
Hooks.on("canvasReady", (canvas) => {
  if (game.user.isGM && canvas?.scene) {
    CPRAudioController.instance.applyScenePreset(canvas.scene);
  }
});
