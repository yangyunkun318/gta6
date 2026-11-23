// input.js — keyboard (WASD/arrows) and mouse aim/fire, with one-shot action flags.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MISSION = 8;

export function createInput(canvas, toWorld) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0; // screen coords
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE' || event.code === 'KeyF') actions |= ACTION_ENTER;
    else if (event.code === 'KeyM') actions |= ACTION_MISSION;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) mouseDown = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys,
    // Driving / walking intent in world space.
    move() {
      return {
        up: keys.has('KeyW') || keys.has('ArrowUp'),
        down: keys.has('KeyS') || keys.has('ArrowDown'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
        sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      };
    },
    // Mouse position converted to world coords by the caller-supplied function.
    mouseWorld() {
      return toWorld ? toWorld(mouseX, mouseY) : { x: mouseX, y: mouseY };
    },
    get fire() { return mouseDown; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
