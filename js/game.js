import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.esm.js";
import {
  auth,
  roomRef,
  signIn,
  cleanRoomCode,
  makeRoomCode,
  getInviteRoomFromUrl,
  onValue,
  set,
  push,
  update,
  serverTimestamp,
  ref,
  db
} from "./firebase.js";
import { Multiplayer } from "./multiplayer.js";
import { Chat } from "./chat.js";
import {
  BENCHES,
  WORLD_SIZE,
  createTextures,
  drawWorld,
  createPlayerSprite,
  updatePlayerSprite,
  destroyPlayerSprite,
  isInsideHouse
} from "./world.js";
import {
  qs,
  setupTabs,
  setupChatUI,
  setupSharedPanels,
  setupActions,
  setupChrome,
  showToast
} from "./ui.js";

const state = {
  roomId: "",
  profile: null,
  multiplayer: null,
  scene: null,
  players: {},
  sprites: new Map(),
  furniture: new Map(),
  actionSeen: new Set(),
  music: null
};

class LittleWorldScene extends Phaser.Scene {
  constructor() {
    super("LittleWorldScene");
    this.cursors = null;
    this.keys = null;
    this.localSprite = null;
    this.nightOverlay = null;
  }

  preload() {}

  create() {
    state.scene = this;
    createTextures(this);
    drawWorld(this);

    this.localSprite = createPlayerSprite(this, {
      ...state.profile,
      x: 540,
      y: 520,
      online: true
    });
    state.sprites.set(state.multiplayer.playerKey, this.localSprite);
    this.cameras.main.startFollow(this.localSprite, true, 0.12, 0.12);
    this.cameras.main.setZoom(window.innerWidth < 760 ? 1.35 : 1.65);

    this.keys = this.input.keyboard.addKeys("W,A,S,D");
    this.cursors = this.input.keyboard.createCursorKeys();
    this.nightOverlay = this.add.rectangle(0, 0, WORLD_SIZE, WORLD_SIZE, 0x2a1f5f, 0).setOrigin(0).setDepth(100);
    this.nightOverlay.setScrollFactor(0);
    this.nightOverlay.setSize(window.innerWidth, window.innerHeight);

    this.scale.on("resize", (size) => {
      this.cameras.main.setZoom(size.width < 760 ? 1.35 : 1.65);
      this.nightOverlay.setSize(size.width, size.height);
    });

    listenWorldState(this);
  }

  update(_, delta) {
    if (!this.localSprite || !state.multiplayer) return;
    const speed = 150;
    const body = this.localSprite.body;
    body.setVelocity(0);

    let direction = "down";
    if (this.keys.A.isDown || this.cursors.left.isDown) {
      body.setVelocityX(-speed);
      direction = "left";
    } else if (this.keys.D.isDown || this.cursors.right.isDown) {
      body.setVelocityX(speed);
      direction = "right";
    }
    if (this.keys.W.isDown || this.cursors.up.isDown) {
      body.setVelocityY(-speed);
      direction = "up";
    } else if (this.keys.S.isDown || this.cursors.down.isDown) {
      body.setVelocityY(speed);
      direction = "down";
    }

    if (body.velocity.length() > 0) {
      body.velocity.normalize().scale(speed);
      this.localSprite.setFlipX(direction === "left");
    }

    updatePlayerSprite(this.localSprite, {
      ...state.profile,
      online: true
    });
    state.multiplayer.updatePosition({
      x: this.localSprite.x,
      y: this.localSprite.y,
      direction
    });

    for (const [playerKey, sprite] of state.sprites.entries()) {
      if (playerKey === state.multiplayer.playerKey) continue;
      const player = state.players[playerKey];
      if (!player) continue;
      if (qs("#smooth-toggle").checked) {
        sprite.x = Phaser.Math.Linear(sprite.x, player.x, Math.min(1, delta / 90));
        sprite.y = Phaser.Math.Linear(sprite.y, player.y, Math.min(1, delta / 90));
      } else {
        sprite.setPosition(player.x, player.y);
      }
      updatePlayerSprite(sprite, player);
    }

    const dayAmount = (Math.sin(Date.now() / 24000) + 1) / 2;
    this.nightOverlay.setAlpha(0.04 + (1 - dayAmount) * 0.3);
  }
}

async function boot() {
  qs("#loading-text").textContent = "Signing in anonymously...";
  await signIn();
  setupTabs();
  setupJoinScreen();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  qs("#loading-screen").classList.add("hidden");
  qs("#app").classList.remove("hidden");
}

function setupJoinScreen() {
  const roomInput = qs("#room-code");
  const inviteRoom = getInviteRoomFromUrl();
  roomInput.value = inviteRoom || makeRoomCode();
  qs("#player-name").value = localStorage.getItem("olw-name") || "";

  qs("#random-room").addEventListener("click", () => {
    roomInput.value = makeRoomCode();
  });

  document.querySelectorAll(".avatar-choice").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".avatar-choice").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    });
  });

  qs("#join-room").addEventListener("click", async () => {
    const name = qs("#player-name").value.trim().slice(0, 18) || "Sweetheart";
    const roomId = cleanRoomCode(roomInput.value || makeRoomCode());
    const avatar = document.querySelector(".avatar-choice.selected").dataset.avatar;
    localStorage.setItem("olw-name", name);
    await enterRoom(roomId, { name, avatar });
  });
}

async function enterRoom(roomId, profile) {
  qs("#join-error").textContent = "";
  qs("#join-room").disabled = true;
  try {
    state.roomId = roomId;
    state.profile = profile;
    state.multiplayer = new Multiplayer(roomId, profile);
    state.music = createMusicController(roomId);
    await state.multiplayer.join();

    qs("#join-screen").classList.add("hidden");
    qs("#game-screen").classList.remove("hidden");
    setupChrome(roomId);
    setupChatUI(new Chat(roomId, profile, state.multiplayer));
    setupSharedPanels(roomId, getLocalPosition, placeFurniture);
    setupActions(state.multiplayer, roomId, state.music);
    startGame();
    listenPlayers();
    listenConnection();
    listenMusic();
    history.replaceState(null, "", `?room=${encodeURIComponent(roomId)}`);
  } catch (error) {
    qs("#join-error").textContent = error.message || "Could not join this room.";
    qs("#join-room").disabled = false;
  }
}

function startGame() {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-container",
    backgroundColor: "#aee6aa",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight
    },
    physics: {
      default: "arcade",
      arcade: { debug: false }
    },
    scene: LittleWorldScene,
    pixelArt: true
  });
}

function listenPlayers() {
  state.multiplayer.listenPlayers((players) => {
    state.players = players;
    const online = Object.values(players).filter((player) => player.online).length;
    qs("#presence-label").textContent = `${online}/2 online`;

    for (const [playerKey, player] of Object.entries(players)) {
      if (!state.scene) continue;
      let sprite = state.sprites.get(playerKey);
      if (!sprite) {
        sprite = createPlayerSprite(state.scene, player);
        state.sprites.set(playerKey, sprite);
      }
      if (playerKey === state.multiplayer.playerKey && state.scene.localSprite) {
        sprite = state.scene.localSprite;
      }
      handlePlayerAction(playerKey, player, sprite);
      updatePlayerSprite(sprite, player);
    }

    for (const [playerKey, sprite] of state.sprites.entries()) {
      if (!players[playerKey]) {
        destroyPlayerSprite(sprite);
        state.sprites.delete(playerKey);
      }
    }
  });
}

function handlePlayerAction(playerKey, player, sprite) {
  if (!player.actionId || state.actionSeen.has(player.actionId)) return;
  state.actionSeen.add(player.actionId);
  const scene = state.scene;
  if (!scene || !sprite) return;

  if (player.action === "heart") makeFloatingText(scene, sprite.x, sprite.y - 42, "♥ ♥ ♥", "#ef4c9d");
  if (player.action === "hug") makeFloatingText(scene, sprite.x, sprite.y - 42, "hug", "#8d62d7");
  if (player.action === "kiss") makeFloatingText(scene, sprite.x, sprite.y - 42, "kiss", "#ef4c9d");
  if (player.action === "hands") {
    makeFloatingText(scene, sprite.x, sprite.y - 42, "holding hands", "#55a887");
    maybeSitTogether(player);
  }
  if (player.action === "gift") {
    scene.add.image(sprite.x, sprite.y - 28, "gift").setDepth(20);
    makeFloatingText(scene, sprite.x, sprite.y - 58, "gift", "#ef4c9d");
  }
}

function maybeSitTogether(player) {
  const other = Object.values(state.players).find((item) => item.uid !== player.uid);
  if (!other) return;
  const bench = BENCHES.find((item) => {
    const d1 = Phaser.Math.Distance.Between(player.x, player.y, item.x, item.y);
    const d2 = Phaser.Math.Distance.Between(other.x, other.y, item.x, item.y);
    return d1 < 95 && d2 < 95;
  });
  if (bench) showToast("You are sitting together");
}

function makeFloatingText(scene, x, y, text, color) {
  const node = scene.add.text(x, y, text, {
    fontFamily: "monospace",
    fontSize: "18px",
    color,
    backgroundColor: "rgba(255,255,255,0.76)",
    padding: { x: 7, y: 4 }
  }).setOrigin(0.5).setDepth(120);
  scene.tweens.add({
    targets: node,
    y: y - 70,
    alpha: 0,
    duration: 1400,
    ease: "Sine.easeOut",
    onComplete: () => node.destroy()
  });
}

function listenWorldState(scene) {
  onValue(roomRef(state.roomId, "world/furniture"), (snapshot) => {
    const items = snapshot.val() || {};
    for (const [id, node] of state.furniture.entries()) {
      if (!items[id]) {
        node.destroy();
        state.furniture.delete(id);
      }
    }
    Object.entries(items).forEach(([id, item]) => {
      if (state.furniture.has(id)) return;
      const node = drawFurniture(scene, item.type, item.x, item.y);
      state.furniture.set(id, node);
    });
  });
}

function drawFurniture(scene, type, x, y) {
  const colors = {
    sofa: 0xf58ac8,
    lamp: 0xffd86b,
    plant: 0x55caa4,
    rug: 0x8d62d7,
    table: 0xb47a50,
    frame: 0x94d4ff
  };
  const box = scene.add.rectangle(0, 0, type === "rug" ? 82 : 44, type === "rug" ? 38 : 44, colors[type] || 0xffffff);
  box.setStrokeStyle(4, 0xffffff, 0.8);
  const label = scene.add.text(0, 0, type[0].toUpperCase(), { fontFamily: "monospace", fontSize: "18px", color: "#432947" })
    .setOrigin(0.5)
    .setDepth(6);
  const node = scene.add.container(x, y, [box, label]);
  node.setDepth(5);
  return node;
}

async function placeFurniture(type, x, y) {
  await set(push(roomRef(state.roomId, "world/furniture")), {
    type,
    x: Math.round(x),
    y: Math.round(y),
    placedBy: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });
  showToast("Decoration placed");
}

function getLocalPosition() {
  const sprite = state.scene?.localSprite;
  if (!sprite) return null;
  return {
    x: sprite.x,
    y: sprite.y,
    insideHouse: isInsideHouse(sprite.x, sprite.y)
  };
}

function listenConnection() {
  onValue(ref(db, ".info/connected"), (snapshot) => {
    if (snapshot.val() === true) qs("#presence-label").classList.remove("offline");
    else qs("#presence-label").classList.add("offline");
  });
  window.addEventListener("beforeunload", () => {
    state.multiplayer?.leave();
  });
  window.addEventListener("online", () => showToast("Back online"));
  window.addEventListener("offline", () => showToast("Offline mode. Reconnecting soon."));
}

function createMusicController(roomId) {
  let audioContext = null;
  let oscillator = null;
  let gain = null;
  const start = () => {
    if (!qs("#sound-toggle").checked || oscillator) return;
    audioContext = audioContext || new AudioContext();
    oscillator = audioContext.createOscillator();
    gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 220;
    gain.gain.value = 0.035;
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
  };
  const stop = () => {
    oscillator?.stop();
    oscillator?.disconnect();
    oscillator = null;
  };
  return {
    async toggle() {
      const current = qs("#music-button").classList.toggle("active");
      await update(roomRef(roomId, "settings/music"), {
        playing: current,
        updatedAt: serverTimestamp()
      });
    },
    start,
    stop
  };
}

function listenMusic() {
  onValue(roomRef(state.roomId, "settings/music"), (snapshot) => {
    const music = snapshot.val() || {};
    qs("#music-button").classList.toggle("active", Boolean(music.playing));
    if (music.playing) state.music.start();
    else state.music.stop();
  });
}

boot().catch((error) => {
  qs("#loading-text").textContent = error.message || "Something went wrong.";
});
