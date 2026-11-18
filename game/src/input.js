// Keyboard and pointer input for Sunline District.
// Held keys drive movement; single presses are consumed once by the game loop so a tap can never
// trigger two interactions on a slow frame. The browser's scroll, zoom and spacebar behaviour are
// suppressed only while the game owns the page.

const MOVE_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
]);
const GAME_CODES = new Set([
  ...MOVE_CODES,
  'KeyE', 'ShiftLeft', 'ShiftRight', 'Space',
  'KeyP', 'Escape', 'Enter', 'NumpadEnter', 'KeyR', 'KeyM',
]);

function blankEdges() {
  return {
    interact: false,
    pause: false,
    confirm: false,
    restart: false,
    mute: false,
    pulse: false,
  };
}

export function createInput(canvas) {
  const held = new Set();
  let edges = blankEdges();
  const pointer = { x: 0, y: 0, down: false, inside: false };

  function down(code) {
    return held.has(code);
  }

  function press(code) {
    if (!held.has(code)) {
      held.add(code);
      if (code === 'KeyE') edges.interact = true;
      if (code === 'KeyP' || code === 'Escape') edges.pause = true;
      if (code === 'Enter' || code === 'NumpadEnter') edges.confirm = true;
      if (code === 'KeyR') edges.restart = true;
      if (code === 'KeyM') edges.mute = true;
      // The edge is consumed by the on-foot combat system; held Space still brakes a vehicle.
      if (code === 'Space') edges.pulse = true;
    }
  }

  function release(code) {
    held.delete(code);
  }

  function onKeyDown(event) {
    if (!GAME_CODES.has(event.code)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if (!event.repeat) press(event.code);
    else held.add(event.code);
  }

  function onKeyUp(event) {
    if (!GAME_CODES.has(event.code)) return;
    event.preventDefault();
    release(event.code);
  }

  function positionFrom(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    positionFrom(event);
    pointer.down = true;
    pointer.inside = true;
    canvas.focus?.();
    // A click can start the game, open a door, or grab a package; main decides which applies.
    edges.confirm = true;
    edges.interact = true;
  }

  function onPointerUp(event) {
    positionFrom(event);
    pointer.down = false;
  }

  function onPointerMove(event) {
    positionFrom(event);
    pointer.inside = true;
  }

  function onPointerLeave() {
    pointer.inside = false;
    pointer.down = false;
  }

  function clearHeld() {
    held.clear();
    pointer.down = false;
  }

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp, { passive: false });
  window.addEventListener('blur', clearHeld);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  /** Everything the fixed-step simulation needs for this frame. Edges are cleared by the call. */
  function take() {
    const snapshot = {
      up: down('KeyW') || down('ArrowUp'),
      down: down('KeyS') || down('ArrowDown'),
      left: down('KeyA') || down('ArrowLeft'),
      right: down('KeyD') || down('ArrowRight'),
      sprint: down('ShiftLeft') || down('ShiftRight'),
      brake: down('Space'),
      pointer: pointer.down,
      pressed: edges,
    };
    edges = blankEdges();
    return snapshot;
  }

  /**
   * Merge a frame's unconsumed snapshot into the next one. Used when a high-refresh display has no
   * fixed step this frame: a tap waits for the step it was meant for instead of vanishing.
   */
  function merge(old, next) {
    const pressed = blankEdges();
    for (const key of Object.keys(pressed)) pressed[key] = old.pressed[key] || next.pressed[key];
    return {
      up: old.up || next.up,
      down: old.down || next.down,
      left: old.left || next.left,
      right: old.right || next.right,
      sprint: old.sprint || next.sprint,
      brake: old.brake || next.brake,
      pointer: old.pointer || next.pointer,
      pressed,
    };
  }

  return { take, merge, clearHeld, pointer };
}

export { blankEdges };
