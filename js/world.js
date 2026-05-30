import Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.esm.js";

export const WORLD_SIZE = 2400;
export const HOUSE_RECT = new Phaser.Geom.Rectangle(1550, 250, 430, 330);
export const BENCHES = [
  { x: 760, y: 770 },
  { x: 1050, y: 1320 },
  { x: 1780, y: 570 }
];

const AVATAR_COLORS = {
  rose: { body: 0xf05fa8, accent: 0xffbddf },
  mint: { body: 0x55caa4, accent: 0xc8ffe8 },
  sunset: { body: 0xff9864, accent: 0xffd37d },
  moon: { body: 0x6d6ee8, accent: 0xdfe9ff }
};

export function createTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const rect = (x, y, w, h, color) => {
    g.fillStyle(color, 1);
    g.fillRect(x, y, w, h);
  };

  Object.entries(AVATAR_COLORS).forEach(([name, colors]) => {
    g.clear();
    rect(10, 4, 12, 8, colors.accent);
    rect(6, 12, 20, 18, colors.body);
    rect(10, 30, 6, 10, 0x3d2a44);
    rect(20, 30, 6, 10, 0x3d2a44);
    rect(10, 16, 4, 4, 0xffffff);
    rect(22, 16, 4, 4, 0xffffff);
    rect(13, 20, 10, 3, 0x432947);
    g.generateTexture(`avatar-${name}`, 36, 44);
  });

  g.clear();
  rect(0, 0, 48, 70, 0x7d4d31);
  rect(0, 0, 16, 16, 0x4fb66e);
  rect(16, 0, 16, 16, 0x48a861);
  rect(32, 0, 16, 16, 0x4fb66e);
  rect(8, 14, 32, 22, 0x58c878);
  rect(18, 36, 12, 34, 0x875738);
  g.generateTexture("tree", 48, 70);

  g.clear();
  rect(2, 9, 4, 10, 0x4fb66e);
  rect(0, 3, 8, 8, 0xf05fa8);
  rect(8, 0, 8, 8, 0xffd2ec);
  rect(7, 7, 5, 5, 0xffee7c);
  g.generateTexture("flower", 18, 22);

  g.clear();
  rect(0, 8, 80, 12, 0x8b5a3a);
  rect(8, 0, 64, 8, 0xa96b44);
  rect(10, 20, 8, 22, 0x5a3b2c);
  rect(62, 20, 8, 22, 0x5a3b2c);
  g.generateTexture("bench", 80, 44);

  g.clear();
  rect(0, 60, 210, 150, 0xfff5fb);
  rect(30, 104, 52, 106, 0x8d62d7);
  rect(120, 92, 52, 44, 0x94d4ff);
  rect(18, 42, 174, 42, 0xf05fa8);
  rect(0, 76, 210, 10, 0xe7c1dd);
  g.generateTexture("house", 210, 210);

  g.clear();
  rect(0, 0, 32, 32, 0xf05fa8);
  rect(10, 8, 12, 18, 0xffffff);
  g.generateTexture("gift", 32, 32);
  g.destroy();
}

export function drawWorld(scene) {
  scene.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
  scene.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);

  const bg = scene.add.graphics();
  bg.fillGradientStyle(0xaee6aa, 0xaee6aa, 0xf7de92, 0xf7de92, 1);
  bg.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

  drawLake(scene, 230, 260);
  drawBeach(scene);
  drawPark(scene);
  drawPaths(scene);
  drawHouse(scene);
  scatterDecor(scene);
}

function drawLake(scene, x, y) {
  const water = scene.add.graphics();
  water.fillStyle(0x73c9f4, 0.92);
  water.fillEllipse(x + 260, y + 190, 470, 280);
  water.lineStyle(10, 0xdaf8ff, 0.7);
  water.strokeEllipse(x + 260, y + 190, 470, 280);
  scene.tweens.add({ targets: water, alpha: 0.72, yoyo: true, repeat: -1, duration: 2200 });
}

function drawBeach(scene) {
  const beach = scene.add.graphics();
  beach.fillStyle(0xffdf94, 1);
  beach.fillRect(0, 1780, WORLD_SIZE, 620);
  beach.fillStyle(0x66c9ef, 0.82);
  beach.fillRect(0, 2040, WORLD_SIZE, 360);
  for (let x = 0; x < WORLD_SIZE; x += 120) {
    beach.fillStyle(0xffffff, 0.55);
    beach.fillEllipse(x + 50, 2040, 80, 12);
  }
}

function drawPark(scene) {
  const park = scene.add.graphics();
  park.fillStyle(0x8ee29a, 1);
  park.fillRoundedRect(700, 1080, 620, 420, 30);
  park.lineStyle(6, 0xffffff, 0.45);
  park.strokeRoundedRect(700, 1080, 620, 420, 30);
}

function drawPaths(scene) {
  const path = scene.add.graphics();
  path.lineStyle(42, 0xf7cfa9, 1);
  path.beginPath();
  path.moveTo(520, 520);
  path.lineTo(920, 880);
  path.lineTo(1060, 1300);
  path.lineTo(1730, 520);
  path.strokePath();
  path.lineStyle(18, 0xffefd9, 0.7);
  path.strokePath();
}

function drawHouse(scene) {
  scene.add.image(1650, 305, "house").setOrigin(0, 0);
  const interior = scene.add.graphics();
  interior.fillStyle(0xfff2fb, 0.96);
  interior.fillRoundedRect(HOUSE_RECT.x, HOUSE_RECT.y, HOUSE_RECT.width, HOUSE_RECT.height, 14);
  interior.lineStyle(8, 0xe1c3f2, 1);
  interior.strokeRoundedRect(HOUSE_RECT.x, HOUSE_RECT.y, HOUSE_RECT.width, HOUSE_RECT.height, 14);
  interior.setDepth(-1);
}

function scatterDecor(scene) {
  const trees = [
    [140, 120], [360, 130], [750, 260], [1030, 240], [1380, 180], [2110, 220],
    [270, 850], [530, 960], [1430, 980], [2050, 850], [410, 1460], [1510, 1500],
    [2140, 1450], [580, 1650], [1340, 1740]
  ];
  trees.forEach(([x, y]) => scene.add.image(x, y, "tree"));

  BENCHES.forEach((bench) => scene.add.image(bench.x, bench.y, "bench"));

  for (let i = 0; i < 90; i += 1) {
    const x = 90 + ((i * 137) % 2150);
    const y = 120 + ((i * 89) % 1620);
    if (Phaser.Geom.Rectangle.Contains(HOUSE_RECT, x, y)) continue;
    scene.add.image(x, y, "flower").setScale(0.85 + (i % 3) * 0.15);
  }
}

export function createPlayerSprite(scene, player) {
  const sprite = scene.physics.add.sprite(player.x, player.y, `avatar-${player.avatar || "rose"}`);
  sprite.setCollideWorldBounds(true);
  sprite.setDepth(10);
  sprite.nameLabel = scene.add.text(player.x, player.y - 42, player.name || "Love", {
    fontFamily: "monospace",
    fontSize: "13px",
    color: "#432947",
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: { x: 5, y: 2 }
  }).setOrigin(0.5).setDepth(11);
  sprite.statusDot = scene.add.circle(player.x + 20, player.y - 28, 4, player.online ? 0x5de08d : 0xb0a2b4).setDepth(11);
  return sprite;
}

export function updatePlayerSprite(sprite, player) {
  sprite.nameLabel.setText(player.name || "Love");
  sprite.nameLabel.setPosition(sprite.x, sprite.y - 42);
  sprite.statusDot.setFillStyle(player.online ? 0x5de08d : 0xb0a2b4);
  sprite.statusDot.setPosition(sprite.x + 20, sprite.y - 28);
}

export function destroyPlayerSprite(sprite) {
  sprite.nameLabel?.destroy();
  sprite.statusDot?.destroy();
  sprite.destroy();
}

export function isInsideHouse(x, y) {
  return Phaser.Geom.Rectangle.Contains(HOUSE_RECT, x, y);
}
