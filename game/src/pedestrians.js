// pedestrians.js — sidewalk wanderers, fleeing crowds, and foot cops.
import { WORLD_W, WORLD_H, collideBuildings, isOnRoad } from './city.js';

const SHIRTS = ['#e86a5a', '#5aa8e8', '#e8c85a', '#8ae89a', '#e89ad0', '#f2f2f2', '#7a6ad0', '#e89a5a'];

export function spawnPedestrians(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    // Stand near a road (on the sidewalk edge).
    const rx = city.vRoads[Math.floor(rng() * city.vRoads.length)];
    const ry = city.hRoads[Math.floor(rng() * city.hRoads.length)];
    let x, y;
    if (rng() < 0.5) { x = rx + (rng() < 0.5 ? -62 : 62); y = 140 + rng() * (WORLD_H - 280); }
    else { x = 240 + rng() * (WORLD_W - 480); y = ry + (rng() < 0.5 ? -62 : 62); }
    peds.push({
      id: 'ped' + i, x, y, angle: rng() * Math.PI * 2,
      speed: 26 + rng() * 30, shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
      kind: 'ped', state: 'walk', flee: 0, dead: false,
      changeIn: 1 + rng() * 4, bob: rng() * 6,
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, city, threat) {
  for (const p of peds) {
    if (p.dead) continue;
    p.bob += dt * 8;
    let speed = p.speed;
    if (p.flee > 0) {
      p.flee -= dt;
      speed = p.speed * 3.2;
      const away = Math.atan2(p.y - threat.y, p.x - threat.x);
      p.angle = away;
    } else {
      p.changeIn -= dt;
      if (p.changeIn <= 0) {
        p.changeIn = 2 + Math.random() * 5;
        // Drift along sidewalks: pick a nearby road direction.
        if (isOnRoad(city, p.x, p.y)) p.angle = Math.random() * Math.PI * 2;
        else p.angle += (Math.random() - 0.5) * 1.6;
      }
    }
    const nx = p.x + Math.cos(p.angle) * speed * dt;
    const ny = p.y + Math.sin(p.angle) * speed * dt;
    const fixed = collideBuildings(city, nx, ny, 10);
    p.x = fixed.x; p.y = fixed.y;
    if (fixed.x !== nx || fixed.y !== ny) p.angle += Math.PI / 2;
  }
}

export function scarePedestrians(peds, x, y, radius) {
  for (const p of peds) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) p.flee = 2 + Math.random() * 2;
  }
}

// Foot cops: spawn when the player is on foot and wanted. They chase and grab.
export function makeFootCop(x, y) {
  return {
    id: 'cop' + Math.floor(Math.random() * 1e9), x, y, angle: 0,
    speed: 165, shirt: '#20305e', kind: 'cop',
    state: 'chase', flee: 0, dead: false, grab: 0, bob: 0, changeIn: 0,
  };
}

export function updateFootCops(cops, dt, city, player) {
  for (const c of cops) {
    if (c.dead) continue;
    c.bob += dt * 8;
    const d = Math.hypot(player.x - c.x, player.y - c.y);
    if (d < 30) {
      c.grab += dt;
      player.health -= 14 * dt;
    } else {
      c.grab = Math.max(0, c.grab - dt * 2);
      const want = Math.atan2(player.y - c.y, player.x - c.x);
      c.angle = want;
      const nx = c.x + Math.cos(c.angle) * c.speed * dt;
      const ny = c.y + Math.sin(c.angle) * c.speed * dt;
      const fixed = collideBuildings(city, nx, ny, 10);
      c.x = fixed.x; c.y = fixed.y;
    }
  }
}
