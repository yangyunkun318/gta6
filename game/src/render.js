// render.js — top-down canvas renderer for Solmar Bay.
import { WORLD_W, WORLD_H, ROAD_W, WATER_X, BEACH_X } from './city.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, game) {
  const cam = game.camera;
  const scale = game.viewScale;
  ctx.save();
  ctx.clearRect(0, 0, game.viewW, game.viewH);
  // Warm sun-soaked daylight.
  ctx.fillStyle = '#79a75c';
  ctx.fillRect(0, 0, game.viewW, game.viewH);
  ctx.translate(-cam.x * scale, -cam.y * scale);
  ctx.scale(scale, scale);

  const vx0 = cam.x - 60, vy0 = cam.y - 60, vx1 = cam.x + cam.w + 60, vy1 = cam.y + cam.h + 60;
  const city = game.city;

  // Water (west) with wave lines, then sand.
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(vx0, vy0, WATER_X - vx0 + 0, vy1 - vy0);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  for (let y = Math.floor(vy0 / 90) * 90; y < vy1; y += 90) {
    ctx.beginPath();
    ctx.moveTo(8, y + Math.sin(game.time * 1.4 + y) * 6);
    ctx.quadraticCurveTo(35, y + 10 + Math.sin(game.time * 1.4 + y) * 6, 62, y + Math.sin(game.time * 1.4 + y) * 6);
    ctx.stroke();
  }
  ctx.fillStyle = '#ecd9a4';
  ctx.fillRect(WATER_X, vy0, BEACH_X - WATER_X, vy1 - vy0);

  // Docks strip (south).
  ctx.fillStyle = '#8d8d94';
  ctx.fillRect(vx0, 2220, vx1 - vx0, WORLD_H - 2220);

  // Sidewalk blocks: light pavement under each block.
  ctx.fillStyle = '#b9b3a4';
  for (let vi = 0; vi < city.vRoads.length - 1; vi++) {
    for (let hi = 0; hi < city.hRoads.length - 1; hi++) {
      const bx = city.vRoads[vi] + ROAD_W / 2, by = city.hRoads[hi] + ROAD_W / 2;
      const bw = city.vRoads[vi + 1] - city.vRoads[vi] - ROAD_W;
      const bh = city.hRoads[hi + 1] - city.hRoads[hi] - ROAD_W;
      if (bx < BEACH_X + 20) continue;
      ctx.fillRect(bx, by, bw, bh);
    }
  }

  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = '#4c8a4a';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#5d9c55';
    ctx.beginPath(); ctx.arc(park.x + park.w * 0.5, park.y + park.h * 0.5, 46, 0, Math.PI * 2); ctx.fill();
  }

  // Roads.
  ctx.fillStyle = '#3c3c44';
  for (const rx of city.vRoads) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const ry of city.hRoads) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  // Lane dashes.
  ctx.strokeStyle = '#e8d44d';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const rx of city.vRoads) {
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD_H); ctx.stroke();
  }
  for (const ry of city.hRoads) {
    ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings with drop shadows and roof details.
  for (const b of city.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x, b.y, b.w, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x, b.y + b.h - 7, b.w, 7);
    if (b.tall) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + b.w - 14, b.y + 10, 14, b.h - 20);
      ctx.fillStyle = '#5a6a7a';
      ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, 12);
    }
    if (b.roof === 'pool') {
      ctx.fillStyle = '#3fa7c9';
      roundRect(ctx, b.x + b.w / 2 - 16, b.y + b.h / 2 - 10, 32, 20, 6); ctx.fill();
    } else if (b.roof === 'ac') {
      ctx.fillStyle = '#cfd2d6';
      ctx.fillRect(b.x + 12, b.y + 12, 16, 12);
      ctx.fillRect(b.x + b.w - 28, b.y + b.h - 24, 16, 12);
    }
  }

  // Props: palms and dock crates.
  for (const pr of city.props) {
    if (pr.x < vx0 || pr.x > vx1 || pr.y < vy0 || pr.y > vy1) continue;
    if (pr.kind === 'palm') {
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x + 3, pr.y - 12); ctx.stroke();
      ctx.fillStyle = '#3f8a3f';
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.5;
        ctx.beginPath();
        ctx.ellipse(pr.x + 3 + Math.cos(a) * 9, pr.y - 12 + Math.sin(a) * 9, 11, 4.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pr.kind === 'crate') {
      ctx.fillStyle = pr.color;
      ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(pr.x, pr.y, pr.w, pr.h);
    }
  }

  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.4)';
  ctx.lineWidth = 4;
  for (const s of game.skids) {
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }

  // Mission marker: pulsing beacon + ground ring.
  const step = game.missionStep;
  if (step) {
    const pulse = 1 + 0.18 * Math.sin(game.time * 5);
    ctx.save();
    ctx.translate(step.x, step.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(255,210,60,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(12, -30); ctx.lineTo(-12, -30); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Light beam.
    const grad = ctx.createLinearGradient(step.x, step.y - 240, step.x, step.y);
    grad.addColorStop(0, 'rgba(255,210,60,0)');
    grad.addColorStop(1, 'rgba(255,210,60,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(step.x - 10, step.y - 240, 20, 240);
  }

  // Cars.
  for (const car of game.cars) drawCar(ctx, game, car);
  // Pedestrians and foot cops.
  for (const p of game.peds) drawPed(ctx, p);
  for (const c of game.footCops) drawPed(ctx, c);
  // Player.
  drawPlayer(ctx, game);
  // Bullets.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  for (const b of game.player.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Particles.
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawCar(ctx, game, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -22 + 3, -10 + 4, 46, 22, 7); ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -23, -11, 46, 22, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  roundRect(ctx, -23, -11, 46, 7, 7); ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = '#1d2733';
  roundRect(ctx, -6, -8, 16, 16, 4); ctx.fill();
  ctx.fillStyle = '#9fd8ef';
  ctx.fillRect(8, -8, 4, 16);
  // Wheels.
  ctx.fillStyle = '#141414';
  ctx.fillRect(-17, -13, 9, 5); ctx.fillRect(-17, 8, 9, 5);
  ctx.fillRect(9, -13, 9, 5); ctx.fillRect(9, 8, 9, 5);
  // Headlights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(22, -8, 2.5, 4); ctx.fillRect(22, 4, 2.5, 4);
  if (car.kind === 'police') {
    const flash = Math.floor(game.time * 5) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
    ctx.fillRect(-4, -11, 8, 4);
    ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30';
    ctx.fillRect(-4, 7, 8, 4);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  if (car.isComet) {
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COMET GT', 0, -15);
  }
  if (car.damaged > 0) {
    ctx.fillStyle = 'rgba(60,60,60,0.8)';
    ctx.beginPath(); ctx.arc(-14, -6, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, p) {
  if (p.dead) return;
  const bob = Math.sin(p.bob) * 1.5;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 4, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3, 4, 0, Math.PI * 2); ctx.fill();
  if (p.kind === 'cop') {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    ctx.strokeStyle = '#20305e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (!p.onFoot) return; // drawn with the car
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 5, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Teal jacket, dark cap — Rook stands out from the crowd.
  ctx.fillStyle = '#0f8a7a';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c98a';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#12333a';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4 - 3, 5, Math.PI, 0); ctx.fill();
  // Gun direction.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.aimAngle) * 8, Math.sin(p.aimAngle) * 8);
  ctx.lineTo(Math.cos(p.aimAngle) * 20, Math.sin(p.aimAngle) * 20);
  ctx.stroke();
  ctx.restore();
}
