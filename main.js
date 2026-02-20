const CANVAS_W = 432;
const CANVAS_H = 864;
const TOP_UI_H = 108;
const BOTTOM_UI_H = 122;
const WORLD_Y = TOP_UI_H;
const WORLD_H = CANVAS_H - TOP_UI_H - BOTTOM_UI_H;

const TILE_SIZE = 48;
const ENTITY_SIZE = 40; // ~83%
const MAP_W = 44;
const MAP_H = 44;
const VIEW_RADIUS = 7;
const MAX_LOG = 5;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const state = {
  floor: 1,
  map: [],
  seen: [],
  player: null,
  enemies: [],
  items: [],
  logs: [],
};

const uiButtons = {
  wait: { x: 16, y: CANVAS_H - 88, w: 74, h: 74, label: '⏱' },
  potion: { x: 104, y: CANVAS_H - 88, w: 74, h: 74, label: 'P' },
  save: { x: 256, y: CANVAS_H - 88, w: 74, h: 74, label: 'S' },
  load: { x: 342, y: CANVAS_H - 88, w: 74, h: 74, label: 'L' },
};

const tileDefs = {
  wall: { walkable: false },
  floor: { walkable: true },
  water: { walkable: true, hungerCost: 2 },
  stair: { walkable: true },
};

const sprites = buildSprites();

function buildSprites() {
  const make = (draw) => {
    const s = 48;
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const cc = c.getContext('2d');
    cc.imageSmoothingEnabled = false;
    draw(cc);
    return c;
  };

  return {
    hero: make((c) => {
      fill(c, '#1c1f26', 14, 4, 20, 6);
      fill(c, '#d8dce5', 15, 5, 18, 4);
      fill(c, '#f2c7a2', 17, 10, 14, 10);
      fill(c, '#151922', 20, 13, 2, 2);
      fill(c, '#151922', 26, 13, 2, 2);
      fill(c, '#95a0b4', 14, 20, 20, 16);
      fill(c, '#c6cdd9', 16, 22, 16, 6);
      fill(c, '#7e889c', 13, 22, 3, 12);
      fill(c, '#7e889c', 32, 22, 3, 12);
      fill(c, '#8a55df', 17, 36, 6, 8);
      fill(c, '#8a55df', 25, 36, 6, 8);
      fill(c, '#0e1118', 17, 44, 6, 2);
      fill(c, '#0e1118', 25, 44, 6, 2);
    }),
    rat: make((c) => {
      fill(c, '#4f433b', 10, 20, 22, 12);
      fill(c, '#6a5b50', 12, 21, 18, 8);
      fill(c, '#d6b8a2', 30, 16, 10, 7);
      fill(c, '#141518', 19, 24, 3, 2);
      fill(c, '#141518', 29, 24, 3, 2);
      fill(c, '#8a5f5f', 8, 26, 2, 2);
      fill(c, '#8a5f5f', 6, 27, 2, 2);
      fill(c, '#8a5f5f', 4, 28, 2, 2);
      fill(c, '#8a5f5f', 2, 29, 2, 2);
    }),
    slime: make((c) => {
      fill(c, '#3e8f6b', 10, 17, 28, 20);
      fill(c, '#5eb88c', 13, 19, 22, 9);
      fill(c, '#d6ffea', 15, 22, 4, 3);
      fill(c, '#d6ffea', 29, 22, 4, 3);
      fill(c, '#1f4f39', 20, 30, 8, 3);
      fill(c, '#2f7255', 12, 34, 24, 2);
    }),
    potion: make((c) => {
      fill(c, '#7bc8ef', 20, 9, 8, 5);
      fill(c, '#c32d47', 15, 14, 18, 18);
      fill(c, '#f28da0', 18, 18, 5, 8);
      fill(c, '#8c1e30', 15, 30, 18, 2);
    }),
  };
}

function fill(c, color, x, y, w, h) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function resetGame() {
  state.floor = 1;
  state.player = { x: 2, y: 2, hp: 100, maxHp: 100, hunger: 140, potions: 3 };
  state.logs = [];
  setupFloor();
  render();
}

function setupFloor() {
  state.map = Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => 'wall'));
  state.seen = Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => false));
  state.enemies = [];
  state.items = [];

  const rooms = [];
  for (let i = 0; i < 16; i += 1) {
    const w = rand(4, 8);
    const h = rand(4, 8);
    const x = rand(1, MAP_W - w - 2);
    const y = rand(1, MAP_H - h - 2);
    carveRoom(x, y, w, h);
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }

  for (let i = 1; i < rooms.length; i += 1) {
    tunnel(rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
  }

  carveWaterPools(rooms);

  const start = rooms[0];
  const end = rooms[rooms.length - 1];
  state.player.x = start.cx;
  state.player.y = start.cy;
  state.map[end.cy][end.cx] = 'stair';

  spawnEnemies(10 + state.floor, rooms);
  spawnPotions(3, rooms);
  addLog(`${state.floor}층으로 내려왔습니다.`);
}

function carveRoom(x, y, w, h) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) state.map[yy][xx] = 'floor';
  }
}

function tunnel(x1, y1, x2, y2) {
  let x = x1;
  let y = y1;
  while (x !== x2) {
    state.map[y][x] = 'floor';
    x += x < x2 ? 1 : -1;
  }
  while (y !== y2) {
    state.map[y][x] = 'floor';
    y += y < y2 ? 1 : -1;
  }
}

function scatter(type, count) {
  for (let i = 0; i < count; i += 1) {
    const x = rand(1, MAP_W - 2);
    const y = rand(1, MAP_H - 2);
    if (state.map[y][x] === 'floor') state.map[y][x] = type;
  }
}

function carveWaterPools(rooms) {
  for (const room of rooms) {
    if (Math.random() > 0.5) continue;
    const poolW = Math.max(2, Math.floor(room.w / 2));
    const poolH = Math.max(2, Math.floor(room.h / 2));
    const sx = rand(room.x + 1, Math.max(room.x + 1, room.x + room.w - poolW - 1));
    const sy = rand(room.y + 1, Math.max(room.y + 1, room.y + room.h - poolH - 1));

    for (let y = sy; y < sy + poolH; y += 1) {
      for (let x = sx; x < sx + poolW; x += 1) {
        if (state.map[y][x] === 'floor') state.map[y][x] = 'water';
      }
    }
  }
}

function spawnEnemies(count, rooms) {
  for (let i = 0; i < count; i += 1) {
    const room = rooms[rand(1, rooms.length - 1)];
    const x = rand(room.x, room.x + room.w - 1);
    const y = rand(room.y, room.y + room.h - 1);
    if (occupied(x, y) || (x === state.player.x && y === state.player.y)) continue;
    const slime = Math.random() > 0.5;
    state.enemies.push({ x, y, kind: slime ? 'slime' : 'rat', hp: slime ? 22 : 18, atk: slime ? 8 : 6 });
  }
}

function spawnPotions(count, rooms) {
  for (let i = 0; i < count; i += 1) {
    const room = rooms[rand(1, rooms.length - 1)];
    const x = rand(room.x, room.x + room.w - 1);
    const y = rand(room.y, room.y + room.h - 1);
    if (!occupied(x, y)) state.items.push({ x, y, type: 'potion' });
  }
}

function occupied(x, y) {
  return state.enemies.some((e) => e.x === x && e.y === y) || state.items.some((i) => i.x === x && i.y === y);
}

function inMap(x, y) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

function isWalkable(x, y) {
  if (!inMap(x, y)) return false;
  if (!tileDefs[state.map[y][x]].walkable) return false;
  return !state.enemies.some((e) => e.x === x && e.y === y);
}

function canSee(fx, fy, tx, ty) {
  const dx = tx - fx;
  const dy = ty - fy;
  return dx * dx + dy * dy <= VIEW_RADIUS * VIEW_RADIUS;
}

function computePath(targetX, targetY) {
  const start = { x: state.player.x, y: state.player.y };
  const q = [start];
  const key = (x, y) => `${x},${y}`;
  const prev = new Map([[key(start.x, start.y), null]]);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (q.length) {
    const cur = q.shift();
    if (cur.x === targetX && cur.y === targetY) break;

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inMap(nx, ny)) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      if ((nx !== targetX || ny !== targetY) && !isWalkable(nx, ny)) continue;
      if (tileDefs[state.map[ny][nx]].walkable === false) continue;
      prev.set(k, cur);
      q.push({ x: nx, y: ny });
    }
  }

  if (!prev.has(key(targetX, targetY))) return [];

  const path = [];
  let cur = { x: targetX, y: targetY };
  while (cur && (cur.x !== start.x || cur.y !== start.y)) {
    path.push(cur);
    cur = prev.get(key(cur.x, cur.y));
  }
  return path.reverse();
}

function moveTo(tx, ty) {
  if (!inMap(tx, ty)) return;

  const enemy = state.enemies.find((e) => e.x === tx && e.y === ty);
  if (enemy) {
    moveAndFight(enemy);
    return;
  }

  const path = computePath(tx, ty);
  if (!path.length) {
    addLog('이동할 수 없습니다.');
    render();
    return;
  }

  for (const step of path) {
    state.player.x = step.x;
    state.player.y = step.y;
    consumeTurn(1 + (tileDefs[state.map[step.y][step.x]].hungerCost || 0));
    collectItem();

    if (state.map[step.y][step.x] === 'stair') {
      nextFloor();
      return;
    }

    if (state.enemies.some((e) => canSee(state.player.x, state.player.y, e.x, e.y))) {
      addLog('적 발견! 자동 이동 중단.');
      break;
    }
  }

  render();
}

function moveAndFight(enemy) {
  const route = computePath(enemy.x, enemy.y);
  if (!route.length) {
    addLog('경로가 없습니다.');
    render();
    return;
  }

  const adjacentNow = Math.abs(state.player.x - enemy.x) + Math.abs(state.player.y - enemy.y) === 1;
  if (!adjacentNow) {
    const beforeLast = route[route.length - 2];
    if (beforeLast) {
      state.player.x = beforeLast.x;
      state.player.y = beforeLast.y;
      consumeTurn(1);
    }
  }

  const adjacent = Math.abs(state.player.x - enemy.x) + Math.abs(state.player.y - enemy.y) === 1;
  if (adjacent) {
    const dmg = rand(10, 16);
    enemy.hp -= dmg;
    addLog(`공격 성공 ${dmg} 피해.`);
    if (enemy.hp <= 0) {
      state.enemies = state.enemies.filter((e) => e !== enemy);
      addLog(`${enemy.kind === 'slime' ? '슬라임' : '쥐'} 처치.`);
    }
    consumeTurn(1);
  }

  render();
}

function collectItem() {
  const hit = state.items.find((i) => i.x === state.player.x && i.y === state.player.y);
  if (!hit) return;
  if (hit.type === 'potion') {
    state.player.potions += 1;
    addLog('포션 획득.');
  }
  state.items = state.items.filter((i) => i !== hit);
}

function consumeTurn(hungerCost) {
  state.player.hunger -= hungerCost;

  for (const enemy of state.enemies) {
    const dist = Math.abs(enemy.x - state.player.x) + Math.abs(enemy.y - state.player.y);

    if (dist <= 1) {
      const dmg = rand(2, enemy.atk);
      state.player.hp -= dmg;
      addLog(`${enemy.kind === 'slime' ? '슬라임' : '쥐'}에게 ${dmg} 피해.`);
      continue;
    }

    if (canSee(enemy.x, enemy.y, state.player.x, state.player.y)) {
      const nx = enemy.x + Math.sign(state.player.x - enemy.x);
      const ny = enemy.y + Math.sign(state.player.y - enemy.y);
      if ((nx === state.player.x && ny === state.player.y) || isWalkable(nx, ny)) {
        enemy.x = nx;
        enemy.y = ny;
      }
    }
  }

  if (state.player.hunger <= 0) {
    state.player.hp -= 1;
    addLog('굶주림 피해.');
  }

  if (state.player.hp <= 0) {
    addLog('사망. 새 런 시작.');
    resetGame();
  }
}

function waitTurn() {
  addLog('대기.');
  consumeTurn(1);
  render();
}

function usePotion() {
  if (state.player.potions <= 0) {
    addLog('포션 없음.');
    render();
    return;
  }
  state.player.potions -= 1;
  const heal = rand(14, 24);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
  addLog(`포션 사용 +${heal}.`);
  consumeTurn(1);
  render();
}

function nextFloor() {
  state.floor += 1;
  state.player.hunger = Math.min(160, state.player.hunger + 24);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 16);
  setupFloor();
  render();
}

function saveGame() {
  localStorage.setItem('abyss-save', JSON.stringify(state));
  addLog('저장 완료.');
  render();
}

function loadGame() {
  const raw = localStorage.getItem('abyss-save');
  if (!raw) {
    addLog('저장 데이터 없음.');
    render();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);
    addLog('불러오기 완료.');
  } catch {
    addLog('저장 데이터 손상.');
  }
  render();
}

function addLog(msg) {
  state.logs.unshift(msg);
  if (state.logs.length > MAX_LOG) state.logs.pop();
}

function getCamera() {
  const centerX = state.player.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = state.player.y * TILE_SIZE + TILE_SIZE / 2;
  const worldPxW = MAP_W * TILE_SIZE;
  const worldPxH = MAP_H * TILE_SIZE;

  let camX = centerX - CANVAS_W / 2;
  let camY = centerY - WORLD_H / 2;

  camX = Math.max(0, Math.min(camX, Math.max(0, worldPxW - CANVAS_W)));
  camY = Math.max(0, Math.min(camY, Math.max(0, worldPxH - WORLD_H)));

  return { camX, camY };
}

function noise2D(x, y, seed = 1) {
  const n = Math.sin((x * 127.1 + y * 311.7 + seed * 71.3)) * 43758.5453;
  return n - Math.floor(n);
}

function drawNoiseStones(sx, sy, base, bright, dark) {
  ctx.fillStyle = base;
  ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

  ctx.fillStyle = bright;
  ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, 3);
  ctx.fillRect(sx + 2, sy + 2, 3, TILE_SIZE - 4);

  ctx.fillStyle = dark;
  ctx.fillRect(sx + TILE_SIZE - 5, sy + 2, 3, TILE_SIZE - 4);
  ctx.fillRect(sx + 2, sy + TILE_SIZE - 5, TILE_SIZE - 4, 3);

  const dots = [
    [8, 8], [14, 11], [23, 8], [31, 14], [18, 18], [10, 27], [26, 26], [34, 33], [14, 37],
  ];
  ctx.fillStyle = '#7d828c';
  for (const [dx, dy] of dots) ctx.fillRect(sx + dx, sy + dy, 2, 2);
  ctx.fillStyle = '#2d3138';
  for (const [dx, dy] of dots) ctx.fillRect(sx + dx + 2, sy + dy + 1, 1, 1);
}

function drawBrickWall(sx, sy, tx, ty) {
  ctx.fillStyle = '#5e5a52';
  ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

  const rowH = 8;
  for (let row = 0; row < 6; row += 1) {
    const y = sy + row * rowH;
    const offset = row % 2 ? 10 : 0;

    ctx.fillStyle = '#777167';
    ctx.fillRect(sx, y, TILE_SIZE, rowH - 1);

    for (let col = -offset; col < TILE_SIZE; col += 20) {
      const mortarX = sx + col;
      ctx.fillStyle = '#3b3934';
      ctx.fillRect(mortarX, y, 2, rowH - 1);

      const n = noise2D(tx + col, ty + row, 2);
      ctx.fillStyle = n > 0.5 ? '#888178' : '#6a655c';
      ctx.fillRect(mortarX + 2, y + 1, 18, rowH - 3);
    }

    ctx.fillStyle = '#36332f';
    ctx.fillRect(sx, y + rowH - 1, TILE_SIZE, 1);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(sx + 1, sy + 1, TILE_SIZE - 2, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(sx + 1, sy + TILE_SIZE - 3, TILE_SIZE - 2, 2);
}

function drawCobbleFloor(sx, sy, tx, ty) {
  ctx.fillStyle = '#34322f';
  ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

  const c = 8;
  for (let gy = 0; gy < 6; gy += 1) {
    for (let gx = 0; gx < 6; gx += 1) {
      const n = noise2D(tx * 7 + gx, ty * 7 + gy, 9);
      const shade = n > 0.72 ? '#2b2a28' : n > 0.45 ? '#403d39' : '#4a4742';
      const px = sx + gx * c;
      const py = sy + gy * c;
      ctx.fillStyle = shade;
      ctx.fillRect(px, py, c - 1, c - 1);
      ctx.fillStyle = '#262421';
      ctx.fillRect(px + c - 1, py, 1, c - 1);
    }
  }

  if (noise2D(tx, ty, 21) > 0.72) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(sx + 8, sy + 12, 24, 16);
  }
}

function drawWaterPool(sx, sy, tx, ty) {
  ctx.fillStyle = '#1b2d30';
  ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = '#234448';
  ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);

  for (let i = 0; i < 4; i += 1) {
    const n = noise2D(tx, ty, i + 30);
    const waveY = sy + 10 + i * 8;
    const waveX = sx + 6 + Math.floor(n * 6);
    ctx.fillStyle = i % 2 ? '#2a6e72' : '#2f8084';
    ctx.fillRect(waveX, waveY, 24, 2);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(sx, sy + TILE_SIZE - 6, TILE_SIZE, 6);
}

function drawTile(type, sx, sy, tx, ty, visible) {
  if (!visible) {
    ctx.fillStyle = '#000';
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    return;
  }

  if (type === 'wall') {
    drawBrickWall(sx, sy, tx, ty);
    return;
  }

  if (type === 'floor') {
    drawCobbleFloor(sx, sy, tx, ty);
    return;
  }

  if (type === 'water') {
    drawWaterPool(sx, sy, tx, ty);
    return;
  }

  if (type === 'stair') {
    drawCobbleFloor(sx, sy, tx, ty);
    ctx.fillStyle = '#b7aa85';
    ctx.fillRect(sx + 10, sy + 8, 28, 32);
    ctx.fillStyle = '#87795a';
    for (let i = 0; i < 6; i += 1) ctx.fillRect(sx + 12, sy + 11 + i * 5, 24, 1);
    return;
  }
}

function drawWorld() {
  const { camX, camY } = getCamera();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, WORLD_Y, CANVAS_W, WORLD_H);
  ctx.clip();

  ctx.fillStyle = '#000';
  ctx.fillRect(0, WORLD_Y, CANVAS_W, WORLD_H);

  const startX = Math.floor(camX / TILE_SIZE);
  const endX = Math.ceil((camX + CANVAS_W) / TILE_SIZE);
  const startY = Math.floor(camY / TILE_SIZE);
  const endY = Math.ceil((camY + WORLD_H) / TILE_SIZE);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      if (!inMap(x, y)) continue;

      const visible = canSee(state.player.x, state.player.y, x, y);
      if (visible) state.seen[y][x] = true;
      if (!state.seen[y][x]) continue;

      const sx = x * TILE_SIZE - camX;
      const sy = WORLD_Y + y * TILE_SIZE - camY;
      drawTile(state.map[y][x], sx, sy, x, y, true);

      if (!visible) {
        ctx.fillStyle = 'rgba(0,0,0,0.64)';
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  for (const item of state.items) {
    if (!canSee(state.player.x, state.player.y, item.x, item.y)) continue;
    const sx = item.x * TILE_SIZE - camX + (TILE_SIZE - ENTITY_SIZE) / 2;
    const sy = WORLD_Y + item.y * TILE_SIZE - camY + (TILE_SIZE - ENTITY_SIZE) / 2;
    ctx.drawImage(sprites.potion, sx, sy, ENTITY_SIZE, ENTITY_SIZE);
  }

  for (const enemy of state.enemies) {
    if (!canSee(state.player.x, state.player.y, enemy.x, enemy.y)) continue;
    const sprite = enemy.kind === 'slime' ? sprites.slime : sprites.rat;
    const sx = enemy.x * TILE_SIZE - camX + (TILE_SIZE - ENTITY_SIZE) / 2;
    const sy = WORLD_Y + enemy.y * TILE_SIZE - camY + (TILE_SIZE - ENTITY_SIZE) / 2;
    ctx.drawImage(sprite, sx, sy, ENTITY_SIZE, ENTITY_SIZE);
  }

  const psx = state.player.x * TILE_SIZE - camX + (TILE_SIZE - ENTITY_SIZE) / 2;
  const psy = WORLD_Y + state.player.y * TILE_SIZE - camY + (TILE_SIZE - ENTITY_SIZE) / 2;
  ctx.drawImage(sprites.hero, psx, psy, ENTITY_SIZE, ENTITY_SIZE);

  ctx.restore();
}

function drawTopUI() {
  ctx.fillStyle = '#0d0f14';
  ctx.fillRect(0, 0, CANVAS_W, TOP_UI_H);
  ctx.strokeStyle = '#3f4655';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, CANVAS_W, TOP_UI_H);

  ctx.fillStyle = '#1c2029';
  ctx.fillRect(10, 12, 68, 68);
  ctx.strokeStyle = '#5a6479';
  ctx.strokeRect(10, 12, 68, 68);
  ctx.drawImage(sprites.hero, 24, 26, 40, 40);

  const hpW = 232;
  const hpRatio = Math.max(0, state.player.hp) / state.player.maxHp;
  ctx.fillStyle = '#171920';
  ctx.fillRect(88, 14, hpW, 20);
  ctx.fillStyle = '#9b1f27';
  ctx.fillRect(90, 16, (hpW - 4) * hpRatio, 16);
  ctx.strokeStyle = '#5e636d';
  ctx.strokeRect(88, 14, hpW, 20);

  drawPixelText(`HP ${Math.max(0, state.player.hp)}/${state.player.maxHp}`, 94, 18, '#f2f0eb', 2);
  drawPixelText(`층 ${state.floor}  허기 ${state.player.hunger}`, 88, 44, '#d8bf58', 2);
  drawPixelText(`포션 ${state.player.potions}`, 88, 64, '#89d7ff', 2);

  const badgeX = 336;
  ctx.fillStyle = '#2f3747';
  ctx.fillRect(badgeX, 14, 84, 54);
  ctx.strokeStyle = '#667185';
  ctx.strokeRect(badgeX, 14, 84, 54);
  drawPixelText(`${state.enemies.length} EN`, badgeX + 10, 31, '#f6f6f6', 2);
  drawPixelText('MENU', badgeX + 10, 50, '#b7c2db', 2);

  ctx.fillStyle = '#10141d';
  ctx.fillRect(0, TOP_UI_H - 24, CANVAS_W, 24);
  ctx.strokeStyle = '#343c4c';
  ctx.strokeRect(0, TOP_UI_H - 24, CANVAS_W, 24);
  drawPixelText(state.logs[0] || '탭: 이동 / 적 탭: 접근 후 공격', 12, TOP_UI_H - 18, '#e5d44d', 2);
}

function drawBottomUI() {
  const y = CANVAS_H - BOTTOM_UI_H;
  ctx.fillStyle = '#0d0f14';
  ctx.fillRect(0, y, CANVAS_W, BOTTOM_UI_H);
  ctx.strokeStyle = '#3f4655';
  ctx.strokeRect(0, y, CANVAS_W, BOTTOM_UI_H);

  for (const key of Object.keys(uiButtons)) {
    const b = uiButtons[key];
    ctx.fillStyle = '#2d323f';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#666f85';
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    drawPixelText(b.label, b.x + 25, b.y + 28, '#f2f3f7', 3);
    drawPixelText(
      key === 'wait' ? '대기' : key === 'potion' ? '회복' : key === 'save' ? '저장' : '불러',
      b.x + 13,
      b.y + 56,
      '#c5d0e8',
      2,
    );
  }

  drawPixelText('심연의 탐험가 - 고해상도 픽셀 HUD', 88, y + 16, '#aeb9d2', 2);
}

function drawPixelText(text, x, y, color, size = 2) {
  ctx.fillStyle = color;
  ctx.font = `${8 * size}px monospace`;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawWorld();
  drawTopUI();
  drawBottomUI();
}

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

function handleTap(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = ((clientX - r.left) * CANVAS_W) / r.width;
  const y = ((clientY - r.top) * CANVAS_H) / r.height;

  for (const [k, button] of Object.entries(uiButtons)) {
    if (pointInRect(x, y, button)) {
      if (k === 'wait') waitTurn();
      if (k === 'potion') usePotion();
      if (k === 'save') saveGame();
      if (k === 'load') loadGame();
      return;
    }
  }

  if (y < WORLD_Y || y > WORLD_Y + WORLD_H) return;

  const { camX, camY } = getCamera();
  const mapX = Math.floor((x + camX) / TILE_SIZE);
  const mapY = Math.floor((y - WORLD_Y + camY) / TILE_SIZE);
  moveTo(mapX, mapY);
}

canvas.addEventListener('click', (e) => handleTap(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  handleTap(t.clientX, t.clientY);
  e.preventDefault();
}, { passive: false });

resetGame();
