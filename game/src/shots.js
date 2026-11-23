// shots.js — screenshot scenes behind ?shot=cover|street|mission|menu.
// Each scene is built from the real game state (same seed, same rules), staged so one
// frame shows the open world at its best: traffic, police, the minimap and a mission.
import { makeCar, spawnPoliceCar, POLICE_COLOR } from './vehicles.js';
import { makeMissionState, startMission, currentStep } from './missions.js';

export const SHOT_NAMES = ['cover', 'street', 'mission', 'menu'];

export function stageShot(name, game) {
  const rng = game.rng;
  const player = game.player;
  game.screen = 'play';
  game.missions = makeMissionState();

  if (name === 'menu') {
    game.screen = 'menu';
    return { autopilot: null };
  }

  if (name === 'cover') {
    // Rook in the Comet GT downtown, two police cruisers on his tail, three stars.
    game.missions.index = 1;
    startMission(game.missions, game);
    const comet = makeCar(1660, 1060, 0, '#d41f2a', 'player');
    comet.isComet = true;
    comet.maxSpeed = 470;
    comet.accel = 330;
    comet.speed = 300;
    game.cars.push(comet);
    player.onFoot = false;
    player.car = comet;
    player.x = comet.x; player.y = comet.y;
    player.wanted = 3;
    player.cash = 1400;
    const cop1 = makeCar(1160, 1110, 0, POLICE_COLOR, 'police');
    cop1.speed = 330;
    const cop2 = makeCar(1100, 1010, 0, POLICE_COLOR, 'police');
    cop2.speed = 310;
    game.cars.push(cop1, cop2);
    // Extra traffic on the parallel road below for depth — keep the Comet's
    // own lane (y=1060) clear so the chase is visibly moving.
    for (let i = 0; i < 6; i++) {
      const t = makeCar(1900 + i * 160, 1460 + (i % 2 === 0 ? -14 : 14), i % 2 === 0 ? 0 : Math.PI, ['#3d7dd9', '#e8b93c', '#5aa864'][i % 3], 'traffic');
      t.speed = 120;
      t.target = { x: 2900, y: 1460 };
      game.cars.push(t);
    }
    // Clear any stray traffic or parked cars out of the Comet GT's lane ahead.
    game.cars = game.cars.filter((c) => !((c.kind === 'traffic' || c.kind === 'parked') && c.x > 1600 && c.y > 990 && c.y < 1140));
    return { autopilot: { throttle: 1, steer: 0 } };
  }

  if (name === 'street') {
    // Rook on foot at a busy downtown crossing, traffic and crowds, first job live.
    game.missions.index = 0;
    startMission(game.missions, game);
    player.x = 1460; player.y = 1460;
    player.onFoot = true;
    player.car = null;
    player.cash = 0;
    for (let i = 0; i < 10; i++) {
      const t = makeCar(1060 + i * 170, 1460 + (i % 2 === 0 ? -16 : 16), i % 2 === 0 ? 0 : Math.PI, ['#d94f3d', '#3d7dd9', '#e8e4da', '#7a5aa8'][i % 4], 'traffic');
      t.speed = 110 + (i % 3) * 30;
      t.target = { x: i % 2 === 0 ? 3000 : 300, y: 1460 };
      game.cars.push(t);
    }
    return { autopilot: null };
  }

  if (name === 'mission') {
    // Job 2: Rook on foot beside the red Comet GT, marker on the car.
    game.missions.index = 1;
    startMission(game.missions, game);
    const comet = makeCar(1660, 1060, Math.PI / 2, '#d41f2a', 'parked');
    comet.isComet = true;
    game.cars.push(comet);
    player.x = 1620; player.y = 1120;
    player.onFoot = true;
    player.car = null;
    player.cash = 500;
    return { autopilot: null };
  }

  return { autopilot: null };
}

export function placeCometCar(game) {
  const comet = makeCar(1660, 1060, Math.PI / 2, '#d41f2a', 'parked');
  comet.isComet = true;
  game.cars.push(comet);
  return comet;
}
