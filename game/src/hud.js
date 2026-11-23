// hud.js — the HUD: cash, health, wanted stars, objective, and the minimap.
import { WORLD_W, WORLD_H, ROAD_W, WATER_X, BEACH_X } from './city.js';

export function makeHud() {
  return {
    cash: document.getElementById('cash'),
    healthFill: document.getElementById('health-fill'),
    healthText: document.getElementById('health-text'),
    stars: document.getElementById('stars'),
    objective: document.getElementById('objective'),
    objectiveDist: document.getElementById('objective-dist'),
    speed: document.getElementById('speed'),
    banner: document.getElementById('banner'),
    minimap: document.getElementById('minimap'),
  };
}

export function updateHud(hud, game) {
  const p = game.player;
  hud.cash.textContent = '$' + p.cash.toLocaleString('en-US');
  hud.healthFill.style.width = Math.max(0, p.health) + '%';
  hud.healthFill.style.background = p.health > 50 ? '#58c96b' : (p.health > 25 ? '#e8b93c' : '#d94f3d');
  hud.healthText.textContent = Math.ceil(Math.max(0, p.health)) + ' HP';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < p.wanted ? '★' : '☆';
  hud.stars.textContent = stars;
  hud.stars.style.color = p.wanted > 0 ? '#ffd23c' : '#8899aa';
  const step = game.missionStep;
  if (step) {
    hud.objective.textContent = '◆ ' + step.text;
    const d = Math.hypot(p.x - step.x, p.y - step.y);
    hud.objectiveDist.textContent = Math.round(d) + 'm';
  } else if (game.missions.done) {
    hud.objective.textContent = '★ SOLMAR IS YOURS — free roam';
    hud.objectiveDist.textContent = '';
  } else {
    hud.objective.textContent = 'Free roam — the next job from Mama June starts on its own';
    hud.objectiveDist.textContent = '';
  }
  if (!p.onFoot && p.car) {
    hud.speed.textContent = Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h';
  } else {
    hud.speed.textContent = 'on foot';
  }
  if (game.missions.messageTimer > 0) {
    hud.banner.style.display = 'block';
    hud.banner.textContent = game.missions.message;
  } else {
    hud.banner.style.display = 'none';
  }
}

export function drawMinimap(hud, game) {
  const canvas = hud.minimap;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const sx = W / WORLD_W, sy = H / WORLD_H;
  ctx.fillStyle = '#1d2b1d';
  ctx.fillRect(0, 0, W, H);
  // Water + beach.
  ctx.fillStyle = '#2f6f9f';
  ctx.fillRect(0, 0, WATER_X * sx, H);
  ctx.fillStyle = '#e8d5a0';
  ctx.fillRect(WATER_X * sx, 0, (BEACH_X - WATER_X) * sx, H);
  // Park.
  for (const park of game.city.parks) {
    ctx.fillStyle = '#3f7d44';
    ctx.fillRect(park.x * sx, park.y * sy, park.w * sx, park.h * sy);
  }
  // Roads.
  ctx.fillStyle = '#4a4a52';
  for (const rx of game.city.vRoads) ctx.fillRect((rx - ROAD_W / 2) * sx, 0, ROAD_W * sx, H);
  for (const ry of game.city.hRoads) ctx.fillRect(0, (ry - ROAD_W / 2) * sy, W, ROAD_W * sy);
  // Buildings.
  ctx.fillStyle = '#2c2c34';
  for (const b of game.city.buildings) ctx.fillRect(b.x * sx, b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  // Mission marker.
  const step = game.missionStep;
  if (step) {
    const pulse = 3 + 2 * Math.sin(game.time * 5);
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(step.x * sx, step.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police (red/blue) and traffic (white dots).
  for (const car of game.cars) {
    if (car.kind === 'police') {
      ctx.fillStyle = (Math.floor(game.time * 4) % 2 === 0) ? '#ff4444' : '#4488ff';
      ctx.fillRect(car.x * sx - 2, car.y * sy - 2, 4, 4);
    }
  }
  // Player arrow.
  const p = game.player;
  ctx.save();
  ctx.translate(p.x * sx, p.y * sy);
  ctx.rotate(p.onFoot ? p.angle : (p.car ? p.car.angle : 0));
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Viewport box.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(game.camera.x * sx, game.camera.y * sy, game.camera.w * sx, game.camera.h * sy);
}
