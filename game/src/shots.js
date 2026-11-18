// Screenshot staging. Every scene starts from the same procedural city and uses the real entities,
// HUD and renderer; only the camera and a handful of mission values are placed for a readable frame.

import { MISSIONS } from './config.js';
import { SCREEN_LOSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { resetWorld } from './world.js';

function findVehicle(world, type) {
  return world.vehicles.find((vehicle) => vehicle.type === type) ?? world.vehicles[0];
}

function putPlayerInVehicle(world, vehicle, x, y, angle, speed) {
  vehicle.x = x;
  vehicle.y = y;
  vehicle.angle = angle;
  vehicle.speed = speed;
  vehicle.occupied = true;
  world.player.inVehicle = vehicle.id;
  world.player.onFoot = false;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  world.player.speed = speed;
}

function stagePlay(world) {
  resetWorld(world);
  world.titlePan = false;
  world.time = 27.4;
  world.elapsed = 52;
  world.mission.index = 0;
  world.mission.phase = 'deliver';
  world.mission.cargo = true;
  world.mission.timer = 96;
  world.mission.deadline = MISSIONS[0].deadline;
  world.player.cash = 386;
  world.player.health = 88;
  world.player.stamina = 71;
  world.wanted = 2;
  world.lastWanted = 2;
  world.suspicion = 48;
  world.peakHeat = 2;
  world.stats.peakHeat = 2;

  const van = findVehicle(world, 'courier');
  putPlayerInVehicle(world, van, 1614, 842, -Math.PI / 2, 132);
  world.camera = { x: 1608, y: 806, zoom: 1 };

  const posts = [
    [1620, 1018, -Math.PI / 2],
    [1180, 700, 0.4],
    [2060, 1100, -2.2],
    [1620, 560, Math.PI / 2],
  ];
  for (let index = 0; index < world.patrols.length; index += 1) {
    const patrol = world.patrols[index];
    if (index < posts.length) {
      patrol.active = true;
      patrol.x = posts[index][0];
      patrol.y = posts[index][1];
      patrol.angle = posts[index][2];
      patrol.speed = 120 + index * 8;
      patrol.mode = 'chase';
      patrol.memory = 4;
    } else {
      patrol.active = false;
    }
  }
  world.cops.length = 0;
  world.toasts.length = 0;
  world.particles.length = 0;
  return { screen: SCREEN_PLAY, best: 0 };
}

function stageChase(world) {
  resetWorld(world);
  world.titlePan = false;
  world.time = 61.8;
  world.elapsed = 204;
  world.mission.index = 2;
  world.mission.phase = 'deliver';
  world.mission.cargo = true;
  world.mission.timer = 38;
  world.mission.deadline = MISSIONS[2].deadline;
  world.player.cash = 1480;
  world.player.health = 64;
  world.player.stamina = 38;
  world.wanted = 4;
  world.lastWanted = 4;
  world.suspicion = 83;
  world.peakHeat = 4;
  world.stats.peakHeat = 4;

  const car = findVehicle(world, 'sport');
  putPlayerInVehicle(world, car, 2482, 1518, -Math.PI / 2, 238);
  world.camera = { x: 2520, y: 1430, zoom: 1 };

  const posts = [
    [2470, 1662, -Math.PI / 2],
    [2532, 1740, -Math.PI / 2],
    [2504, 1320, Math.PI / 2],
    [2060, 1500, 0.1],
    [2500, 1100, -0.2],
    [2060, 1100, 1.2],
  ];
  for (let index = 0; index < world.patrols.length; index += 1) {
    const patrol = world.patrols[index];
    if (index < posts.length) {
      patrol.active = true;
      patrol.x = posts[index][0];
      patrol.y = posts[index][1];
      patrol.angle = posts[index][2];
      patrol.speed = 240 + index * 9;
      patrol.mode = 'chase';
      patrol.memory = 4;
    } else {
      patrol.active = false;
    }
  }
  world.cops.length = 0;
  world.toasts.length = 0;
  world.particles.length = 0;
  for (let index = 0; index < 16; index += 1) {
    world.particles.push({
      x: 2470 - index * 5,
      y: 1540 + (index % 3) * 6,
      vx: -90 - index * 4,
      vy: 20 + index * 2,
      life: 0.5,
      maxLife: 0.9,
      size: 2 + (index % 3),
      color: 'rgba(225, 201, 158, 0.6)',
    });
  }
  return { screen: SCREEN_PLAY, best: 0 };
}

function stageComplete(world) {
  resetWorld(world);
  world.titlePan = false;
  world.finished = true;
  world.outcome = 'win';
  world.time = 188.2;
  world.elapsed = 421;
  world.mission.index = 2;
  world.mission.phase = 'deliver';
  world.mission.cargo = false;
  world.mission.timer = 44;
  world.player.cash = 2840;
  world.player.health = 79;
  world.player.stamina = 82;
  world.player.x = 2596;
  world.player.y = 1110;
  world.player.angle = -1.2;
  world.player.onFoot = true;
  world.wanted = 2;
  world.lastWanted = 2;
  world.suspicion = 30;
  world.peakHeat = 4;
  world.stats = {
    deliveries: 3,
    cashEarned: 2600,
    time: 421,
    peakHeat: 4,
    nearMisses: 2,
  };
  world.camera = { x: 2570, y: 1160, zoom: 1 };
  for (const patrol of world.patrols) patrol.active = false;
  world.cops.length = 0;
  world.toasts.length = 0;
  world.particles.length = 0;
  return { screen: SCREEN_WIN, best: 2840 };
}

export function stageShot(name, world) {
  if (name === 'play') return stagePlay(world);
  if (name === 'chase') return stageChase(world);
  if (name === 'win' || name === 'complete') return stageComplete(world);
  if (name !== 'title' && name !== 'start') throw new Error(`Unknown screenshot scene: ${name}`);

  resetWorld(world);
  world.titlePan = false;
  world.time = 14.2;
  world.camera = { x: 2250, y: 1350, zoom: 1 };
  world.toasts.length = 0;
  world.particles.length = 0;
  for (const patrol of world.patrols) {
    if (patrol.id > 2) patrol.active = false;
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
