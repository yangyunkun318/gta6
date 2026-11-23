// missions.js — the Solmar Bay story: three jobs from fixer Mama June.
import { addWanted } from './player.js';

export const MISSIONS = [
  {
    id: 'pickup',
    name: 'JOB 1 — THE PICKUP',
    brief: 'Mama June: "Rook, you\'re back. Grab the briefcase at the docks, drop it at the Starlite Motel. No cops, no noise."',
    steps: [
      { id: 'go', text: 'Pick up the briefcase at the docks', x: 900, y: 2240, radius: 70 },
      { id: 'deliver', text: 'Deliver it to the Starlite Motel', x: 2660, y: 660, radius: 80 },
    ],
    reward: 500,
  },
  {
    id: 'hotwheels',
    name: 'JOB 2 — HOT WHEELS',
    brief: 'Mama June: "A Comet GT is parked downtown, cherry red, keys in it. Bring it to the chop shop on the east side. Cops will notice."',
    steps: [
      { id: 'steal', text: 'Steal the red Comet GT downtown', x: 1660, y: 1060, radius: 60, steal: true },
      { id: 'deliver', text: 'Deliver the Comet GT to the chop shop', x: 2960, y: 1860, radius: 90, needCar: true },
    ],
    reward: 900,
  },
  {
    id: 'getaway',
    name: 'JOB 3 — THE GETAWAY',
    brief: 'Mama June: "The crew got pinched. You\'re the only wheel left. Three stars and counting — get to the safehouse on the north side. Don\'t stop."',
    steps: [
      { id: 'escape', text: 'Reach the safehouse — lose the cops or outrun them', x: 660, y: 260, radius: 90, timed: 100 },
    ],
    reward: 1500,
  },
];

export function makeMissionState() {
  return { index: 0, step: 0, done: false, timer: 0, message: '', messageTimer: 0, failed: false };
}

export function currentMission(state) {
  if (state.index >= MISSIONS.length) return null;
  return MISSIONS[state.index];
}

export function currentStep(state) {
  const m = currentMission(state);
  return m ? m.steps[state.step] : null;
}

export function showMessage(state, text, seconds = 4) {
  state.message = text;
  state.messageTimer = seconds;
}

export function startMission(state, game) {
  const m = currentMission(state);
  if (!m) return;
  state.step = 0;
  state.timer = 0;
  showMessage(state, m.brief, 6);
  if (m.id === 'getaway') {
    addWanted(game.player, 3);
    game.player.wantedTimer = 0;
  }
}

export function updateMissions(game, dt) {
  const state = game.missions;
  const player = game.player;
  if (state.messageTimer > 0) state.messageTimer -= dt;
  const m = currentMission(state);
  if (!m || state.done) return;
  const step = currentStep(state);
  if (!step) return;
  if (step.timed) {
    state.timer += dt;
    if (state.timer > step.timed) {
      state.failed = true;
      showMessage(state, 'Too slow — the safehouse went cold. The job is blown.', 5);
      game.player.wanted = 5;
      return;
    }
  }
  const dx = player.x - step.x, dy = player.y - step.y;
  const dist = Math.hypot(dx, dy);
  if (step.steal) {
    // Complete when the player is driving the Comet GT (the red sports car).
    if (!player.onFoot && player.car && player.car.isComet) {
      state.step++;
      showMessage(state, 'Comet GT secured. Now get it to the chop shop, east side.', 4);
    }
    return;
  }
  if (dist < step.radius) {
    if (step.needCar && player.onFoot) return; // must arrive driving
    state.step++;
    if (state.step >= m.steps.length) {
      player.cash += m.reward;
      showMessage(state, `Job done. +$${m.reward} — Mama June is pleased.`, 5);
      game.audio.play('cash');
      state.index++;
      state.step = 0;
      state.timer = 0;
      if (state.index >= MISSIONS.length) {
        state.done = true;
        showMessage(state, 'SOLMAR IS YOURS. All three jobs done — Rook owns this town now.', 8);
      } else {
        startMission(state, game);
      }
      game.saveGame();
    }
  }
}

// The Comet GT: a unique red sports car parked downtown for Job 2.
export function placeComet(city) {
  return { x: 1660, y: 1060, angle: Math.PI / 2 };
}
