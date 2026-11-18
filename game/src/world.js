// Sunline District — the living city: generated blocks, props, traffic, patrol routes, missions and
// all collision. The renderer reads this state; nothing here touches the canvas.

import {
  BUILDING_NAMES,
  DEPOT,
  MISSIONS,
  MISSION,
  PALETTE,
  PARKS,
  PATROL,
  PULSE,
  PIERS,
  PLAYER,
  ROADS,
  VEHICLE,
  VEHICLE_TYPES,
  WORLD,
} from './config.js';
import { createRandom } from './random.js';

const TAU = Math.PI * 2;

const BUILDING_STYLES = [
  { base: '#3d4950', roof: '#283238', trim: '#5d6b71', glass: '#6eb6b1' },
  { base: '#4c4642', roof: '#302b29', trim: '#71665d', glass: '#7cc1bb' },
  { base: '#3f4b46', roof: '#28322e', trim: '#63756d', glass: '#7ac8bd' },
  { base: '#4b444e', roof: '#302b34', trim: '#71657a', glass: '#83bdd0' },
  { base: '#514a3e', roof: '#342f27', trim: '#7a6c56', glass: '#c7b97b' },
  { base: '#37434f', roof: '#232c34', trim: '#5a6b7c', glass: '#7fb4c4' },
];

const PED_COLORS = ['#d47f62', '#6f9e8a', '#d7bd79', '#8f79a6', '#b8c4c4', '#4d7d9a', '#c76c86'];

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const between = (rng, low, high) => low + (high - low) * rng();
const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function overlap(a, b, pad = 0) {
  return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= TAU;
  while (angle < -Math.PI) angle += TAU;
  return angle;
}

function turnToward(angle, target, rate) {
  return angle + clamp(normalizeAngle(target - angle), -rate, rate);
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function onPier(world, x, y) {
  for (const pier of world.piers) {
    if (pointInRect(x, y, pier)) return true;
  }
  return false;
}

export function playerPoint(world) {
  const vehicle = currentVehicle(world);
  if (vehicle) return vehicle;
  return world.player;
}

export function currentVehicle(world) {
  if (world.player.inVehicle === null) return null;
  return world.vehicles.find((vehicle) => vehicle.id === world.player.inVehicle) ?? null;
}

export function getObjective(world) {
  if (world.finished) return null;
  const mission = MISSIONS[world.mission.index];
  if (!mission) return null;
  const point = world.mission.phase === 'pickup' ? mission.pickup : mission.drop;
  return {
    x: point.x,
    y: point.y,
    name: point.name,
    hint: point.hint,
    kind: world.mission.phase,
    index: world.mission.index,
    total: MISSIONS.length,
    client: mission.client,
  };
}

export function objectiveDistance(world) {
  const objective = getObjective(world);
  if (!objective) return 0;
  const point = playerPoint(world);
  return dist(point.x, point.y, objective.x, objective.y);
}

export function nearestVehicle(world, maxDistance = 120) {
  if (!world.player.onFoot) return null;
  let best = null;
  let bestDistance = maxDistance;
  for (const vehicle of world.vehicles) {
    if (vehicle.occupied) continue;
    const d = dist(world.player.x, world.player.y, vehicle.x, vehicle.y);
    if (d < bestDistance) {
      best = vehicle;
      bestDistance = d;
    }
  }
  return best ? { vehicle: best, distance: bestDistance } : null;
}

export function interactionState(world) {
  if (world.finished) return null;
  if (!world.player.onFoot) {
    return { kind: 'exit', label: 'E   Step out of the vehicle' };
  }
  const objective = getObjective(world);
  if (objective) {
    const point = playerPoint(world);
    if (dist(point.x, point.y, objective.x, objective.y) <= MISSION.interactRadius) {
      return {
        kind: objective.kind,
        label: objective.kind === 'pickup'
          ? `E   Collect the package at ${objective.name}`
          : `E   Deliver the package to ${objective.name}`,
      };
    }
  }
  const nearby = nearestVehicle(world, VEHICLE.enterRadius);
  if (nearby) {
    return { kind: 'enter', label: `E   Enter ${VEHICLE_TYPES[nearby.vehicle.type].label}` };
  }
  return null;
}

export function isOnRoad(world, x, y) {
  const half = ROADS.width / 2 + 9;
  for (const road of ROADS.vertical) if (Math.abs(x - road) < half) return true;
  for (const road of ROADS.horizontal) if (Math.abs(y - road) < half) return true;
  return false;
}

/** Circle against the city: water, kerbs, buildings and (optionally) parked cars. */
export function blocked(world, x, y, radius, includeCars = false, ignoreVehicle = null) {
  if (x - radius < WORLD.minX || x + radius > WORLD.maxX) return true;
  if (y - radius < WORLD.minY || y + radius > WORLD.maxY) return true;
  if (x > WORLD.shoreX - radius && !onPier(world, x, y)) return true;
  for (const building of world.buildings) {
    const cx = clamp(x, building.x, building.x + building.w);
    const cy = clamp(y, building.y, building.y + building.h);
    if ((x - cx) ** 2 + (y - cy) ** 2 < radius * radius) return true;
  }
  if (includeCars) {
    for (const vehicle of world.vehicles) {
      if (vehicle.occupied || vehicle.id === ignoreVehicle) continue;
      if ((x - vehicle.x) ** 2 + (y - vehicle.y) ** 2 < (radius + 22) ** 2) return true;
    }
  }
  return false;
}

function slide(world, entity, dx, dy, radius, includeCars = false) {
  let hit = false;
  if (!blocked(world, entity.x + dx, entity.y, radius, includeCars)) entity.x += dx;
  else hit = true;
  if (!blocked(world, entity.x, entity.y + dy, radius, includeCars)) entity.y += dy;
  else hit = true;
  return hit;
}

function lineBlocked(world, ax, ay, bx, by) {
  const length = Math.hypot(bx - ax, by - ay);
  const steps = Math.min(26, Math.ceil(length / 46));
  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const building of world.buildings) {
      if (x > building.x && x < building.x + building.w && y > building.y && y < building.y + building.h) return true;
    }
  }
  return false;
}

function pushEvent(world, type, text) {
  world.events.push({ type, text, time: world.elapsed });
  if (world.events.length > 24) world.events.shift();
}

export function toast(world, text, tone = 'info', duration = 4.2) {
  world.toasts.push({ text, tone, life: duration, maxLife: duration });
  if (world.toasts.length > 4) world.toasts.shift();
}

function burst(world, x, y, color, count = 12, speed = 120) {
  for (let index = 0; index < count; index += 1) {
    const angle = world.rng() * TAU;
    const velocity = between(world.rng, speed * 0.25, speed);
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: between(world.rng, 0.35, 0.9),
      maxLife: 0.9,
      size: between(world.rng, 1.5, 4),
      color,
    });
  }
  if (world.particles.length > 240) world.particles.splice(0, world.particles.length - 240);
}

// ----------------------------------------------------------------------------- generation

function addBuilding(world, rect, style, name, sign, signColor) {
  const building = {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    style,
    name,
    sign: sign ?? '',
    signColor: signColor ?? PALETTE.amber,
    detail: Math.floor(world.rng() * 1000),
  };
  world.buildings.push(building);
  return building;
}

function reserved(world, rect) {
  for (const area of world.reserved) {
    if (overlap(rect, area, 6)) return true;
  }
  return false;
}

function buildBlocks(world) {
  const xs = [0, ...ROADS.vertical];
  const ys = [0, ...ROADS.horizontal, WORLD.height];
  const edgePad = 24;
  for (let ix = 0; ix < xs.length - 1; ix += 1) {
    for (let iy = 0; iy < ys.length - 1; iy += 1) {
      const left = ix === 0 ? edgePad : xs[ix] + ROADS.width / 2 + ROADS.sidewalk + 8;
      const right = xs[ix + 1] - ROADS.width / 2 - ROADS.sidewalk - 8;
      const top = iy === 0 ? edgePad : ys[iy] + ROADS.width / 2 + ROADS.sidewalk + 8;
      const bottom = iy === ys.length - 2 ? WORLD.height - edgePad : ys[iy + 1] - ROADS.width / 2 - ROADS.sidewalk - 8;
      const cell = { x: left, y: top, w: right - left, h: bottom - top };
      if (cell.w < 76 || cell.h < 76) continue;
      if (PARKS.some((park) => overlap(cell, park, -8))) continue;

      if (world.rng() < 0.075 && cell.w > 130 && cell.h > 120) {
        world.lots.push({
          x: cell.x,
          y: cell.y,
          w: cell.w,
          h: cell.h,
          label: pick(world.rng, ['PARKING', 'LOADING', 'RESERVED']),
        });
        continue;
      }

      const cols = cell.w > 250 && world.rng() < 0.62 ? 2 : 1;
      const rows = cell.h > 250 && world.rng() < 0.58 ? 2 : 1;
      const gap = 14;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const subW = cell.w / cols;
          const subH = cell.h / rows;
          const inset = between(world.rng, 0, 9);
          const rect = {
            x: cell.x + cx * subW + gap / 2 + inset,
            y: cell.y + cy * subH + gap / 2 + inset,
            w: subW - gap - inset * 2,
            h: subH - gap - inset * 2,
          };
          if (rect.w < 42 || rect.h < 42) continue;
          if (reserved(world, rect)) continue;
          const style = pick(world.rng, BUILDING_STYLES);
          const name = BUILDING_NAMES[world.nameIndex % BUILDING_NAMES.length];
          world.nameIndex += 1;
          const signed = world.rng() < 0.55;
          addBuilding(
            world,
            rect,
            style,
            name,
            signed ? name.toUpperCase() : '',
            pick(world.rng, [PALETTE.amber, PALETTE.teal, PALETTE.neon, '#9fd8ff']),
          );
        }
      }
    }
  }
}

function addLandmarks(world) {
  const style = (base, roof, trim, glass) => ({ base, roof, trim, glass });
  addBuilding(
    world,
    { x: 388, y: 1140, w: 254, h: 102 },
    style('#4b5148', '#30362f', '#78806c', '#e9c26c'),
    'Sunline Dispatch',
    'SUNLINE DISPATCH',
    PALETTE.amber,
  );
  addBuilding(
    world,
    { x: 1224, y: 356, w: 340, h: 190 },
    style('#4b3f50', '#302837', '#7b647f', '#ff8aab'),
    'Neon Arcade',
    'NEON ARCADE',
    PALETTE.neon,
  );
  addBuilding(
    world,
    { x: 788, y: 1662, w: 252, h: 140 },
    style('#4a4740', '#302e28', '#7d7460', '#cfe0d3'),
    'Bellview Radio',
    'BELLVIEW RADIO',
    '#9fd8ff',
  );
  addBuilding(
    world,
    { x: 1202, y: 800, w: 338, h: 180 },
    style('#3f4a50', '#273238', '#687780', '#b8d5d2'),
    'Civic Archive',
    'CIVIC ARCHIVE',
    PALETTE.teal,
  );
  addBuilding(
    world,
    { x: 2570, y: 892, w: 66, h: 126 },
    style('#40514d', '#293632', '#71857d', '#8fd2c8'),
    'Marina Cold Store',
    'COLD STORE',
    '#a7e8e0',
  );
}

function addParks(world) {
  for (const park of PARKS) {
    world.parks.push({ ...park });
    world.fountains.push({
      x: park.x + park.w / 2,
      y: park.y + park.h / 2,
      radius: Math.min(park.w, park.h) * 0.16,
    });
    for (let index = 0; index < 9; index += 1) {
      const x = between(world.rng, park.x + 18, park.x + park.w - 18);
      const y = between(world.rng, park.y + 18, park.y + park.h - 18);
      if (dist(x, y, park.x + park.w / 2, park.y + park.h / 2) < 48) continue;
      world.trees.push({ x, y, r: between(world.rng, 13, 22), kind: 'broad', tint: Math.floor(world.rng() * 3) });
    }
  }
}

function addCityProps(world) {
  for (const x of ROADS.vertical) {
    for (const y of ROADS.horizontal) {
      world.lamps.push({ x: x + 56, y: y + 56 });
      if ((x + y) % 3 === 0) world.lamps.push({ x: x - 56, y: y - 56 });
    }
  }
  for (let y = 120; y < WORLD.height - 100; y += 112) {
    const nearPier = PIERS.some((pier) => y > pier.y - 44 && y < pier.y + pier.h + 44);
    if (!nearPier) world.trees.push({ x: 2612, y, r: between(world.rng, 16, 23), kind: 'palm', tint: Math.floor(world.rng() * 3) });
    if (y % 224 < 112) world.umbrellas.push({ x: 2722, y: y + 32 });
  }
  // Depot apron: a few painted bays around the courier van.
  world.lots.push({ x: 362, y: 1258, w: 286, h: 156, label: 'SUNLINE DISPATCH' });
}

function spawnVehicle(world, type, x, y, angle, occupied = false) {
  const spec = VEHICLE_TYPES[type];
  const vehicle = {
    id: world.nextVehicleId,
    type,
    x,
    y,
    angle,
    speed: 0,
    occupied,
    color: pick(world.rng, spec.paint),
  };
  world.nextVehicleId += 1;
  world.vehicles.push(vehicle);
  return vehicle;
}

function addVehicles(world) {
  spawnVehicle(world, 'courier', 402, 1368, 0, false);
  const types = ['sedan', 'sport', 'taxi', 'sedan', 'van', 'taxi', 'sport', 'sedan', 'van', 'taxi', 'sport'];
  let attempts = 0;
  while (world.vehicles.length < 13 && attempts < 120) {
    attempts += 1;
    const vertical = world.rng() < 0.56;
    let x;
    let y;
    let angle;
    if (vertical) {
      const road = pick(world.rng, ROADS.vertical);
      x = road + (world.rng() < 0.5 ? -50 : 50);
      y = between(world.rng, 100, WORLD.height - 100);
      angle = Math.PI / 2;
    } else {
      const road = pick(world.rng, ROADS.horizontal);
      y = road + (world.rng() < 0.5 ? -50 : 50);
      x = between(world.rng, 100, 2520);
      angle = 0;
    }
    if (blocked(world, x, y, 28)) continue;
    if (world.vehicles.some((vehicle) => dist(x, y, vehicle.x, vehicle.y) < 78)) continue;
    if (MISSIONS.some((mission) => dist(x, y, mission.pickup.x, mission.pickup.y) < 100 || dist(x, y, mission.drop.x, mission.drop.y) < 100)) continue;
    spawnVehicle(world, pick(world.rng, types), x, y, angle + (world.rng() < 0.5 ? 0 : Math.PI));
  }
}

function addPedestrians(world) {
  for (let index = 0; index < 26; index += 1) {
    let x = 0;
    let y = 0;
    let found = false;
    for (let attempt = 0; attempt < 40 && !found; attempt += 1) {
      if (world.rng() < 0.7) {
        const vertical = world.rng() < 0.5;
        if (vertical) x = pick(world.rng, ROADS.vertical) + (world.rng() < 0.5 ? -55 : 55);
        else x = between(world.rng, 80, 2500);
        if (vertical) y = between(world.rng, 90, WORLD.height - 90);
        else y = pick(world.rng, ROADS.horizontal) + (world.rng() < 0.5 ? -55 : 55);
      } else {
        x = between(world.rng, 160, 2580);
        y = between(world.rng, 80, 2320);
      }
      if (!blocked(world, x, y, 10)) found = true;
    }
    if (!found) continue;
    world.pedestrians.push({
      x,
      y,
      angle: world.rng() * TAU,
      speed: between(world.rng, 24, 46),
      baseSpeed: 0,
      color: pick(world.rng, PED_COLORS),
      phase: world.rng() * TAU,
      wander: between(world.rng, 1.4, 4.4),
    });
    const ped = world.pedestrians[world.pedestrians.length - 1];
    ped.baseSpeed = ped.speed;
  }
}

function adjacentNode(world, node) {
  const ix = node.ix;
  const iy = node.iy;
  const options = [];
  if (ix > 0) options.push(world.nodeAt(ix - 1, iy));
  if (ix < ROADS.vertical.length - 1) options.push(world.nodeAt(ix + 1, iy));
  if (iy > 0) options.push(world.nodeAt(ix, iy - 1));
  if (iy < ROADS.horizontal.length - 1) options.push(world.nodeAt(ix, iy + 1));
  return options.length ? pick(world.rng, options) : node;
}

function spawnPatrol(world, index) {
  const ix = Math.floor(world.rng() * ROADS.vertical.length);
  const iy = Math.floor(world.rng() * ROADS.horizontal.length);
  const node = world.nodeAt(ix, iy);
  const next = adjacentNode(world, node);
  const patrol = {
    id: index,
    x: node.x + between(world.rng, -24, 24),
    y: node.y + between(world.rng, -24, 24),
    angle: world.rng() * TAU,
    speed: 0,
    mode: 'patrol',
    active: false,
    node,
    target: next,
    memory: 0,
    siren: world.rng() * TAU,
    contact: 0,
    stun: 0,
  };
  world.patrols.push(patrol);
}

function spawnCop(world) {
  const point = playerPoint(world);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const angle = world.rng() * TAU;
    const radius = between(world.rng, 380, 660);
    const x = point.x + Math.cos(angle) * radius;
    const y = point.y + Math.sin(angle) * radius;
    if (x < 60 || x > WORLD.shoreX - 20 || y < 60 || y > WORLD.height - 60) continue;
    if (blocked(world, x, y, 10)) continue;
    world.cops.push({
      x,
      y,
      angle: angle + Math.PI,
      speed: 0,
      phase: world.rng() * TAU,
      contact: 0,
      stun: 0,
    });
    return;
  }
}

// ----------------------------------------------------------------------------- lifecycle

export function resetWorld(world) {
  const seed = world.seed;
  world.rng = createRandom(seed);
  world.time = 0;
  world.elapsed = 0;
  world.nameIndex = Math.floor(world.rng() * BUILDING_NAMES.length);
  world.nextVehicleId = 1;
  world.buildings = [];
  world.reserved = [];
  world.lots = [];
  world.parks = [];
  world.fountains = [];
  world.trees = [];
  world.lamps = [];
  world.umbrellas = [];
  world.piers = PIERS.map((pier) => ({ ...pier }));
  world.vehicles = [];
  world.patrols = [];
  world.cops = [];
  world.pedestrians = [];
  world.particles = [];
  world.pulseVisual = null;
  world.toasts = [];
  world.events = [];
  world.titlePan = false;

  world.reserved.push({ x: 348, y: 1104, w: 336, h: 322 });
  for (const mission of MISSIONS) {
    for (const point of [mission.pickup, mission.drop]) {
      world.reserved.push({ x: point.x - 106, y: point.y - 106, w: 212, h: 212 });
    }
  }

  world.nodes = [];
  world.nodeAt = (ix, iy) => world.nodes[iy * ROADS.vertical.length + ix];
  for (let iy = 0; iy < ROADS.horizontal.length; iy += 1) {
    for (let ix = 0; ix < ROADS.vertical.length; ix += 1) {
      world.nodes.push({ x: ROADS.vertical[ix], y: ROADS.horizontal[iy], ix, iy });
    }
  }

  buildBlocks(world);
  addLandmarks(world);
  addParks(world);
  addCityProps(world);
  addVehicles(world);
  addPedestrians(world);
  for (let index = 0; index < PATROL.maxUnits; index += 1) spawnPatrol(world, index);

  world.player = {
    x: 500,
    y: 1318,
    angle: 0,
    health: PLAYER.maxHealth,
    stamina: PLAYER.staminaMax,
    cash: 240,
    onFoot: true,
    inVehicle: null,
    hurtFlash: 0,
    invuln: 0,
    noDamage: 10,
    walkPhase: 0,
    speed: 0,
    pulseCooldown: 0,
  };

  world.mission = {
    index: 0,
    phase: 'pickup',
    timer: MISSIONS[0].deadline,
    deadline: MISSIONS[0].deadline,
    warned: false,
    cargo: false,
    lastReward: 0,
  };
  world.wanted = 0;
  world.lastWanted = 0;
  world.suspicion = 0;
  world.peakHeat = 0;
  world.shake = 0;
  world.flash = 0;
  world.finished = false;
  world.outcome = null;
  world.camera = { x: 500, y: 1318, zoom: 1 };
  world.stats = { deliveries: 0, cashEarned: 0, time: 0, peakHeat: 0, nearMisses: 0 };
  world.lastMissionToast = 0;

  for (let index = 0; index < 2; index += 1) {
    world.patrols[index].active = true;
  }
  pushEvent(world, 'start', 'Shift started at Sunline Dispatch.');
  toast(world, 'Shift started. Find your first pickup.', 'info', 5);
}

export function createWorld(seed) {
  const world = { seed: seed | 0 };
  resetWorld(world);
  return world;
}

// ----------------------------------------------------------------------------- simulation

function updateToasts(world, dt) {
  for (const toastItem of world.toasts) toastItem.life -= dt;
  world.toasts = world.toasts.filter((toastItem) => toastItem.life > 0);
  world.player.pulseCooldown = Math.max(0, world.player.pulseCooldown - dt);
  world.shake = Math.max(0, world.shake - dt * 2.2);
  world.flash = Math.max(0, world.flash - dt * 2.6);
  world.player.hurtFlash = Math.max(0, world.player.hurtFlash - dt * 2.4);
  world.player.invuln = Math.max(0, world.player.invuln - dt);
}

function updateParticles(world, dt) {
  for (const particle of world.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - 3.4 * dt;
    particle.vy *= 1 - 3.4 * dt;
    particle.life -= dt;
  }
  world.particles = world.particles.filter((particle) => particle.life > 0);
  if (world.pulseVisual) {
    world.pulseVisual.life -= dt;
    if (world.pulseVisual.life <= 0) world.pulseVisual = null;
  }
}

function updatePeds(world, dt) {
  const point = playerPoint(world);
  const frightened = world.wanted >= 2;
  for (const ped of world.pedestrians) {
    ped.phase += dt * 2.6;
    const d = dist(ped.x, ped.y, point.x, point.y);
    let speed = ped.baseSpeed;
    let desired = ped.angle;
    if (frightened && d < 250) {
      speed = 76;
      desired = Math.atan2(ped.y - point.y, ped.x - point.x);
    } else {
      ped.wander -= dt;
      if (ped.wander <= 0) {
        ped.wander = between(world.rng, 1.5, 4.8);
        ped.angle += between(world.rng, -1.8, 1.8);
      }
    }
    ped.angle = turnToward(ped.angle, desired, dt * 2.4);
    const dx = Math.cos(ped.angle) * speed * dt;
    const dy = Math.sin(ped.angle) * speed * dt;
    if (!blocked(world, ped.x + dx, ped.y, 8) && !blocked(world, ped.x, ped.y + dy, 8)) {
      ped.x += dx;
      ped.y += dy;
    } else {
      ped.angle += between(world.rng, 1.4, 2.6);
    }
  }
}

export function stepAmbient(world, dt) {
  world.time += dt;
  updateToasts(world, dt);
  updateParticles(world, dt);
  updatePeds(world, dt);
  if (world.titlePan) {
    world.camera.x = 1550 + Math.sin(world.time * 0.035) * 190;
    world.camera.y = 1160 + Math.cos(world.time * 0.024) * 95;
  }
}

function updateOnFoot(world, controls, dt) {
  const player = world.player;
  let x = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
  let y = (controls.down ? 1 : 0) - (controls.up ? 1 : 0);
  const length = Math.hypot(x, y);
  if (length > 0) {
    x /= length;
    y /= length;
    player.angle = turnToward(player.angle, Math.atan2(y, x), dt * 11);
  }
  const sprinting = controls.sprint && length > 0 && player.stamina > 2;
  const speed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  player.speed = length > 0 ? speed : 0;
  if (sprinting) player.stamina = Math.max(0, player.stamina - PLAYER.staminaDrain * dt);
  else player.stamina = Math.min(PLAYER.staminaMax, player.stamina + PLAYER.staminaRegen * dt);
  player.walkPhase += speed * dt * 0.09;
  const dx = x * speed * dt;
  const dy = y * speed * dt;
  const hit = slide(world, player, dx, dy, PLAYER.radius, true);
  if (hit && length > 0) {
    // Nudge around furniture instead of stopping dead against a corner.
    if (!blocked(world, player.x + dy * 0.55, player.y, PLAYER.radius, true)) player.x += dy * 0.55;
    else if (!blocked(world, player.x, player.y - dx * 0.55, PLAYER.radius, true)) player.y -= dx * 0.55;
  }
  if (player.noDamage > 0) player.noDamage -= dt;
  else player.health = Math.min(PLAYER.maxHealth, player.health + PLAYER.regenRate * dt);
}

function updateVehiclePhysics(world, vehicle, controls, dt) {
  const spec = VEHICLE_TYPES[vehicle.type];
  const grip = isOnRoad(world, vehicle.x, vehicle.y) ? 1 : VEHICLE.offRoadGrip;
  const forward = controls.up;
  const back = controls.down;
  const handbrake = controls.brake;
  const steer = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);

  if (forward && !back) vehicle.speed += spec.accel * grip * dt;
  else if (back) {
    if (vehicle.speed > 12) vehicle.speed -= spec.brake * dt;
    else vehicle.speed -= spec.accel * 0.52 * dt;
  } else {
    vehicle.speed *= 1 - spec.drag * dt * (isOnRoad(world, vehicle.x, vehicle.y) ? 1 : 1.9);
  }
  if (handbrake) {
    vehicle.speed *= 1 - 2.6 * dt;
    vehicle.speed -= Math.sign(vehicle.speed) * Math.min(Math.abs(vehicle.speed), 80 * dt);
  }
  const maxForward = spec.maxSpeed * (0.54 + grip * 0.46);
  vehicle.speed = clamp(vehicle.speed, -spec.reverseSpeed, maxForward);
  if (Math.abs(vehicle.speed) < 1.2 && !forward && !back) vehicle.speed = 0;

  if (Math.abs(vehicle.speed) > 7 && steer !== 0) {
    const turnRate = spec.turn * clamp(Math.abs(vehicle.speed) / 150, 0.18, 1);
    vehicle.angle += steer * turnRate * dt * Math.sign(vehicle.speed) * (handbrake ? 1.18 : 1);
  }
  vehicle.angle = normalizeAngle(vehicle.angle);

  const dx = Math.cos(vehicle.angle) * vehicle.speed * dt;
  const dy = Math.sin(vehicle.angle) * vehicle.speed * dt;
  const before = vehicle.speed;
  const hit = slide(world, vehicle, dx, dy, VEHICLE.collisionRadius, false);
  if (hit) {
    vehicle.speed = -before * 0.16;
    world.shake = Math.max(world.shake, Math.min(1, Math.abs(before) / 380));
    if (Math.abs(before) > 120) {
      burst(world, vehicle.x + Math.cos(vehicle.angle) * 20, vehicle.y + Math.sin(vehicle.angle) * 20, '#f6c672', 7, 90);
    }
  }
  world.player.x = vehicle.x;
  world.player.y = vehicle.y;
  world.player.angle = vehicle.angle;
  world.player.speed = vehicle.speed;
  world.player.walkPhase = 0;
}

function enterVehicle(world, vehicle) {
  vehicle.occupied = true;
  world.player.inVehicle = vehicle.id;
  world.player.onFoot = false;
  world.player.x = vehicle.x;
  world.player.y = vehicle.y;
  vehicle.speed = 0;
  toast(world, `Engine running · ${VEHICLE_TYPES[vehicle.type].label}`, 'info', 2.4);
  pushEvent(world, 'vehicle', `Entered ${VEHICLE_TYPES[vehicle.type].label}.`);
}

function leaveVehicle(world) {
  const vehicle = currentVehicle(world);
  if (!vehicle) return false;
  const side = { x: -Math.sin(vehicle.angle), y: Math.cos(vehicle.angle) };
  const forward = { x: Math.cos(vehicle.angle), y: Math.sin(vehicle.angle) };
  const candidates = [
    { x: vehicle.x + side.x * VEHICLE.exitOffset, y: vehicle.y + side.y * VEHICLE.exitOffset },
    { x: vehicle.x - side.x * VEHICLE.exitOffset, y: vehicle.y - side.y * VEHICLE.exitOffset },
    { x: vehicle.x - forward.x * (VEHICLE.exitOffset + 10), y: vehicle.y - forward.y * (VEHICLE.exitOffset + 10) },
  ];
  for (const spot of candidates) {
    if (!blocked(world, spot.x, spot.y, PLAYER.radius, true, vehicle.id)) {
      vehicle.occupied = false;
      vehicle.speed = 0;
      world.player.inVehicle = null;
      world.player.onFoot = true;
      world.player.x = spot.x;
      world.player.y = spot.y;
      world.player.angle = vehicle.angle + Math.PI / 2;
      world.player.speed = 0;
      toast(world, 'On foot.', 'info', 1.6);
      pushEvent(world, 'vehicle', 'Stepped out of the vehicle.');
      return true;
    }
  }
  toast(world, 'No room to step out here.', 'warn', 2.2);
  return false;
}

function collectPackage(world) {
  const mission = MISSIONS[world.mission.index];
  world.mission.phase = 'deliver';
  world.mission.cargo = true;
  world.mission.timer += 12;
  world.mission.warned = false;
  world.player.cash += 40;
  burst(world, mission.pickup.x, mission.pickup.y, PALETTE.teal, 22, 160);
  toast(world, `Package secured · +12 seconds · deliver to ${mission.drop.name}`, 'good', 5);
  pushEvent(world, 'pickup', `Package secured at ${mission.pickup.name}. Deliver it to ${mission.drop.name}.`);
}

function deliverPackage(world) {
  const mission = MISSIONS[world.mission.index];
  const bonus = Math.max(0, Math.floor(world.mission.timer)) * 2;
  const reward = mission.reward + bonus;
  world.player.cash += reward;
  world.stats.cashEarned += reward;
  world.stats.deliveries += 1;
  world.mission.lastReward = reward;
  burst(world, mission.drop.x, mission.drop.y, PALETTE.amber, 28, 190);
  world.flash = 0.45;
  if (world.mission.index >= MISSIONS.length - 1) {
    pushEvent(world, 'delivery', `Final delivery complete. $${reward} collected.`);
    finish(world, 'win');
    return;
  }
  toast(world, `Delivered · $${reward} · new contract incoming`, 'good', 5);
  pushEvent(world, 'delivery', `Delivery complete. Earned $${reward}.`);
  world.mission.index += 1;
  world.mission.phase = 'pickup';
  world.mission.cargo = false;
  world.mission.timer = MISSIONS[world.mission.index].deadline;
  world.mission.deadline = MISSIONS[world.mission.index].deadline;
  world.mission.warned = false;
  world.lastMissionToast = world.elapsed;
  toast(world, `Contract ${world.mission.index + 1}/${MISSIONS.length} · ${MISSIONS[world.mission.index].pickup.name}`, 'info', 5.2);
  pushEvent(world, 'mission', `New contract: collect from ${MISSIONS[world.mission.index].pickup.name}.`);
}

function handleInteract(world) {
  if (!world.player.onFoot) {
    leaveVehicle(world);
    return;
  }
  const objective = getObjective(world);
  const point = playerPoint(world);
  if (objective && dist(point.x, point.y, objective.x, objective.y) <= MISSION.interactRadius) {
    if (world.mission.phase === 'pickup') collectPackage(world);
    else deliverPackage(world);
    return;
  }
  const nearby = nearestVehicle(world, VEHICLE.enterRadius);
  if (nearby) enterVehicle(world, nearby.vehicle);
}

function hurtPlayer(world, amount, source) {
  const player = world.player;
  if (player.invuln > 0 || world.finished) return;
  player.health = Math.max(0, player.health - amount);
  player.invuln = PLAYER.hurtInvuln;
  player.noDamage = PLAYER.regenDelay;
  player.hurtFlash = 1;
  world.shake = Math.max(world.shake, 0.7);
  burst(world, player.x, player.y, PALETTE.danger, 8, 110);
  pushEvent(world, 'damage', `${source} hit you. ${Math.ceil(player.health)} health left.`);
  if (player.health <= 0) finish(world, 'busted');
}

function insidePulse(world, target) {
  const player = world.player;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  if (Math.hypot(dx, dy) > PULSE.range) return false;
  const bearing = Math.atan2(dy, dx);
  if (Math.abs(normalizeAngle(bearing - player.angle)) > PULSE.halfAngle) return false;
  return !lineBlocked(world, player.x, player.y, target.x, target.y);
}

function usePulse(world) {
  const player = world.player;
  if (!player.onFoot || player.pulseCooldown > 0) return;
  player.pulseCooldown = PULSE.cooldown;
  world.pulseVisual = {
    x: player.x,
    y: player.y,
    angle: player.angle,
    range: PULSE.range,
    halfAngle: PULSE.halfAngle,
    life: 0.58,
    maxLife: 0.58,
  };
  burst(world, player.x + Math.cos(player.angle) * 15, player.y + Math.sin(player.angle) * 15, PALETTE.teal, 18, 190);

  let disabled = 0;
  for (const cop of world.cops) {
    if (disabled >= PULSE.maxTargets) break;
    if (cop.stun > 0 || !insidePulse(world, cop)) continue;
    cop.stun = PULSE.stunSeconds;
    cop.contact = 0;
    disabled += 1;
    burst(world, cop.x, cop.y, PALETTE.teal, 12, 130);
  }
  for (const patrol of world.patrols) {
    if (disabled >= PULSE.maxTargets) break;
    if (!patrol.active || patrol.mode !== 'chase' || patrol.stun > 0 || !insidePulse(world, patrol)) continue;
    patrol.stun = PULSE.stunSeconds;
    patrol.speed = 0;
    patrol.contact = 0;
    disabled += 1;
    burst(world, patrol.x, patrol.y, PALETTE.teal, 16, 150);
  }
  const message = disabled
    ? `FLARE PULSE · ${disabled} pursuer${disabled === 1 ? '' : 's'} stunned`
    : 'FLARE PULSE · no pursuers in the beam';
  toast(world, message, disabled ? 'good' : 'info', 2.8);
  pushEvent(world, 'pulse', disabled ? `Flare pulse stunned ${disabled} pursuer(s).` : 'Flare pulse sent; no pursuer was in range.');
}

function finish(world, outcome) {
  if (world.finished) return;
  world.finished = true;
  world.outcome = outcome;
  world.stats.time = world.elapsed;
  world.stats.cashEarned = world.player.cash - 240;
  world.stats.peakHeat = world.peakHeat;
  world.shake = outcome === 'win' ? 0.15 : 0.9;
  world.flash = outcome === 'win' ? 0.65 : 0.25;
  if (outcome === 'win') {
    toast(world, 'Shift complete. The coast is quiet.', 'good', 8);
    pushEvent(world, 'win', `Shift complete. $${world.player.cash} banked.`);
  } else if (outcome === 'busted') {
    toast(world, 'Busted. The patrol closed in.', 'bad', 8);
    pushEvent(world, 'lose', 'Busted by the patrol.');
  } else {
    toast(world, 'Contract lapsed. The clock ran out.', 'bad', 8);
    pushEvent(world, 'lose', 'Contract lapsed.');
  }
}

function activatePatrol(world, patrol) {
  const point = playerPoint(world);
  let bestNode = world.nodes[0];
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const node = pick(world.rng, world.nodes);
    const d = dist(node.x, node.y, point.x, point.y);
    if (d > bestScore) {
      bestScore = d;
      bestNode = node;
    }
  }
  patrol.x = bestNode.x + between(world.rng, -18, 18);
  patrol.y = bestNode.y + between(world.rng, -18, 18);
  patrol.node = bestNode;
  patrol.target = adjacentNode(world, bestNode);
  patrol.mode = 'patrol';
  patrol.speed = 0;
  patrol.active = true;
}

function updateHeat(world, dt) {
  const point = playerPoint(world);
  const carrying = world.mission.phase === 'deliver';
  const base = world.mission.index + (carrying ? 1 : 0);
  let seen = false;
  for (const patrol of world.patrols) {
    if (!patrol.active) continue;
    const range = PATROL.detectBase + world.wanted * PATROL.detectPerStar + (carrying ? 70 : 0);
    if (dist(patrol.x, patrol.y, point.x, point.y) < range && !lineBlocked(world, patrol.x, patrol.y, point.x, point.y)) {
      seen = true;
      break;
    }
  }
  if (!seen) {
    for (const cop of world.cops) {
      if (dist(cop.x, cop.y, point.x, point.y) < 440) {
        seen = true;
        break;
      }
    }
  }
  if (seen && (carrying || base > 0)) world.suspicion = Math.min(100, world.suspicion + dt * 26);
  else world.suspicion = Math.max(0, world.suspicion - dt * (world.wanted > 0 ? 10 : 18));

  let wanted = Math.min(5, base + Math.floor(world.suspicion / 34));
  if (base === 0 && !carrying) wanted = 0;
  if (wanted > world.wanted) {
    world.suspicion = Math.max(world.suspicion, 12);
  }
  world.wanted = wanted;
  world.peakHeat = Math.max(world.peakHeat, wanted);

  const desired = Math.min(PATROL.maxUnits, 2 + wanted);
  for (let index = 0; index < world.patrols.length; index += 1) {
    const patrol = world.patrols[index];
    if (index < desired && !patrol.active) activatePatrol(world, patrol);
    else if (index >= desired && patrol.active && dist(patrol.x, patrol.y, point.x, point.y) > 950) {
      patrol.active = false;
    }
  }

  const desiredCops = Math.min(5, Math.max(0, wanted - 1));
  if (world.cops.length < desiredCops) spawnCop(world);
  if (wanted === 0 && world.cops.length > 0) world.cops.length = 0;

  if (world.wanted !== world.lastWanted) {
    if (world.wanted > world.lastWanted) {
      toast(world, `Patrol heat rising · ${world.wanted}/5`, 'warn', 3.6);
      pushEvent(world, 'heat', `Patrol heat is now ${world.wanted} of 5.`);
    } else if (world.wanted > 0) {
      toast(world, 'Heat falling · keep out of sight', 'info', 2.8);
    }
    world.lastWanted = world.wanted;
  }
}

function updatePatrols(world, dt) {
  const point = playerPoint(world);
  for (const patrol of world.patrols) {
    if (!patrol.active) continue;
    patrol.siren += dt * 4.5;
    patrol.stun = Math.max(0, (patrol.stun ?? 0) - dt);
    if (patrol.stun > 0) {
      patrol.speed = 0;
      patrol.contact = 0;
      continue;
    }
    const d = dist(patrol.x, patrol.y, point.x, point.y);
    const range = PATROL.detectBase + world.wanted * PATROL.detectPerStar + 60;
    const canSee = d < range && !lineBlocked(world, patrol.x, patrol.y, point.x, point.y);
    if (canSee || (world.wanted >= 2 && d < 1050)) {
      patrol.mode = 'chase';
      patrol.memory = 4.2;
    } else if (patrol.mode === 'chase') {
      patrol.memory -= dt;
      if (patrol.memory <= 0) {
        patrol.mode = 'patrol';
        patrol.node = world.nodes.reduce((best, node) => {
          const nd = dist(node.x, node.y, patrol.x, patrol.y);
          const bd = dist(best.x, best.y, patrol.x, patrol.y);
          return nd < bd ? node : best;
        }, world.nodes[0]);
        patrol.target = adjacentNode(world, patrol.node);
      }
    }

    let desiredAngle;
    let targetSpeed;
    if (patrol.mode === 'chase') {
      const lead = 0.24;
      const targetX = point.x + (point.vx ?? 0) * lead;
      const targetY = point.y + (point.vy ?? 0) * lead;
      desiredAngle = Math.atan2(targetY - patrol.y, targetX - patrol.x);
      targetSpeed = PATROL.baseChaseSpeed + world.wanted * PATROL.chaseSpeedPerStar;
    } else {
      if (dist(patrol.x, patrol.y, patrol.target.x, patrol.target.y) < 42) {
        patrol.node = patrol.target;
        patrol.target = adjacentNode(world, patrol.node);
      }
      desiredAngle = Math.atan2(patrol.target.y - patrol.y, patrol.target.x - patrol.x);
      targetSpeed = PATROL.patrolSpeed;
    }

    patrol.angle = turnToward(patrol.angle, desiredAngle, dt * (patrol.mode === 'chase' ? 2.7 : 1.8));
    const acceleration = patrol.mode === 'chase' ? 310 : 190;
    const delta = targetSpeed - patrol.speed;
    patrol.speed += clamp(delta, -acceleration * dt, acceleration * dt);
    const dx = Math.cos(patrol.angle) * patrol.speed * dt;
    const dy = Math.sin(patrol.angle) * patrol.speed * dt;
    const hit = slide(world, patrol, dx, dy, PATROL.radius, false);
    if (hit) {
      patrol.speed *= 0.34;
      if (patrol.mode === 'patrol') patrol.target = adjacentNode(world, patrol.node ?? world.nodes[0]);
      patrol.angle += between(world.rng, -0.8, 0.8);
    }
    patrol.contact = Math.max(0, patrol.contact - dt);
    if (d < PATROL.contactRange && patrol.contact <= 0 && !world.finished) {
      patrol.contact = 0.7;
      hurtPlayer(world, PATROL.carDamage, 'A patrol car');
      world.shake = Math.max(world.shake, 1);
    }
  }
}

function updateCops(world, dt) {
  const point = playerPoint(world);
  for (const cop of world.cops) {
    cop.stun = Math.max(0, (cop.stun ?? 0) - dt);
    if (cop.stun > 0) {
      cop.contact = 0;
      cop.phase += dt * 1.5;
      continue;
    }
    const d = dist(cop.x, cop.y, point.x, point.y);
    if (world.wanted < 2) continue;
    if (d < 780) {
      const angle = Math.atan2(point.y - cop.y, point.x - cop.x);
      cop.angle = turnToward(cop.angle, angle, dt * 5.2);
      const speed = 116 + world.wanted * 9;
      const dx = Math.cos(cop.angle) * speed * dt;
      const dy = Math.sin(cop.angle) * speed * dt;
      slide(world, cop, dx, dy, 9, false);
      cop.phase += dt * 9;
      cop.contact = Math.max(0, cop.contact - dt);
      if (d < 25 && cop.contact <= 0) {
        cop.contact = 0.8;
        hurtPlayer(world, 10, 'An officer');
      }
    }
  }
}

function updateCamera(world, dt) {
  const point = playerPoint(world);
  const vehicle = currentVehicle(world);
  let lookX = 0;
  let lookY = 0;
  if (vehicle) {
    lookX = Math.cos(vehicle.angle) * Math.min(130, Math.abs(vehicle.speed) * 0.42);
    lookY = Math.sin(vehicle.angle) * Math.min(130, Math.abs(vehicle.speed) * 0.42);
  }
  const targetX = clampsCameraX(point.x + lookX);
  const targetY = clampsCameraY(point.y + lookY);
  const follow = Math.min(1, dt * 4.2);
  world.camera.x += (targetX - world.camera.x) * follow;
  world.camera.y += (targetY - world.camera.y) * follow;
}

function clampsCameraX(x) {
  return clamp(x, 640, WORLD.width - 640);
}

function clampsCameraY(y) {
  return clamp(y, 360, WORLD.height - 360);
}

function updateMission(world, dt) {
  if (world.finished) return;
  world.mission.timer -= dt;
  if (world.mission.timer <= 20 && !world.mission.warned) {
    world.mission.warned = true;
    toast(world, '20 seconds left on this contract.', 'warn', 3.4);
    pushEvent(world, 'timer', 'Twenty seconds left on the contract.');
  }
  if (world.mission.timer <= 0) finish(world, 'lapsed');
}

export function stepWorld(world, dt, controls) {
  if (world.finished) return;
  world.time += dt;
  world.elapsed += dt;
  updateMission(world, dt);
  if (world.finished) return;

  if (controls.pressed?.interact) handleInteract(world);
  if (world.finished) return;
  if (world.player.onFoot && controls.pressed?.pulse) usePulse(world);

  if (world.player.onFoot) {
    updateOnFoot(world, controls, dt);
  } else {
    const vehicle = currentVehicle(world);
    if (vehicle) updateVehiclePhysics(world, vehicle, controls, dt);
  }

  updatePeds(world, dt);
  updatePatrols(world, dt);
  updateCops(world, dt);
  updateHeat(world, dt);
  updateParticles(world, dt);
  updateToasts(world, dt);
  updateCamera(world, dt);
}

export { finish };
