// player.js — Rex "Rook" Calloway on foot: movement, shooting, entering cars.
import { collideBuildings } from './city.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, vx: 0, vy: 0,
    onFoot: true, car: null,
    health: 100, maxHealth: 100,
    cash: 0, wanted: 0, wantedTimer: 0,
    aimAngle: 0, fireCooldown: 0, bullets: [],
    hitByPolice: 0, bustedTimer: 0,
    dead: false, busted: false,
  };
}

export function updatePlayerOnFoot(player, input, dt, city) {
  const sprint = input.sprint ? 1.5 : 1;
  const speed = 225 * sprint;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  player.vx = mx * speed; player.vy = my * speed;
  const nx = player.x + player.vx * dt;
  const ny = player.y + player.vy * dt;
  const fixed = collideBuildings(city, nx, ny, 13);
  player.x = fixed.x; player.y = fixed.y;
  if (len > 0) player.angle = Math.atan2(my, mx);
  player.aimAngle = Math.atan2(input.mouseY - player.y, input.mouseX - player.x);
  player.fireCooldown -= dt;
  if (input.fire && player.fireCooldown <= 0) {
    player.fireCooldown = 0.22;
    player.bullets.push({
      x: player.x + Math.cos(player.aimAngle) * 18,
      y: player.y + Math.sin(player.aimAngle) * 18,
      vx: Math.cos(player.aimAngle) * 720, vy: Math.sin(player.aimAngle) * 720,
      life: 0.55,
    });
    return true; // fired
  }
  return false;
}

export function updateBullets(player, dt, city, targets) {
  // targets: { peds, cops, cars } — bullets hurt peds/cops and dent cars.
  const hits = [];
  for (const b of player.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    const hit = collideBuildings(city, b.x, b.y, 2);
    if (hit.x !== b.x || hit.y !== b.y) { b.life = 0; hits.push({ x: b.x, y: b.y, kind: 'wall' }); continue; }
    for (const t of targets) {
      if (t.dead) continue;
      const r = t.kind === 'ped' || t.kind === 'cop' ? 12 : 24;
      if (Math.hypot(t.x - b.x, t.y - b.y) < r) {
        b.life = 0;
        hits.push({ x: b.x, y: b.y, kind: 'body', target: t });
        break;
      }
    }
  }
  player.bullets = player.bullets.filter((b) => b.life > 0);
  return hits;
}

export function nearestCar(player, cars, maxDist) {
  let best = null, bd = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// Stealing a car: parked ones are free, occupied ones raise the heat.
export function enterCar(player, car) {
  player.onFoot = false;
  player.car = car;
  car.kind = car.kind === 'police' ? 'police' : 'player';
  car.speed = 0;
  player.x = car.x; player.y = car.y;
}

export function exitCar(player, city) {
  const car = player.car;
  player.onFoot = true;
  player.car = null;
  const a = car.angle + Math.PI / 2;
  const p = collideBuildings(city, car.x + Math.cos(a) * 40, car.y + Math.sin(a) * 40, 13);
  player.x = p.x; player.y = p.y;
  player.vx = 0; player.vy = 0;
  if (car.kind === 'player') car.kind = 'parked';
}

export function addWanted(player, n) {
  player.wanted = Math.max(0, Math.min(5, player.wanted + n));
  player.wantedTimer = 0;
}
