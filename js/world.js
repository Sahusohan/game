import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const WORLD_SIZE = 2400;
export const HOUSE_RECT = { x: 1550, y: 250, width: 430, height: 330 };
export const BENCHES = [
  { x: 760, y: 770 },
  { x: 1050, y: 1320 },
  { x: 1780, y: 570 }
];

const SCALE = 0.055;
const HALF_WORLD = WORLD_SIZE / 2;

const AVATAR_COLORS = {
  rose: { shirt: 0xf05fa8, hair: 0x5a3328, pants: 0x6d6ee8, accent: 0xffbddf },
  mint: { shirt: 0x55caa4, hair: 0x2f2730, pants: 0x8d62d7, accent: 0xc8ffe8 },
  sunset: { shirt: 0xff9864, hair: 0x6b3f22, pants: 0x4b67d1, accent: 0xffd37d },
  moon: { shirt: 0x6d6ee8, hair: 0x352b5f, pants: 0x26395f, accent: 0xdfe9ff }
};

const MATERIALS = new Map();
const MODEL_LOADER = new GLTFLoader();

export function toWorldX(x) {
  return (x - HALF_WORLD) * SCALE;
}

export function toWorldZ(y) {
  return (y - HALF_WORLD) * SCALE;
}

export function fromWorldX(x) {
  return x / SCALE + HALF_WORLD;
}

export function fromWorldZ(z) {
  return z / SCALE + HALF_WORLD;
}

export function createWorld(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5ecff);
  scene.fog = new THREE.Fog(0xf5ecff, 75, 185);

  const camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.1, 500);
  camera.position.set(0, 34, 42);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.replaceChildren(renderer.domElement);

  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-38, 70, 28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffd5ec, 0x77b978, 1.65));

  const stars = createStars();
  scene.add(stars);
  const fireflies = createFireflies();
  scene.add(fireflies);

  addGround(scene);
  addPaths(scene);
  addLake(scene);
  addBeach(scene);
  addPark(scene);
  addWaterfall(scene);
  addMountain(scene);
  addCafe(scene);
  const houseWallMaterial = new THREE.MeshStandardMaterial({ color: 0xfff5fb, roughness: 0.78 });
  addHouse(scene, houseWallMaterial);
  addDecor(scene);
  const weather = createWeather(scene);

  const nightOverlay = new THREE.HemisphereLight(0xaab7ff, 0x42505a, 0);
  scene.add(nightOverlay);

  const world = {
    scene,
    camera,
    renderer,
    clock: new THREE.Clock(),
    floating: [],
    nightOverlay,
    sun,
    stars,
    fireflies,
    weather,
    houseWallMaterial,
    dispose() {
      renderer.dispose();
      container.replaceChildren();
    },
    resize() {
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
  };

  window.addEventListener("resize", () => world.resize());
  return world;
}

export function createPlayerSprite(world, player) {
  const colors = AVATAR_COLORS[player.avatar || "rose"] || AVATAR_COLORS.rose;
  const group = new THREE.Group();
  group.position.set(toWorldX(player.x), 0, toWorldZ(player.y));
  group.userData.mapX = player.x;
  group.userData.mapY = player.y;
  group.userData.targetX = player.x;
  group.userData.targetY = player.y;
  group.userData.name = player.name || "Love";

  const skin = material(0xf2b38f);
  const hair = material(colors.hair);
  const shirt = material(colors.shirt);
  const pants = material(colors.pants);
  const dark = material(0x31243a);

  addBox(group, [0, 2.15, 0], [0.72, 0.86, 0.55], skin);
  addBox(group, [0, 2.62, -0.03], [0.82, 0.24, 0.62], hair);
  addBox(group, [-0.46, 2.35, 0], [0.18, 0.48, 0.6], hair);
  addBox(group, [0.46, 2.35, 0], [0.18, 0.48, 0.6], hair);
  addBox(group, [-0.16, 2.16, -0.31], [0.08, 0.08, 0.05], dark);
  addBox(group, [0.16, 2.16, -0.31], [0.08, 0.08, 0.05], dark);
  addBox(group, [0, 1.38, 0], [0.82, 0.98, 0.5], shirt);
  const leftArm = addBox(group, [-0.58, 1.36, 0], [0.2, 0.82, 0.24], skin);
  const rightArm = addBox(group, [0.58, 1.36, 0], [0.2, 0.82, 0.24], skin);
  const leftLeg = addBox(group, [-0.22, 0.48, 0], [0.28, 0.9, 0.28], pants);
  const rightLeg = addBox(group, [0.22, 0.48, 0], [0.28, 0.9, 0.28], pants);
  addBox(group, [-0.22, 0.05, -0.08], [0.36, 0.16, 0.42], dark);
  addBox(group, [0.22, 0.05, -0.08], [0.36, 0.16, 0.42], dark);
  group.userData.limbs = { leftArm, rightArm, leftLeg, rightLeg };

  group.userData.label = createTextSprite(player.name || "Love", {
    fontSize: 44,
    color: "#432947",
    background: "rgba(255,255,255,0.82)"
  });
  group.userData.label.position.set(0, 3.35, 0);
  group.add(group.userData.label);

  group.userData.statusDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshStandardMaterial({ color: player.online ? 0x5de08d : 0xb0a2b4, roughness: 0.65 })
  );
  group.userData.statusDot.position.set(0.86, 3.2, 0);
  group.add(group.userData.statusDot);

  world.scene.add(group);
  return group;
}

export function animatePlayer(group, moving, elapsed, action = "") {
  const limbs = group.userData.limbs;
  if (!limbs) return;
  const pace = moving ? Math.sin(elapsed * 9) * 0.42 : Math.sin(elapsed * 2.2) * 0.06;
  limbs.leftArm.rotation.x = pace;
  limbs.rightArm.rotation.x = -pace;
  limbs.leftLeg.rotation.x = -pace;
  limbs.rightLeg.rotation.x = pace;
  group.position.y = moving ? Math.abs(Math.sin(elapsed * 9)) * 0.08 : Math.sin(elapsed * 2) * 0.025;

  if (action === "hug" || action === "hands") {
    limbs.leftArm.rotation.z = -0.75;
    limbs.rightArm.rotation.z = 0.75;
  } else if (action === "kiss") {
    group.rotation.z = Math.sin(elapsed * 4) * 0.04;
  } else {
    limbs.leftArm.rotation.z = 0;
    limbs.rightArm.rotation.z = 0;
    group.rotation.z = 0;
  }
}

export function updatePlayerSprite(group, player, camera) {
  group.userData.targetX = player.x;
  group.userData.targetY = player.y;
  group.userData.mapX = player.x;
  group.userData.mapY = player.y;

  const name = player.name || "Love";
  if (group.userData.name !== name) {
    group.userData.name = name;
    group.remove(group.userData.label);
    group.userData.label.material.map.dispose();
    group.userData.label.material.dispose();
    group.userData.label = createTextSprite(name, {
      fontSize: 44,
      color: "#432947",
      background: "rgba(255,255,255,0.82)"
    });
    group.userData.label.position.set(0, 3.35, 0);
    group.add(group.userData.label);
  }

  group.userData.statusDot.material.color.set(player.online ? 0x5de08d : 0xb0a2b4);
  group.userData.label.lookAt(camera.position);
}

export function destroyPlayerSprite(group, world) {
  world.scene.remove(group);
  group.traverse((node) => {
    node.geometry?.dispose?.();
    if (node.material?.map) node.material.map.dispose();
    if (node.material?.map) node.material.dispose();
  });
}

export function setPlayerPosition(group, x, y) {
  group.userData.mapX = x;
  group.userData.mapY = y;
  group.position.set(toWorldX(x), 0, toWorldZ(y));
}

export function createFloatingText(world, target, text, color = "#ef4c9d", duration = 1400) {
  const sprite = createTextSprite(text, {
    fontSize: 46,
    color,
    background: "rgba(255,255,255,0.82)"
  });
  sprite.position.set(target.position.x, target.position.y + 3.7, target.position.z);
  world.scene.add(sprite);
  world.floating.push({
    sprite,
    target,
    start: performance.now(),
    duration,
    follow: false,
    offset: new THREE.Vector3(0, 3.8, 0)
  });
  return sprite;
}

export function createChatBubble(world, target, text) {
  const sprite = createTextSprite(text.slice(0, 90), {
    fontSize: 34,
    color: "#432947",
    background: "rgba(255,255,255,0.9)",
    maxWidth: 360
  });
  sprite.position.copy(target.position).add(new THREE.Vector3(0, 4.15, 0));
  world.scene.add(sprite);
  world.floating.push({
    sprite,
    target,
    start: performance.now(),
    duration: 5000,
    follow: true,
    offset: new THREE.Vector3(0, 4.15, 0)
  });
}

export function updateFloating(world) {
  const now = performance.now();
  world.floating = world.floating.filter((item) => {
    const t = Math.min(1, (now - item.start) / item.duration);
    if (item.follow && item.target.parent) {
      item.sprite.position.copy(item.target.position).add(item.offset);
    } else {
      item.sprite.position.y += 0.012;
    }
    item.sprite.lookAt(world.camera.position);
    item.sprite.material.opacity = t < 0.82 ? 1 : Math.max(0, 1 - (t - 0.82) / 0.18);
    if (t < 1) return true;
    world.scene.remove(item.sprite);
    item.sprite.material.map.dispose();
    item.sprite.material.dispose();
    return false;
  });
}

export function updateWorldEffects(world, weatherMode = "clear") {
  const elapsed = performance.now() * 0.001;
  const dayAmount = (Math.sin(Date.now() / 24000) + 1) / 2;
  world.sun.intensity = weatherMode === "sunset" ? 1.25 : 1.45 + dayAmount * 1.1;
  world.sun.color.set(weatherMode === "sunset" ? 0xff9f6e : 0xffffff);
  world.scene.background.set(weatherMode === "sunset" ? 0xffc6a5 : dayAmount < 0.25 ? 0x232349 : 0xf5ecff);
  world.scene.fog.color.copy(world.scene.background);
  world.stars.visible = dayAmount < 0.35 || weatherMode === "snow";
  world.fireflies.visible = dayAmount < 0.38 && weatherMode !== "rain";
  if (world.fireflies.visible) animateFireflies(world.fireflies, elapsed);

  const rain = world.weather.rain;
  const snow = world.weather.snow;
  rain.position.set(world.camera.position.x, 0, world.camera.position.z - 18);
  snow.position.copy(rain.position);
  rain.visible = weatherMode === "rain";
  snow.visible = weatherMode === "snow";
  if (rain.visible) animateWeather(rain, -0.95, elapsed);
  if (snow.visible) animateWeather(snow, -0.22, elapsed);
}

export function setHouseWallColor(world, color) {
  const value = Number.parseInt(String(color || "fff5fb").replace("#", ""), 16);
  if (Number.isFinite(value)) {
    world.houseWallMaterial.color.set(value);
  }
}

export async function loadGLTFModel(url) {
  return MODEL_LOADER.loadAsync(url);
}

export function createFurniture(world, type, x, y) {
  const group = new THREE.Group();
  group.position.set(toWorldX(x), 0.05, toWorldZ(y));
  const colors = {
    sofa: 0xf58ac8,
    lamp: 0xffd86b,
    plant: 0x55caa4,
    rug: 0x8d62d7,
    table: 0xb47a50,
    frame: 0x94d4ff
  };

  if (type === "rug") {
    addBox(group, [0, 0.02, 0], [2.4, 0.04, 1.3], material(colors[type]));
  } else if (type === "lamp") {
    addBox(group, [0, 0.45, 0], [0.18, 0.9, 0.18], material(0x8d62d7));
    addBox(group, [0, 1.05, 0], [0.8, 0.48, 0.8], material(colors[type]));
  } else if (type === "plant") {
    addBox(group, [0, 0.22, 0], [0.55, 0.42, 0.55], material(0xb47a50));
    addCone(group, [0, 0.88, 0], 0.55, 0.9, material(colors[type]));
  } else {
    addBox(group, [0, 0.38, 0], [1.25, 0.72, 0.8], material(colors[type]));
  }

  world.scene.add(group);
  return group;
}

export function isInsideHouse(x, y) {
  return (
    x >= HOUSE_RECT.x &&
    x <= HOUSE_RECT.x + HOUSE_RECT.width &&
    y >= HOUSE_RECT.y &&
    y <= HOUSE_RECT.y + HOUSE_RECT.height
  );
}

export function clampToWorld(value) {
  return Math.max(0, Math.min(WORLD_SIZE, value));
}

function addGround(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE * SCALE, WORLD_SIZE * SCALE, 120, 120),
    new THREE.MeshStandardMaterial({ color: 0xaee6aa, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

function addPaths(scene) {
  const points = [
    [520, 520],
    [920, 880],
    [1060, 1300],
    [1730, 520]
  ];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    addPathSegment(scene, ax, ay, bx, by, 2.4);
  }
}

function addPathSegment(scene, ax, ay, bx, by, width) {
  const x1 = toWorldX(ax);
  const z1 = toWorldZ(ay);
  const x2 = toWorldX(bx);
  const z2 = toWorldZ(by);
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const path = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.05, length),
    material(0xf7cfa9)
  );
  path.position.set((x1 + x2) / 2, 0.035, (z1 + z2) / 2);
  path.rotation.y = Math.atan2(dx, dz);
  path.receiveShadow = true;
  scene.add(path);
}

function addLake(scene) {
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(13.5, 64),
    new THREE.MeshStandardMaterial({ color: 0x73c9f4, roughness: 0.35, metalness: 0.05 })
  );
  lake.scale.set(1.2, 0.68, 1);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(toWorldX(490), 0.07, toWorldZ(450));
  scene.add(lake);
}

function addBeach(scene) {
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE * SCALE, 620 * SCALE),
    material(0xffdf94)
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.04, toWorldZ(2090));
  scene.add(beach);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE * SCALE, 360 * SCALE),
    new THREE.MeshStandardMaterial({ color: 0x66c9ef, roughness: 0.4 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.06, toWorldZ(2220));
  scene.add(ocean);
}

function addPark(scene) {
  const park = new THREE.Mesh(
    new THREE.BoxGeometry(620 * SCALE, 0.06, 420 * SCALE),
    material(0x8ee29a)
  );
  park.position.set(toWorldX(1010), 0.05, toWorldZ(1290));
  park.receiveShadow = true;
  scene.add(park);
}

function addWaterfall(scene) {
  const cliff = new THREE.Group();
  cliff.position.set(toWorldX(420), 0, toWorldZ(1180));
  addBox(cliff, [0, 4, 0], [8, 8, 3], material(0x8b8ca3));
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 7.5),
    new THREE.MeshStandardMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.78, roughness: 0.2 })
  );
  water.position.set(0, 3.9, -1.56);
  cliff.add(water);
  scene.add(cliff);
}

function addMountain(scene) {
  const mountain = new THREE.Group();
  mountain.position.set(toWorldX(2050), 0, toWorldZ(1120));
  addCone(mountain, [0, 7, 0], 9, 14, material(0x9b9dac));
  addCone(mountain, [0, 13, 0], 3.8, 4.6, material(0xf5f2ff));
  addBox(mountain, [0, 0.18, -7], [7, 0.36, 4], material(0xf7cfa9));
  scene.add(mountain);
}

function addCafe(scene) {
  const cafe = new THREE.Group();
  cafe.position.set(toWorldX(1280), 0, toWorldZ(780));
  addBox(cafe, [0, 1.35, 0], [5.8, 2.7, 4.2], material(0xffe3bd));
  addBox(cafe, [0, 3, -0.2], [6.5, 0.55, 4.8], material(0xef4c9d));
  addBox(cafe, [-1.6, 0.8, -2.15], [1.1, 1.6, 0.14], material(0x8d62d7));
  addBox(cafe, [1.35, 1.6, -2.2], [1.55, 1.0, 0.12], material(0x94d4ff));
  scene.add(cafe);
}

function addHouse(scene, houseWallMaterial) {
  const house = new THREE.Group();
  house.position.set(toWorldX(1765), 0, toWorldZ(415));
  addBox(house, [0, 1.7, 0], [9.6, 3.4, 6.8], houseWallMaterial);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(6.8, 2.2, 4),
    material(0xf05fa8)
  );
  roof.position.set(0, 4.25, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  house.add(roof);
  addBox(house, [-2.5, 0.85, -3.45], [1.45, 1.7, 0.16], material(0x8d62d7));
  addBox(house, [2.35, 2.0, -3.5], [1.6, 1.1, 0.12], material(0x94d4ff));
  scene.add(house);
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 420; i += 1) {
    const radius = 75 + Math.random() * 90;
    const angle = Math.random() * Math.PI * 2;
    positions.push(Math.cos(angle) * radius, 38 + Math.random() * 70, Math.sin(angle) * radius);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, transparent: true, opacity: 0.86 })
  );
}

function createFireflies() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 90; i += 1) {
    positions.push((Math.random() - 0.5) * 90, 1 + Math.random() * 5, (Math.random() - 0.5) * 90);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xfff48a, size: 0.18, transparent: true, opacity: 0.8 })
  );
  points.visible = false;
  return points;
}

function createWeather(scene) {
  const rain = createParticleField(520, 0x9bd7ff, 0.08);
  const snow = createParticleField(360, 0xffffff, 0.2);
  rain.visible = false;
  snow.visible = false;
  scene.add(rain, snow);
  return { rain, snow };
}

function createParticleField(count, color, size) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    positions.push((Math.random() - 0.5) * 135, 8 + Math.random() * 55, (Math.random() - 0.5) * 135);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.76 })
  );
}

function animateWeather(points, fallSpeed, elapsed) {
  const pos = points.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i) + fallSpeed;
    pos.setY(i, y < 0 ? 60 + ((i * 13 + elapsed) % 8) : y);
    if (fallSpeed > -0.4) {
      pos.setX(i, pos.getX(i) + Math.sin(elapsed + i) * 0.012);
    }
  }
  pos.needsUpdate = true;
}

function animateFireflies(points, elapsed) {
  const pos = points.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    pos.setY(i, 1.5 + ((i * 0.13) % 4) + Math.sin(elapsed * 1.6 + i) * 0.25);
    pos.setX(i, pos.getX(i) + Math.sin(elapsed + i) * 0.006);
  }
  pos.needsUpdate = true;
}

function addDecor(scene) {
  const trees = [
    [140, 120], [360, 130], [750, 260], [1030, 240], [1380, 180], [2110, 220],
    [270, 850], [530, 960], [1430, 980], [2050, 850], [410, 1460], [1510, 1500],
    [2140, 1450], [580, 1650], [1340, 1740]
  ];
  trees.forEach(([x, y]) => addTree(scene, x, y));
  BENCHES.forEach((bench) => addBench(scene, bench.x, bench.y));

  for (let i = 0; i < 90; i += 1) {
    const x = 90 + ((i * 137) % 2150);
    const y = 120 + ((i * 89) % 1620);
    if (isInsideHouse(x, y)) continue;
    addFlower(scene, x, y, i);
  }
}

function addTree(scene, x, y) {
  const tree = new THREE.Group();
  tree.position.set(toWorldX(x), 0, toWorldZ(y));
  addBox(tree, [0, 1.1, 0], [0.7, 2.2, 0.7], material(0x875738));
  addCone(tree, [0, 3.1, 0], 1.6, 3.2, material(0x4fb66e));
  addCone(tree, [0, 4.2, 0], 1.25, 2.3, material(0x58c878));
  scene.add(tree);
}

function addBench(scene, x, y) {
  const bench = new THREE.Group();
  bench.position.set(toWorldX(x), 0, toWorldZ(y));
  addBox(bench, [0, 0.72, 0], [3.0, 0.28, 0.7], material(0xa96b44));
  addBox(bench, [0, 1.25, 0.32], [3.0, 0.28, 0.28], material(0x8b5a3a));
  addBox(bench, [-1.1, 0.32, 0], [0.22, 0.64, 0.24], material(0x5a3b2c));
  addBox(bench, [1.1, 0.32, 0], [0.22, 0.64, 0.24], material(0x5a3b2c));
  scene.add(bench);
}

function addFlower(scene, x, y, i) {
  const flower = new THREE.Group();
  flower.position.set(toWorldX(x), 0, toWorldZ(y));
  const petal = material(i % 2 ? 0xf05fa8 : 0xffd2ec);
  addBox(flower, [0, 0.22, 0], [0.05, 0.42, 0.05], material(0x4fb66e));
  addBox(flower, [0, 0.48, 0], [0.18, 0.18, 0.18], petal);
  scene.add(flower);
}

function addBox(parent, position, size, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCone(parent, position, radius, height, mat) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 6), mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function material(color) {
  if (!MATERIALS.has(color)) {
    MATERIALS.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.78 }));
  }
  return MATERIALS.get(color);
}

function createTextSprite(text, options = {}) {
  const fontSize = options.fontSize || 40;
  const padding = 18;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `700 ${fontSize}px monospace`;
  const maxWidth = options.maxWidth || 520;
  const lines = wrapText(ctx, text, maxWidth);
  const width = Math.min(maxWidth + padding * 2, Math.max(180, Math.ceil(Math.max(...lines.map((line) => ctx.measureText(line).width)) + padding * 2)));
  const height = lines.length * (fontSize + 6) + padding * 2;
  canvas.width = width;
  canvas.height = height;
  ctx.font = `700 ${fontSize}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  roundRect(ctx, 0, 0, width, height, 18, options.background || "rgba(255,255,255,0.86)");
  ctx.fillStyle = options.color || "#432947";
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, padding + fontSize / 2 + index * (fontSize + 6));
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  const ratio = width / height;
  sprite.scale.set(2.8 * ratio, 2.8, 1);
  return sprite;
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function roundRect(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fill();
}
