// vehicles.js — car physics, traffic AI, police pursuit, stealing.
import { WORLD_W, WORLD_H, ROAD_W, collideBuildings, isOnRoad, nearestRoadPoint, pointOnRoad } from './city.js';

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8b93c', '#5aa864', '#e8e4da', '#7a5aa8', '#d97b2f', '#2f2f38', '#c9a227'];
export const POLICE_COLOR = '#20305e';

let nextId = 1;

export function makeCar(x, y, angle, color, kind = 'traffic') {
  return {
    id: nextId++, x, y, angle, color, kind,
    speed: 0, maxSpeed: kind === 'police' ? 430 : 300,
    accel: kind === 'police' ? 260 : 170,
    w: 46, h: 22, health: 100,
    target: null, wait: 0, siren: 0,
    damaged: 0, // visual damage timer
  };
}

// Arcade car physics: throttle, brake/reverse, steering scales with speed.
export function driveCar(car, input, dt, city) {
  const forward = input.throttle; // -1..1
  const steer = input.steer; // -1..1
  const maxF = car.maxSpeed;
  const maxR = 130;
  if (forward > 0) car.speed += car.accel * forward * dt;
  else if (forward < 0) car.speed += car.accel * forward * dt * 0.8;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  car.speed = Math.max(-maxR, Math.min(maxF, car.speed));
  if (Math.abs(car.speed) > 4) {
    car.angle += steer * (car.speed > 0 ? 1 : -1) * 2.1 * dt * Math.min(1, Math.abs(car.speed) / 120);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideBuildings(city, nx, ny, 22);
  if (fixed.x !== nx || fixed.y !== ny) {
    if (Math.abs(car.speed) > 160) car.damaged = 0.5;
    car.speed *= 0.45;
  }
  car.x = fixed.x; car.y = fixed.y;
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = pointOnRoad(city, rng);
    const car = makeCar(p.x, p.y, p.angle, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], 'traffic');
    car.speed = 90 + rng() * 120;
    car.target = pickRoadTarget(city, rng, car);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = pointOnRoad(city, rng);
    const side = rng() < 0.5 ? 1 : -1;
    const along = p.angle === 0 || p.angle === Math.PI;
    const car = makeCar(
      p.x + (along ? 0 : side * (ROAD_W / 2 - 14)),
      p.y + (along ? side * (ROAD_W / 2 - 14) : 0),
      p.angle, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], 'parked');
    cars.push(car);
  }
  return cars;
}

function pickRoadTarget(city, rng, car) {
  const p = pointOnRoad(city, rng);
  return { x: p.x, y: p.y };
}

function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Traffic: drive toward the target road point, pick a new one on arrival.
export function updateTraffic(cars, dt, city, rng, avoid) {
  for (const car of cars) {
    if (car.kind !== 'traffic') continue;
    if (car.wait > 0) { car.wait -= dt; car.speed *= 0.9; continue; }
    if (!car.target) car.target = pickRoadTarget(city, rng, car);
    const d = Math.hypot(car.target.x - car.x, car.target.y - car.y);
    if (d < 60) {
      if (rng() < 0.25) car.wait = 0.6 + rng() * 1.2; // pause at "lights"
      car.target = pickRoadTarget(city, rng, car);
      continue;
    }
    const want = angleTo(car.x, car.y, car.target.x, car.target.y);
    const diff = angleDiff(car.angle, want);
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    // Slow for a car directly ahead.
    let blocked = false;
    for (const other of avoid) {
      if (other === car || other.speed === 0 && other.kind === 'parked') continue;
      const ox = other.x - car.x, oy = other.y - car.y;
      const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 90 && side < 30) { blocked = true; break; }
    }
    driveCar(car, { throttle: blocked ? -0.4 : 0.55, steer }, dt, city);
    // Keep traffic glued to roads: if it drifted off, steer back.
    if (!isOnRoad(city, car.x, car.y)) {
      const p = nearestRoadPoint(city, car.x, car.y);
      car.target = p;
    }
  }
}

// Police: chase the player, ram on contact. Returns cars still active.
export function updatePolice(cars, dt, city, player) {
  for (const car of cars) {
    if (car.kind !== 'police') continue;
    car.siren += dt;
    const px = player.x, py = player.y;
    const d = Math.hypot(px - car.x, py - car.y);
    // Lead the target slightly so the chase looks smart.
    const tx = px + (player.vx || 0) * 0.25, ty = py + (player.vy || 0) * 0.25;
    const want = angleTo(car.x, car.y, tx, ty);
    const diff = angleDiff(car.angle, want);
    const steer = Math.max(-1, Math.min(1, diff * 2.6));
    const throttle = d > 260 ? 1 : (d > 60 ? 0.7 : 0.4);
    driveCar(car, { throttle, steer }, dt, city);
    if (d < 46) {
      car.speed *= 0.4;
      player.hitByPolice = (player.hitByPolice || 0) + dt;
    }
  }
}

export function spawnPoliceCar(city, rng, player) {
  // Appear on a road near the player, off-screen-ish.
  const spots = [];
  for (const rx of city.vRoads) spots.push({ x: rx, y: player.y + (rng() < 0.5 ? -560 : 560) });
  for (const ry of city.hRoads) spots.push({ x: player.x + (rng() < 0.5 ? -560 : 560), y: ry });
  const s = spots[Math.floor(rng() * spots.length)];
  const x = Math.max(120, Math.min(WORLD_W - 120, s.x));
  const y = Math.max(120, Math.min(WORLD_H - 120, s.y));
  const car = makeCar(x, y, angleTo(x, y, player.x, player.y), POLICE_COLOR, 'police');
  car.speed = 200;
  return car;
}

// Circle-ish collision between two cars; push apart and trade speed.
export function resolveCarCollisions(cars) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const swap = a.speed;
        a.speed = b.speed * 0.5; b.speed = swap * 0.5;
        a.damaged = 0.4; b.damaged = 0.4;
      }
    }
  }
}
