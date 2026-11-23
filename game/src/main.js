// main.js — Solmar Bay: boot, game loop, wanted system, menus, save, screenshots.
// ?seed=N fixes the city layout. ?shot=cover|street|mission|menu stages that scene
// and sets window.__shotReady once it has been painted, for screenshots.
import { WORLD_W, WORLD_H, createCity, mulberry32, collideBuildings, isOnRoad } from './city.js';
import { makePlayer, updatePlayerOnFoot, updateBullets, nearestCar, enterCar, exitCar, addWanted } from './player.js';
import { makeCar, driveCar, spawnTraffic, spawnParked, updateTraffic, updatePolice, spawnPoliceCar, resolveCarCollisions, CAR_COLORS } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, scarePedestrians, makeFootCop, updateFootCops } from './pedestrians.js';
import { makeMissionState, currentMission, currentStep, startMission, updateMissions, showMessage } from './missions.js';
import { makeAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { makeHud, updateHud, drawMinimap } from './hud.js';
import { drawWorld } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_MISSION } from './input.js';
import { stageShot, placeCometCar } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

export function createGame(seedValue) {
  const rng = mulberry32(seedValue);
  const city = createCity(seedValue);
  const player = makePlayer(1460, 1500);
  const game = {
    seed: seedValue, rng, city, player,
    cars: [], peds: [], footCops: [], particles: [], skids: [],
    pickups: [],
    missions: makeMissionState(),
    missionStep: null,
    audio: makeAudio(),
    time: 0, screen: 'menu',
    camera: { x: 0, y: 0, w: 1000, h: 700 },
    viewW: 0, viewH: 0, viewScale: 1,
    copSpawnTimer: 0, overReason: '',
    savedData: loadSave(),
  };
  game.cars = [...spawnTraffic(city, rng, 26), ...spawnParked(city, rng, 14)];
  game.peds = spawnPedestrians(city, rng, 46);
  placeCometCar(game);
  game.pickups = [
    { x: 660, y: 700, kind: 'health', taken: false, respawn: 0 },
    { x: 2260, y: 1460, kind: 'health', taken: false, respawn: 0 },
    { x: 1460, y: 1860, kind: 'health', taken: false, respawn: 0 },
    { x: 2660, y: 1060, kind: 'health', taken: false, respawn: 0 },
  ];
  return game;
}

function burst(game, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    game.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, maxLife: 0.9, color, size: 2 + Math.random() * 3 });
  }
}

function resize(game) {
  game.viewW = window.innerWidth;
  game.viewH = window.innerHeight;
  canvas.width = game.viewW;
  canvas.height = game.viewH;
}

function updateCamera(game, dt) {
  const p = game.player;
  const targetW = p.onFoot ? 950 : 1180;
  const scale = Math.min(game.viewW / targetW, game.viewH / (targetW * 0.66));
  game.viewScale = scale;
  const w = game.viewW / scale, h = game.viewH / scale;
  const tx = Math.max(0, Math.min(WORLD_W - w, p.x - w / 2));
  const ty = Math.max(0, Math.min(WORLD_H - h, p.y - h / 2));
  const k = 1 - Math.pow(0.001, dt);
  game.camera.x += (tx - game.camera.x) * k;
  game.camera.y += (ty - game.camera.y) * k;
  game.camera.w = w; game.camera.h = h;
}

function updateWanted(game, dt) {
  const p = game.player;
  // Spawn police cars to match the wanted level (max 3 on the road).
  const wantCars = Math.min(p.wanted, 3);
  const haveCars = game.cars.filter((c) => c.kind === 'police').length;
  game.copSpawnTimer -= dt;
  if (haveCars < wantCars && game.copSpawnTimer <= 0) {
    game.cars.push(spawnPoliceCar(game.city, game.rng, p));
    game.copSpawnTimer = 2.5;
  }
  // Foot cops when the player is on foot and wanted.
  if (p.wanted >= 2 && p.onFoot) {
    while (game.footCops.length < 2) {
      const a = Math.random() * Math.PI * 2;
      game.footCops.push(makeFootCop(p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320));
    }
  } else if (!p.onFoot) {
    game.footCops = [];
  }
  // Busted: a foot cop holding on.
  for (const c of game.footCops) {
    if (c.grab > 1.2) { endRun(game, 'busted'); return; }
  }
  // Wanted decays when no police are close.
  const nearCop = game.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 700)
    || game.footCops.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 500);
  if (!nearCop && p.wanted > 0) {
    p.wantedTimer += dt;
    if (p.wantedTimer > 10) { p.wanted--; p.wantedTimer = 0; }
  } else {
    p.wantedTimer = 0;
  }
}

function endRun(game, reason) {
  const p = game.player;
  game.overReason = reason;
  game.screen = 'over';
  game.audio.play(reason);
  if (reason === 'busted') {
    p.cash = Math.floor(p.cash * 0.8);
    showMessage(game.missions, 'Busted! The cops took 20% of your cash.', 5);
  } else {
    showMessage(game.missions, 'Wasted! Mama June patched you up — the job goes on.', 5);
  }
  document.getElementById('over-title').textContent = reason === 'busted' ? 'BUSTED' : 'WASTED';
  document.getElementById('over-text').textContent = reason === 'busted'
    ? 'The Solmar PD hauled you in. Cash lost: 20%.'
    : 'You flatlined on the asphalt. Solmar General put you back together.';
  document.getElementById('over-screen').style.display = 'flex';
}

function respawn(game) {
  const p = game.player;
  document.getElementById('over-screen').style.display = 'none';
  if (p.car) { p.car.kind = 'parked'; p.car = null; }
  p.onFoot = true;
  p.x = 1460; p.y = 660; // Solmar General hospital
  p.health = 100;
  p.wanted = 0;
  p.wantedTimer = 0;
  p.hitByPolice = 0;
  game.footCops = [];
  game.cars = game.cars.filter((c) => c.kind !== 'police');
  game.screen = 'play';
}

function updateGame(game, input, dt) {
  game.time += dt;
  const p = game.player;
  const city = game.city;

  // --- Input: world-space mouse for aiming.
  const mouse = input.mouseWorld();
  const move = input.move();

  if (p.onFoot) {
    const fired = updatePlayerOnFoot(p, {
      up: move.up, down: move.down, left: move.left, right: move.right,
      sprint: move.sprint, mouseX: mouse.x, mouseY: mouse.y, fire: input.fire,
    }, dt, city);
    if (fired) {
      game.audio.play('shot');
      burst(game, p.x + Math.cos(p.aimAngle) * 22, p.y + Math.sin(p.aimAngle) * 22, '#ffd23c', 4, 120);
      scarePedestrians(game.peds, p.x, p.y, 420);
      if (p.wanted === 0) addWanted(p, 1);
    }
    const actions = input.takeActions();
    if (actions & ACTION_ENTER) {
      const car = nearestCar(p, game.cars, 78);
      if (car && car.kind !== 'wreck') {
        const wasOccupied = car.kind === 'traffic';
        const wasPolice = car.kind === 'police';
        enterCar(p, car);
        if (wasPolice) { addWanted(p, 1); showMessage(game.missions, 'You jacked a police cruiser! +1 star', 3); }
        else if (wasOccupied) { addWanted(p, 1); showMessage(game.missions, 'Car jacked! +1 star', 3); }
        else if (car.isComet) {
          game.audio.play('pickup');
          showMessage(game.missions, 'The Comet GT is yours. Cops will notice — move!', 4);
          addWanted(p, 1);
          game.cars.push(spawnPoliceCar(city, game.rng, p));
        } else if (game.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 420)) {
          addWanted(p, 1); showMessage(game.missions, 'Spotted stealing! +1 star', 3);
        }
      }
    }
  } else {
    // Driving.
    const car = p.car;
    const prevX = car.x, prevY = car.y;
    const throttle = (move.up ? 1 : 0) - (move.down ? 0.6 : 0);
    const steer = (move.right ? 1 : 0) - (move.left ? 1 : 0);
    driveCar(car, { throttle, steer }, dt, city);
    p.x = car.x; p.y = car.y;
    p.vx = Math.cos(car.angle) * car.speed; p.vy = Math.sin(car.angle) * car.speed;
    if (Math.abs(steer) > 0.6 && Math.abs(car.speed) > 200) {
      game.skids.push({ x1: prevX, y1: prevY, x2: car.x, y2: car.y });
      if (game.skids.length > 240) game.skids.shift();
    }
    if (car.damaged > 0) {
      car.damaged -= dt;
      game.audio.play('crash');
      burst(game, car.x, car.y, '#ff8844', 8, 160);
      car.health -= 6;
    }
    // Run over pedestrians.
    for (const ped of game.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 60) {
        ped.dead = true;
        addWanted(p, 1);
        burst(game, ped.x, ped.y, '#c0392b', 10, 140);
        scarePedestrians(game.peds, ped.x, ped.y, 380);
      }
    }
    const actions = input.takeActions();
    if (actions & ACTION_ENTER) exitCar(p, city);
  }

  // Bullets.
  const targets = [...game.peds, ...game.footCops, ...game.cars.filter((c) => c.kind !== 'parked')];
  const hits = updateBullets(p, dt, city, targets);
  for (const h of hits) {
    if (h.kind === 'body' && h.target) {
      const t = h.target;
      if (t.kind === 'ped') {
        t.dead = true;
        addWanted(p, 1);
        burst(game, h.x, h.y, '#c0392b', 8, 120);
        scarePedestrians(game.peds, h.x, h.y, 360);
      } else if (t.kind === 'cop') {
        t.dead = true;
        addWanted(p, 1);
        burst(game, h.x, h.y, '#20305e', 8, 120);
      } else {
        t.health -= 30;
        t.damaged = 0.5;
        burst(game, h.x, h.y, '#ffcc44', 6, 150);
        if (t.health <= 0 && t.kind === 'police') {
          t.kind = 'wreck';
          t.speed = 0;
          game.footCops.push(makeFootCop(t.x + 30, t.y));
          addWanted(p, 1);
        } else if (t.health <= 0) {
          t.kind = 'wreck';
          t.speed = 0;
        }
      }
    }
  }

  // Police rams hurt the player (on foot) or the car.
  if (p.hitByPolice > 0) {
    if (p.onFoot) p.health -= 26 * p.hitByPolice;
    else if (p.car) p.car.health -= 30 * p.hitByPolice;
    p.hitByPolice = 0;
  }
  if (!p.onFoot && p.car && p.car.health <= 0) {
    burst(game, p.car.x, p.car.y, '#888888', 16, 180);
    showMessage(game.missions, 'Your ride is wrecked — bail out!', 4);
    exitCar(p, city);
  }

  updateTraffic(game.cars, dt, city, game.rng, game.cars);
  updatePolice(game.cars, dt, city, p);
  resolveCarCollisions(game.cars);
  updatePedestrians(game.peds, dt, city, p);
  updateFootCops(game.footCops, dt, city, p);
  updateWanted(game, dt);
  updateMissions(game, dt);
  game.missionStep = currentStep(game.missions);

  // Health pickups.
  for (const pk of game.pickups) {
    if (pk.taken) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) pk.taken = false;
      continue;
    }
    if (p.onFoot && Math.hypot(p.x - pk.x, p.y - pk.y) < 32 && p.health < p.maxHealth) {
      pk.taken = true;
      pk.respawn = 45;
      p.health = Math.min(p.maxHealth, p.health + 40);
      game.audio.play('pickup');
      burst(game, pk.x, pk.y, '#58c96b', 10, 120);
    }
  }

  // Particles.
  for (const pt of game.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
  }
  game.particles = game.particles.filter((pt) => pt.life > 0);

  // Wrecked cars smoke.
  for (const c of game.cars) {
    if (c.kind === 'wreck' && Math.random() < dt * 6) {
      game.particles.push({ x: c.x, y: c.y - 6, vx: 0, vy: -40, life: 0.8, maxLife: 0.8, color: '#666666', size: 5 });
    }
  }

  // Audio follows the action.
  const driving = !p.onFoot && p.car;
  game.audio.setEngine(driving ? Math.abs(p.car.speed) / p.car.maxSpeed : 0, driving);
  game.audio.setSiren(p.wanted, game.time);

  updateCamera(game, dt);

  if (p.health <= 0 && game.screen === 'play') endRun(game, 'wasted');
}

function drawEdgeArrow(game) {
  const step = game.missionStep;
  if (!step || game.screen !== 'play') return;
  const p = game.player;
  const scale = game.viewScale;
  const sx = (step.x - game.camera.x) * scale;
  const sy = (step.y - game.camera.y) * scale;
  if (sx > 40 && sx < game.viewW - 40 && sy > 40 && sy < game.viewH - 40) return;
  const cx = game.viewW / 2, cy = game.viewH / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(a) * (Math.min(game.viewW, game.viewH) / 2 - 70);
  const ey = cy + Math.sin(a) * (Math.min(game.viewW, game.viewH) / 2 - 70);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd23c';
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPickups(game) {
  const scale = game.viewScale;
  ctx.save();
  ctx.translate(-game.camera.x * scale, -game.camera.y * scale);
  ctx.scale(scale, scale);
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    const pulse = 1 + 0.15 * Math.sin(game.time * 4);
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2fae4e';
    ctx.fillRect(-3, -9, 6, 18);
    ctx.fillRect(-9, -3, 18, 6);
    ctx.restore();
  }
  ctx.restore();
}

// ---------- Menus, save, boot ----------

const game = createGame(seed);
resize(game);
window.addEventListener('resize', () => resize(game));
const hud = makeHud();
const input = createInput(canvas, (sx, sy) => ({
  x: game.camera.x + sx / game.viewScale,
  y: game.camera.y + sy / game.viewScale,
}));

game.saveGame = function () {
  writeSave({
    cash: game.player.cash, missionIndex: game.missions.index,
    x: game.player.x, y: game.player.y, health: game.player.health,
  });
};

function applySave(data) {
  if (!data) return;
  game.player.cash = data.cash || 0;
  game.missions.index = data.missionIndex || 0;
  game.player.x = data.x || 1460;
  game.player.y = data.y || 1500;
  game.player.health = data.health || 100;
}

function showMenu() {
  game.screen = 'menu';
  document.getElementById('menu').style.display = 'flex';
  document.getElementById('hud').style.display = 'none';
  const cont = document.getElementById('continue-btn');
  cont.style.display = game.savedData ? 'inline-block' : 'none';
}

function startPlay(fromSave) {
  game.audio.init();
  document.getElementById('menu').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  if (fromSave) applySave(game.savedData);
  else {
    game.player.cash = 0;
    game.missions = makeMissionState();
  }
  game.screen = 'play';
  startMission(game.missions, game);
  game.camera.x = Math.max(0, game.player.x - game.camera.w / 2);
  game.camera.y = Math.max(0, game.player.y - game.camera.h / 2);
}

document.getElementById('start-btn').addEventListener('click', () => startPlay(false));
document.getElementById('continue-btn').addEventListener('click', () => startPlay(true));
document.getElementById('resume-btn').addEventListener('click', () => {
  document.getElementById('pause-menu').style.display = 'none';
  game.screen = 'play';
});
document.getElementById('save-btn').addEventListener('click', () => {
  game.saveGame();
  document.getElementById('save-btn').textContent = 'Saved ✓';
  setTimeout(() => { document.getElementById('save-btn').textContent = 'Save game'; }, 1200);
});
document.getElementById('quit-btn').addEventListener('click', () => {
  game.saveGame();
  document.getElementById('pause-menu').style.display = 'none';
  showMenu();
});
document.getElementById('over-btn').addEventListener('click', () => respawn(game));

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  // Screenshot autopilot (cover shot): keep the Comet GT driving during the loop.
  const inp = game.shotInput || input;
  if (game.screen === 'play') {
    const actions = inp.takeActions();
    if (actions & ACTION_PAUSE) {
      game.screen = 'paused';
      document.getElementById('pause-menu').style.display = 'flex';
    } else {
      updateGame(game, inp, dt);
    }
    drawWorld(ctx, game);
    drawPickups(game);
    drawEdgeArrow(game);
    updateHud(hud, game);
    drawMinimap(hud, game);
  } else if (game.screen === 'paused') {
    const actions = inp.takeActions();
    if (actions & ACTION_PAUSE) {
      document.getElementById('pause-menu').style.display = 'none';
      game.screen = 'play';
    }
    drawWorld(ctx, game);
    drawPickups(game);
  } else if (game.screen === 'over') {
    const actions = inp.takeActions();
    if (actions & ACTION_CONFIRM) respawn(game);
    drawWorld(ctx, game);
    drawPickups(game);
    updateHud(hud, game);
    drawMinimap(hud, game);
  } else {
    // Menu: idle city backdrop, slow camera drift.
    game.time += dt;
    updateCamera(game, dt);
    drawWorld(ctx, game);
  }
  if (shot) {
    shotElapsed += dt;
    if (shotElapsed > 2.5) window.__shotReady = true;
  }
}

let last = performance.now();
let shotElapsed = 0;
if (shot) {
  // Screenshot mode: stage the scene, then run the normal frame loop so the
  // canvas is repainted every frame (a resize clears it) and the scene stays
  // alive; flag readiness after 2.5 s of simulated time.
  const staged = stageShot(shot, game);
  if (shot === 'menu') {
    game.screen = 'menu';
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('continue-btn').style.display = game.savedData ? 'inline-block' : 'none';
  } else {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    game.screen = 'play';
  }
  // Cover shot: keep the Comet GT driving through the whole loop.
  if (staged.autopilot) {
    game.shotInput = {
      move: () => ({ up: true, down: false, left: false, right: false, sprint: false }),
      mouseWorld: () => ({ x: game.player.x + 200, y: game.player.y }),
      fire: false,
      takeActions: () => 0,
    };
  }
  updateCamera(game, 0.5);
  // Drive the cover shot forward so the chase is mid-action.
  if (staged.autopilot) {
    for (let i = 0; i < 150; i++) {
      const car = game.player.car;
      if (!car) break;
      driveCar(car, { throttle: 1, steer: 0 }, STEP, game.city);
      game.player.x = car.x; game.player.y = car.y;
      updateTraffic(game.cars, STEP, game.city, game.rng, game.cars);
      updatePolice(game.cars, STEP, game.city, game.player);
      game.time += STEP;
    }
  }
  updateCamera(game, 0.5);
  requestAnimationFrame(frame);
} else {
  showMenu();
  requestAnimationFrame(frame);
}
