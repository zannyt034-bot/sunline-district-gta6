// Sunline District — boot and the single fixed-step loop.
// One 60 Hz simulation drives the title city, play, pause and the two endings. A hidden tab
// pauses automatically. ?shot=title|play|chase|win stages a real frame; start/complete remain aliases.

import { BEST_KEY, STEP } from './config.js';
import { blankEdges, createInput } from './input.js';
import {
  SCREEN_LOSE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import { createWorld, resetWorld, stepAmbient, stepWorld } from './world.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const world = createWorld(seed);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Private windows have no storage; the best still holds for this visit.
  }
}

function announce(message) {
  if (message) status.textContent = message;
}

function runShot(name) {
  window.__shotReady = false;
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, { best: scene.best });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  window.__sunline = {
    shot: name,
    world,
    screen: scene.screen,
    stage: true,
  };
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let deferred = null;
  world.titlePan = true;

  function startShift() {
    resetWorld(world);
    world.titlePan = false;
    accumulator = 0;
    deferred = null;
    screen = SCREEN_PLAY;
    announce('Shift started at Sunline Dispatch. Find the first pickup.');
  }

  function settleEnd() {
    if (!world.finished) return;
    if (world.player.cash > best) {
      best = world.player.cash;
      saveBest(best);
    }
    screen = world.outcome === 'win' ? SCREEN_WIN : SCREEN_LOSE;
    announce(
      world.outcome === 'win'
        ? `Shift complete. ${world.player.cash} dollars banked.`
        : world.outcome === 'busted'
          ? 'Busted by the patrol.'
          : 'Contract lapsed. The clock ran out.',
    );
  }

  function handleScreen(controls) {
    if (screen === SCREEN_TITLE) {
      if (controls.pressed.confirm) startShift();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (controls.pressed.pause) {
        screen = SCREEN_PAUSED;
        announce('Shift paused. Press P or Escape to resume.');
      } else if (controls.pressed.restart) {
        startShift();
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (controls.pressed.pause || controls.pressed.confirm) {
        screen = SCREEN_PLAY;
        accumulator = 0;
        announce('Back on the clock.');
      } else if (controls.pressed.restart) {
        startShift();
      }
      return;
    }
    if (screen === SCREEN_WIN || screen === SCREEN_LOSE) {
      if (controls.pressed.confirm || controls.pressed.restart) startShift();
    }
  }

  function drainEvents() {
    if (world.events.length === 0) return;
    for (const event of world.events) announce(event.text);
    world.events.length = 0;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += elapsed;

    const next = input.take();
    const controls = deferred ? input.merge(deferred, next) : next;
    deferred = null;
    handleScreen(controls);

    if (screen === SCREEN_PLAY) {
      let stepped = false;
      let stepControls = controls;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepWorld(world, STEP, stepControls);
        stepControls = { ...controls, pressed: blankEdges() };
        accumulator -= STEP;
        stepped = true;
        if (world.finished) {
          settleEnd();
          break;
        }
      }
      if (!stepped && screen === SCREEN_PLAY) {
        deferred = { ...controls, pressed: { ...blankEdges(), interact: controls.pressed.interact, pulse: controls.pressed.pulse } };
      }
      drainEvents();
    } else if (screen === SCREEN_TITLE || screen === SCREEN_PAUSED || screen === SCREEN_WIN || screen === SCREEN_LOSE) {
      if (screen !== SCREEN_PAUSED) stepAmbient(world, Math.min(elapsed, 0.05));
      accumulator = 0;
    }

    renderer.draw(world, screen, { best });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Shift paused while the tab was hidden.');
    }
  });

  window.__sunline = {
    world,
    start: startShift,
    get screen() {
      return screen;
    },
    get best() {
      return best;
    },
  };

  announce('Sunline District. Press Enter or click to start the shift.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
