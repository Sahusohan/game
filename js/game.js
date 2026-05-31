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
  createWorld,
  createPlayerSprite,
  updatePlayerSprite,
  animatePlayer,
  destroyPlayerSprite,
  setPlayerPosition,
  createFloatingText,
  createChatBubble,
  updateFloating,
  updateWorldEffects,
  createFurniture,
  setHouseWallColor,
  isInsideHouse,
  clampToWorld,
  toWorldX,
  toWorldZ
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
  world: null,
  players: {},
  sprites: new Map(),
  furniture: new Map(),
  actionSeen: new Set(),
  music: null,
  joystick: { active: false, x: 0, y: 0 },
  keys: new Set(),
  localPlayer: null,
  animationFrame: 0,
  camera: { yaw: 0, zoom: 1, dragging: false, lastX: 0 },
  weather: "clear",
  chase: {
    game: null,
    syncing: false,
    lastRoleKey: "",
    lastResultKey: ""
  },
  interaction: {
    lastId: "",
    motion: null
  }
};

async function boot() {
  qs("#loading-text").textContent = "Signing in anonymously...";
  await signIn();
  setupTabs();
  setupJoinScreen();
  setupKeyboard();
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
    setupChatUI(new Chat(roomId, profile, state.multiplayer), showChatBubble);
    setupSharedPanels(roomId, getLocalPosition, placeFurniture);
    setupActions(state.multiplayer, roomId, state.music, handleActionRequest);
    setupCollapsibleChat();
    setupJoystick();
    setupChaseUI();
    startGame();
    setupCameraControls();
    listenPlayers();
    listenRoomSettings();
    listenChaseGame();
    listenPairInteractions();
    listenConnection();
    listenMusic();
    history.replaceState(null, "", `?room=${encodeURIComponent(roomId)}`);
  } catch (error) {
    qs("#join-error").textContent = error.message || "Could not join this room.";
    qs("#join-room").disabled = false;
  }
}

function startGame() {
  state.world = createWorld(qs("#game-container"));
  state.localPlayer = {
    uid: auth.currentUser.uid,
    name: state.profile.name,
    avatar: state.profile.avatar,
    x: 540,
    y: 520,
    online: true
  };
  const localSprite = createPlayerSprite(state.world, state.localPlayer);
  state.sprites.set(state.multiplayer.playerKey, localSprite);
  listenWorldState();
  animate();
}

function setupKeyboard() {
  window.addEventListener("keydown", (event) => {
    if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    state.keys.add(event.key.toLowerCase());
  });
  window.addEventListener("keyup", (event) => {
    state.keys.delete(event.key.toLowerCase());
  });
}

function animate() {
  const world = state.world;
  if (!world) return;
  const delta = Math.min(world.clock.getDelta(), 0.05);

  updateLocalPlayer(delta);
  updateRemotePlayers(delta);
  updateCamera(delta);
  updateWorldEffects(world, state.weather);
  updateChaseGame();
  updateFloating(world);
  world.renderer.render(world.scene, world.camera);
  state.animationFrame = requestAnimationFrame(animate);
}

function updateLocalPlayer(delta) {
  if (!state.localPlayer || !state.multiplayer) return;
  const sprite = state.sprites.get(state.multiplayer.playerKey);
  if (!sprite) return;
  if (applyPairInteractionMotion(sprite)) return;

  const keyboardVector = getKeyboardVector();
  const joystickVector = state.joystick.active ? state.joystick : { x: 0, y: 0 };
  const moveX = keyboardVector.x || joystickVector.x;
  const moveY = keyboardVector.y || joystickVector.y;
  const speed = getMovementSpeed();

  let direction = state.localPlayer.direction || "down";
  if (moveX || moveY) {
    state.localPlayer.x = clampToWorld(state.localPlayer.x + moveX * speed * delta);
    state.localPlayer.y = clampToWorld(state.localPlayer.y + moveY * speed * delta);
    if (Math.abs(moveX) > Math.abs(moveY)) {
      direction = moveX < 0 ? "left" : "right";
    } else {
      direction = moveY < 0 ? "up" : "down";
    }
    rotatePlayer(sprite, direction);
  }

  state.localPlayer.direction = direction;
  setPlayerPosition(sprite, state.localPlayer.x, state.localPlayer.y);
  animatePlayer(sprite, Boolean(moveX || moveY), performance.now() * 0.001, state.localPlayer.action);
  updatePlayerSprite(sprite, state.localPlayer, state.world.camera);
  state.multiplayer.updatePosition({
    x: state.localPlayer.x,
    y: state.localPlayer.y,
    direction
  });
}

function applyPairInteractionMotion(sprite) {
  const motion = state.interaction.motion;
  if (!motion || !state.localPlayer || !state.multiplayer) return false;

  const now = performance.now();
  const local = state.localPlayer;
  const partnerPos = { x: motion.partnerTargetX, y: motion.partnerTargetY };

  if (motion.phase === "approach") {
    const t = Math.min(1, (now - motion.startAt) / motion.approachMs);
    const eased = t * t * (3 - 2 * t);
    local.x = clampToWorld(motion.startX + (motion.targetX - motion.startX) * eased);
    local.y = clampToWorld(motion.startY + (motion.targetY - motion.startY) * eased);
    local.direction = directionFromDelta(partnerPos.x - local.x, partnerPos.y - local.y, local.direction);
    local.action = "";
    setPlayerPosition(sprite, local.x, local.y);
    rotatePlayer(sprite, local.direction);
    animatePlayer(sprite, true, performance.now() * 0.001, "");
    updatePlayerSprite(sprite, local, state.world.camera);
    state.multiplayer.updatePosition({
      x: local.x,
      y: local.y,
      direction: local.direction
    }, true);
    if (t >= 1) {
      motion.phase = "hold";
      motion.holdStart = now;
      local.action = motion.action;
      if (!motion.sentAction) {
        state.multiplayer.sendAction(motion.action).catch(() => {});
        motion.sentAction = true;
      }
    }
    return true;
  }

  local.x = clampToWorld(motion.targetX);
  local.y = clampToWorld(motion.targetY);
  local.direction = directionFromDelta(partnerPos.x - local.x, partnerPos.y - local.y, local.direction);
  local.action = motion.action;
  setPlayerPosition(sprite, local.x, local.y);
  rotatePlayer(sprite, local.direction);
  animatePlayer(sprite, false, performance.now() * 0.001, motion.action);
  updatePlayerSprite(sprite, local, state.world.camera);
  state.multiplayer.updatePosition({
    x: local.x,
    y: local.y,
    direction: local.direction
  }, true);

  if (now - motion.holdStart >= motion.holdMs) {
    local.action = "";
    state.multiplayer.sendAction("").catch(() => {});
    state.interaction.motion = null;
  }
  return true;
}

function updateRemotePlayers(delta) {
  for (const [playerKey, sprite] of state.sprites.entries()) {
    if (playerKey === state.multiplayer.playerKey) continue;
    const player = state.players[playerKey];
    if (!player) continue;
    const targetX = toWorldX(player.x);
    const targetZ = toWorldZ(player.y);
    const t = qs("#smooth-toggle").checked ? Math.min(1, delta * 9) : 1;
    sprite.position.x += (targetX - sprite.position.x) * t;
    sprite.position.z += (targetZ - sprite.position.z) * t;
    sprite.userData.mapX = player.x;
    sprite.userData.mapY = player.y;
    rotatePlayer(sprite, player.direction || "down");
    animatePlayer(sprite, Math.hypot(targetX - sprite.position.x, targetZ - sprite.position.z) > 0.02, performance.now() * 0.001, player.action);
    updatePlayerSprite(sprite, player, state.world.camera);
  }
}

function updateCamera(delta) {
  const sprite = state.sprites.get(state.multiplayer.playerKey);
  if (!sprite) return;
  const camera = state.world.camera;
  const target = sprite.position;
  const desired = {
    x: target.x + Math.sin(state.camera.yaw) * 18 * state.camera.zoom,
    y: window.innerWidth < 760 ? 28 : 36,
    z: target.z + Math.cos(state.camera.yaw) * (window.innerWidth < 760 ? 34 : 42) * state.camera.zoom
  };
  const t = Math.min(1, delta * 4);
  camera.position.x += (desired.x - camera.position.x) * t;
  camera.position.y += (desired.y - camera.position.y) * t;
  camera.position.z += (desired.z - camera.position.z) * t;
  camera.lookAt(target.x, 1.5, target.z);
}

function getKeyboardVector() {
  const x = Number(state.keys.has("d") || state.keys.has("arrowright")) -
    Number(state.keys.has("a") || state.keys.has("arrowleft"));
  const y = Number(state.keys.has("s") || state.keys.has("arrowdown")) -
    Number(state.keys.has("w") || state.keys.has("arrowup"));
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function directionFromDelta(dx, dy, fallback = "down") {
  if (!dx && !dy) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

function setupJoystick() {
  const base = qs("#joystick");
  const thumb = qs("#joystick-thumb");
  if (!base || base.dataset.ready) return;
  base.dataset.ready = "true";

  const reset = () => {
    state.joystick = { active: false, x: 0, y: 0 };
    base.classList.remove("active");
    thumb.style.transform = "translate(-50%, -50%)";
  };

  const move = (event) => {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDistance = rect.width * 0.32;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const clamped = Math.min(distance, maxDistance);
    const angle = Math.atan2(rawY, rawX);
    const x = Math.cos(angle) * clamped;
    const y = Math.sin(angle) * clamped;
    const strength = clamped / maxDistance;

    thumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    state.joystick = {
      active: strength > 0.12,
      x: strength > 0.12 ? (x / maxDistance) : 0,
      y: strength > 0.12 ? (y / maxDistance) : 0
    };
  };

  base.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    base.setPointerCapture(event.pointerId);
    base.classList.add("active");
    move(event);
  });
  base.addEventListener("pointermove", (event) => {
    if (!base.classList.contains("active")) return;
    event.preventDefault();
    move(event);
  });
  base.addEventListener("pointerup", reset);
  base.addEventListener("pointercancel", reset);
  base.addEventListener("lostpointercapture", reset);
}

function setupCameraControls() {
  const container = qs("#game-container");
  if (!container || container.dataset.cameraReady) return;
  container.dataset.cameraReady = "true";
  container.addEventListener("wheel", (event) => {
    event.preventDefault();
    state.camera.zoom = Math.max(0.65, Math.min(1.45, state.camera.zoom + Math.sign(event.deltaY) * 0.08));
  }, { passive: false });
  container.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 2) return;
    state.camera.dragging = true;
    state.camera.lastX = event.clientX;
  });
  container.addEventListener("pointermove", (event) => {
    if (!state.camera.dragging) return;
    state.camera.yaw -= (event.clientX - state.camera.lastX) * 0.008;
    state.camera.lastX = event.clientX;
  });
  window.addEventListener("pointerup", () => {
    state.camera.dragging = false;
  });
  container.addEventListener("contextmenu", (event) => event.preventDefault());
}

function setupCollapsibleChat() {
  const panel = qs("#side-panel");
  const toggle = qs("#chat-toggle");
  if (!panel || !toggle || toggle.dataset.ready) return;
  toggle.dataset.ready = "true";

  toggle.addEventListener("click", () => {
    const collapsed = panel.classList.toggle("collapsed");
    toggle.textContent = collapsed ? "Show chat" : "Hide chat";
  });
}

function setupChaseUI() {
  const button = qs("#start-chase-button");
  if (!button || button.dataset.ready) return;
  button.dataset.ready = "true";
  button.addEventListener("click", () => startChaseGame());
}

async function handleActionRequest(action) {
  if (action !== "hug" && action !== "kiss") return false;
  await triggerPairInteraction(action);
  return true;
}

async function triggerPairInteraction(action) {
  if (state.interaction.motion) {
    showToast("Please wait for this interaction to finish");
    return;
  }

  const pair = pickPartnerForInteraction();
  if (!pair) {
    showToast("Your partner needs to be online");
    return;
  }

  const spacing = action === "kiss" ? 36 : 44;
  const targets = computePairTargets(pair.local, pair.partner, spacing);
  const interaction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: action,
    fromUid: auth.currentUser.uid,
    toUid: pair.partner.uid,
    fromX: targets.local.x,
    fromY: targets.local.y,
    toX: targets.partner.x,
    toY: targets.partner.y,
    approachMs: 480,
    durationMs: 1100,
    status: "active",
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await set(roomRef(state.roomId, "worldState/interaction"), interaction);
}

function pickPartnerForInteraction() {
  if (!state.localPlayer) return null;
  const partner = Object.values(state.players).find((player) => (
    player?.uid &&
    player.uid !== auth.currentUser.uid &&
    player.online
  ));
  if (!partner) return null;
  return { local: state.localPlayer, partner };
}

function computePairTargets(local, partner, gap) {
  const dx = (partner.x ?? 0) - (local.x ?? 0);
  const dy = (partner.y ?? 0) - (local.y ?? 0);
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const midX = (local.x + partner.x) / 2;
  const midY = (local.y + partner.y) / 2;
  return {
    local: {
      x: Math.round(clampToWorld(midX - ux * (gap / 2))),
      y: Math.round(clampToWorld(midY - uy * (gap / 2)))
    },
    partner: {
      x: Math.round(clampToWorld(midX + ux * (gap / 2))),
      y: Math.round(clampToWorld(midY + uy * (gap / 2)))
    }
  };
}

async function startChaseGame() {
  const players = Object.values(state.players).filter((player) => player?.uid);
  if (players.length < 2) {
    showToast("Two players are needed to start chase mode");
    return;
  }
  const pick = Math.random() < 0.5 ? 0 : 1;
  const policeUid = players[pick].uid;
  const thiefUid = players[1 - pick].uid;
  state.chase.syncing = true;
  await set(roomRef(state.roomId, "worldState/game"), {
    mode: "chase",
    active: true,
    status: "running",
    starterUid: auth.currentUser.uid,
    policeUid,
    thiefUid,
    winnerUid: "",
    reason: "",
    durationSec: 70,
    catchDistance: 30,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }).finally(() => {
    state.chase.syncing = false;
  });
}

function listenChaseGame() {
  onValue(roomRef(state.roomId, "worldState/game"), (snapshot) => {
    state.chase.game = snapshot.val() || null;
    updateChaseHud();
    announceChaseRole();
    announceChaseResult();
  });
}

function listenPairInteractions() {
  onValue(roomRef(state.roomId, "worldState/interaction"), (snapshot) => {
    const interaction = snapshot.val();
    if (!interaction?.id || interaction.status !== "active") return;
    if (interaction.id === state.interaction.lastId) return;
    state.interaction.lastId = interaction.id;
    startPairInteraction(interaction);
  });
}

function startPairInteraction(interaction) {
  const isFrom = interaction.fromUid === auth.currentUser.uid;
  const isTo = interaction.toUid === auth.currentUser.uid;
  if (!isFrom && !isTo) return;
  if (!state.localPlayer) return;

  const action = interaction.type === "kiss" ? "kiss" : "hug";
  const targetX = clampToWorld(isFrom ? interaction.fromX : interaction.toX);
  const targetY = clampToWorld(isFrom ? interaction.fromY : interaction.toY);
  const partnerTargetX = clampToWorld(isFrom ? interaction.toX : interaction.fromX);
  const partnerTargetY = clampToWorld(isFrom ? interaction.toY : interaction.fromY);

  state.interaction.motion = {
    id: interaction.id,
    action,
    phase: "approach",
    startAt: performance.now(),
    startX: state.localPlayer.x,
    startY: state.localPlayer.y,
    targetX,
    targetY,
    partnerTargetX,
    partnerTargetY,
    approachMs: Number(interaction.approachMs) > 0 ? Number(interaction.approachMs) : 480,
    holdMs: Number(interaction.durationMs) > 0 ? Number(interaction.durationMs) : 1100,
    sentAction: false
  };
}

function updateChaseHud() {
  const status = qs("#chase-status");
  const startButton = qs("#start-chase-button");
  if (!status || !startButton) return;
  const game = state.chase.game;
  startButton.classList.toggle("running", Boolean(game?.active));
  if (!game || !game.mode) {
    status.textContent = "Chase: idle";
    startButton.textContent = "Start Chase";
    return;
  }

  const startedAt = getTimestampValue(game.startedAt);
  if (game.status === "running" && startedAt && game.durationSec) {
    const remainMs = Math.max(0, startedAt + game.durationSec * 1000 - Date.now());
    const remainSec = Math.ceil(remainMs / 1000);
    status.textContent = `Chase: ${remainSec}s`;
    startButton.textContent = "Restart Chase";
    return;
  }

  if (game.status === "ended") {
    status.textContent = "Chase: finished";
  } else {
    status.textContent = "Chase: ready";
  }
  startButton.textContent = "Start Chase";
}

function announceChaseRole() {
  const game = state.chase.game;
  if (!game?.active || game.status !== "running") return;
  const role = getLocalRole(game);
  if (!role) return;
  const key = `${getTimestampValue(game.startedAt)}:${role}`;
  if (state.chase.lastRoleKey === key) return;
  state.chase.lastRoleKey = key;
  showToast(role === "police" ? "You are Police. Catch the Thief!" : "You are Thief. Run!");
}

function announceChaseResult() {
  const game = state.chase.game;
  if (!game || game.status !== "ended" || !game.winnerUid) return;
  const key = `${game.endedAt || game.updatedAt}:${game.winnerUid}`;
  if (state.chase.lastResultKey === key) return;
  state.chase.lastResultKey = key;

  const winner = game.winnerUid === auth.currentUser.uid ? "You win!" : "Partner wins!";
  const reason = game.reason === "caught" ? "Police caught the thief" : "Time up";
  showToast(`${winner} ${reason}`);
  const winnerSprite = findSpriteByUid(game.winnerUid);
  if (winnerSprite) createFloatingText(state.world, winnerSprite, "Winner!", "#ff4f9f", 2200);
}

function updateChaseGame() {
  updateChaseHud();
  const game = state.chase.game;
  if (!game || !game.active || game.status !== "running" || state.chase.syncing) return;
  const police = getPlayerByUid(game.policeUid);
  const thief = getPlayerByUid(game.thiefUid);
  if (!police || !thief) return;

  const catchDistance = Math.max(18, Number(game.catchDistance || 30));
  const distance = Math.hypot(police.x - thief.x, police.y - thief.y);
  if (distance <= catchDistance && getLocalRole(game)) {
    finishChaseGame(game.policeUid, "caught");
    return;
  }

  const startedAt = getTimestampValue(game.startedAt);
  const isExpired = startedAt && game.durationSec && Date.now() >= (startedAt + game.durationSec * 1000);
  if (isExpired) {
    finishChaseGame(game.thiefUid, "timeout");
  }
}

async function finishChaseGame(winnerUid, reason) {
  const game = state.chase.game;
  if (!game || game.status !== "running" || state.chase.syncing) return;
  state.chase.syncing = true;
  await update(roomRef(state.roomId, "worldState/game"), {
    active: false,
    status: "ended",
    winnerUid,
    reason,
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }).finally(() => {
    state.chase.syncing = false;
  });
}

function getLocalRole(game) {
  if (!game) return "";
  if (game.policeUid === auth.currentUser.uid) return "police";
  if (game.thiefUid === auth.currentUser.uid) return "thief";
  return "";
}

function getMovementSpeed() {
  const base = 185;
  const game = state.chase.game;
  if (!game || !game.active || game.status !== "running") return base;
  const role = getLocalRole(game);
  if (role === "police") return 200;
  if (role === "thief") return 192;
  return base;
}

function getPlayerByUid(uid) {
  if (!uid) return null;
  if (uid === auth.currentUser.uid && state.localPlayer) return state.localPlayer;
  return Object.values(state.players).find((player) => player.uid === uid) || null;
}

function findSpriteByUid(uid) {
  if (!uid) return null;
  if (uid === auth.currentUser.uid) return state.sprites.get(state.multiplayer.playerKey) || null;
  const entry = Object.entries(state.players).find(([, player]) => player.uid === uid);
  return entry ? (state.sprites.get(entry[0]) || null) : null;
}

function getTimestampValue(value) {
  return typeof value === "number" ? value : 0;
}

function listenPlayers() {
  state.multiplayer.listenPlayers((players) => {
    state.players = players;
    const online = Object.values(players).filter((player) => player.online).length;
    qs("#presence-label").textContent = `${online}/2 online`;

    for (const [playerKey, player] of Object.entries(players)) {
      if (!state.world) continue;
      let sprite = state.sprites.get(playerKey);
      if (!sprite) {
        sprite = createPlayerSprite(state.world, player);
        state.sprites.set(playerKey, sprite);
      }
      if (playerKey === state.multiplayer.playerKey) {
        state.localPlayer = {
          ...state.localPlayer,
          name: player.name,
          avatar: player.avatar,
          online: player.online,
          action: player.action,
          uid: auth.currentUser.uid
        };
      }
      handlePlayerAction(player, sprite);
      updatePlayerSprite(sprite, player, state.world.camera);
    }

    for (const [playerKey, sprite] of state.sprites.entries()) {
      if (!players[playerKey]) {
        destroyPlayerSprite(sprite, state.world);
        state.sprites.delete(playerKey);
      }
    }
  });
}

function listenRoomSettings() {
  const select = qs("#weather-select");
  select?.addEventListener("change", async () => {
    state.weather = select.value;
    await update(roomRef(state.roomId, "worldState"), {
      weather: select.value,
      updatedAt: serverTimestamp()
    });
  });

  document.querySelectorAll("[data-wall-color]").forEach((button) => {
    button.addEventListener("click", async () => {
      const color = button.dataset.wallColor;
      setHouseWallColor(state.world, color);
      await update(roomRef(state.roomId, "house/walls"), {
        color,
        updatedAt: serverTimestamp()
      });
    });
  });

  onValue(roomRef(state.roomId, "worldState"), (snapshot) => {
    const worldState = snapshot.val() || {};
    state.weather = worldState.weather || "clear";
    if (select && select.value !== state.weather) select.value = state.weather;
  });

  onValue(roomRef(state.roomId, "house/walls"), (snapshot) => {
    setHouseWallColor(state.world, snapshot.val()?.color || "fff5fb");
  });
}

function handlePlayerAction(player, sprite) {
  if (!player.actionId || state.actionSeen.has(player.actionId)) return;
  state.actionSeen.add(player.actionId);
  if (!state.world || !sprite) return;

  if (player.action === "heart") createFloatingText(state.world, sprite, "heart heart heart", "#ef4c9d");
  if (player.action === "hug") createFloatingText(state.world, sprite, "hug", "#8d62d7");
  if (player.action === "kiss") createFloatingText(state.world, sprite, "kiss", "#ef4c9d");
  if (player.action === "hands") {
    createFloatingText(state.world, sprite, "holding hands", "#55a887");
    maybeSitTogether(player);
  }
  if (player.action === "gift") {
    createFloatingText(state.world, sprite, "gift", "#ef4c9d");
  }
}

function maybeSitTogether(player) {
  const other = Object.values(state.players).find((item) => item.uid !== player.uid);
  if (!other) return;
  const bench = BENCHES.find((item) => {
    const d1 = Math.hypot(player.x - item.x, player.y - item.y);
    const d2 = Math.hypot(other.x - item.x, other.y - item.y);
    return d1 < 95 && d2 < 95;
  });
  if (bench) showToast("You are sitting together");
}

function showChatBubble(message) {
  const world = state.world;
  if (!world || !message?.text) return;
  const entry = Object.entries(state.players).find(([, player]) => player.uid === message.uid);
  const sprite = message.uid === auth.currentUser.uid
    ? state.sprites.get(state.multiplayer.playerKey)
    : entry ? state.sprites.get(entry[0]) : null;
  if (!sprite) return;
  createChatBubble(world, sprite, message.text);
}

function listenWorldState() {
  onValue(roomRef(state.roomId, "house/furniture"), (snapshot) => {
    const items = snapshot.val() || {};
    for (const [id, node] of state.furniture.entries()) {
      if (!items[id]) {
        state.world.scene.remove(node);
        state.furniture.delete(id);
      }
    }
    Object.entries(items).forEach(([id, item]) => {
      if (state.furniture.has(id)) return;
      const node = createFurniture(state.world, item.type, item.x, item.y);
      state.furniture.set(id, node);
    });
  });
}

async function placeFurniture(type, x, y) {
  await set(push(roomRef(state.roomId, "house/furniture")), {
    type,
    x: Math.round(x),
    y: Math.round(y),
    placedBy: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });
  showToast("Decoration placed");
}

function getLocalPosition() {
  if (!state.localPlayer) return null;
  return {
    x: state.localPlayer.x,
    y: state.localPlayer.y,
    insideHouse: isInsideHouse(state.localPlayer.x, state.localPlayer.y)
  };
}

function listenConnection() {
  onValue(ref(db, ".info/connected"), (snapshot) => {
    if (snapshot.val() === true) qs("#presence-label").classList.remove("offline");
    else qs("#presence-label").classList.add("offline");
  });
  window.addEventListener("beforeunload", () => {
    state.multiplayer?.leave();
    cancelAnimationFrame(state.animationFrame);
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

function rotatePlayer(sprite, direction) {
  const rotations = {
    down: 0,
    up: Math.PI,
    left: -Math.PI / 2,
    right: Math.PI / 2
  };
  sprite.rotation.y = rotations[direction] ?? sprite.rotation.y;
}

boot().catch((error) => {
  qs("#loading-text").textContent = error.message || "Something went wrong.";
});
