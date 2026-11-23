// city.js — Solmar Bay: procedural city layout, roads, buildings, collision.
// The city is a deterministic grid so screenshots are reproducible from a seed.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;
export const BEACH_X = 170; // west of this is sand, then water
export const WATER_X = 70;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = {
  downtown: ['#c96f4a', '#b85c5a', '#8a6f8e', '#5f7f8c', '#a08c5b', '#946b4a'],
  residential: ['#e0a878', '#d98f6a', '#e8c48f', '#c98a7a', '#b7c4a8', '#d9b48a'],
  docks: ['#7a7f85', '#6b7280', '#8a7a68'],
};

export function createCity(seed) {
  const rng = mulberry32(seed);
  const vRoads = [260, 660, 1060, 1460, 1860, 2260, 2660, 3060];
  const hRoads = [260, 660, 1060, 1460, 1860, 2160];
  const buildings = [];
  const props = []; // palms, hydrants, benches, containers
  const parks = [];

  // One park block, one plaza block.
  const parkBlock = { x: 1060 + ROAD_W / 2, y: 660 + ROAD_W / 2, w: 400 - ROAD_W, h: 400 - ROAD_W };
  parks.push(parkBlock);
  for (let i = 0; i < 26; i++) {
    props.push({ kind: 'palm', x: parkBlock.x + 30 + rng() * (parkBlock.w - 60), y: parkBlock.y + 30 + rng() * (parkBlock.h - 60), r: 10 });
  }

  for (let vi = 0; vi < vRoads.length - 1; vi++) {
    for (let hi = 0; hi < hRoads.length - 1; hi++) {
      const bx = vRoads[vi] + ROAD_W / 2;
      const by = hRoads[hi] + ROAD_W / 2;
      const bw = vRoads[vi + 1] - vRoads[vi] - ROAD_W;
      const bh = hRoads[hi + 1] - hRoads[hi] - ROAD_W;
      if (bx < BEACH_X + 40) continue; // beach blocks stay open
      const cx = bx + bw / 2, cy = by + bh / 2;
      const downtown = cx > 1200 && cx < 2100 && cy > 800 && cy < 1700;
      if (bx === parkBlock.x && by === parkBlock.y) continue;
      const count = downtown ? (rng() < 0.5 ? 1 : 2) : 1 + Math.floor(rng() * 3);
      const palette = downtown ? PALETTES.downtown : (cy > 1900 ? PALETTES.docks : PALETTES.residential);
      for (let k = 0; k < count; k++) {
        const w = Math.min(bw * (count === 1 ? 0.72 : 0.42), 300);
        const h = Math.min(bh * (count === 1 ? 0.66 : 0.42), 260);
        const x = bx + (bw - w) * (count === 1 ? 0.5 : rng());
        const y = by + (bh - h) * (count === 1 ? 0.5 : rng());
        buildings.push({
          x, y, w, h,
          tall: downtown && rng() < 0.6,
          color: palette[Math.floor(rng() * palette.length)],
          roof: rng() < 0.4 ? 'pool' : (rng() < 0.5 ? 'ac' : 'plain'),
        });
      }
      if (rng() < 0.6) props.push({ kind: 'palm', x: bx + 24 + rng() * (bw - 48), y: by + 24 + rng() * (bh - 48), r: 9 });
    }
  }
  // Beach palms along the sand strip.
  for (let y = 140; y < WORLD_H - 100; y += 170 + rng() * 120) {
    props.push({ kind: 'palm', x: 120 + rng() * 40, y, r: 11 });
  }
  // Dock containers in the south strip.
  for (let i = 0; i < 14; i++) {
    props.push({ kind: 'crate', x: 500 + rng() * 2400, y: 2260 + rng() * 90, w: 46 + rng() * 30, h: 26, color: ['#c25b4a', '#4a7d8c', '#d9a441', '#6a8c5a'][i % 4] });
  }

  const city = { seed, rng, vRoads, hRoads, buildings, props, parks };
  return city;
}

export function isOnRoad(city, x, y) {
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return false;
  const half = ROAD_W / 2;
  for (const rx of city.vRoads) if (Math.abs(x - rx) <= half) return true;
  for (const ry of city.hRoads) if (Math.abs(y - ry) <= half) return true;
  return false;
}

// Push a circle out of every building it overlaps. Returns corrected {x, y}.
export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // Center inside the building: push out along the smallest axis.
        const left = x - b.x, right = b.x + b.w - x, top = y - b.y, bot = b.y + b.h - y;
        const m = Math.min(left, right, top, bot);
        if (m === left) x = b.x - r; else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r; else y = b.y + b.h + r;
      }
    }
  }
  x = Math.max(24, Math.min(WORLD_W - 24, x));
  y = Math.max(24, Math.min(WORLD_H - 24, y));
  return { x, y };
}

export function pointOnRoad(city, rng) {
  if (rng() < 0.5) {
    const rx = city.vRoads[Math.floor(rng() * city.vRoads.length)];
    return { x: rx + (rng() - 0.5) * (ROAD_W - 36), y: 120 + rng() * (WORLD_H - 240), angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }
  const ry = city.hRoads[Math.floor(rng() * city.hRoads.length)];
  return { x: 220 + rng() * (WORLD_W - 440), y: ry + (rng() - 0.5) * (ROAD_W - 36), angle: rng() < 0.5 ? 0 : Math.PI };
}

// Nearest point on the road network (for snapping traffic and routing).
export function nearestRoadPoint(city, x, y) {
  let best = null, bd = Infinity;
  for (const rx of city.vRoads) {
    const px = rx, py = Math.max(120, Math.min(WORLD_H - 120, y));
    const d = (x - px) * (x - px) + (y - py) * (y - py);
    if (d < bd) { bd = d; best = { x: px, y: py }; }
  }
  for (const ry of city.hRoads) {
    const px = Math.max(220, Math.min(WORLD_W - 120, x)), py = ry;
    const d = (x - px) * (x - px) + (y - py) * (y - py);
    if (d < bd) { bd = d; best = { x: px, y: py }; }
  }
  return best;
}
