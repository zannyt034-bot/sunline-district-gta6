// Sunline District — Node 22-compatible, standard-library build entrypoint.
// The offline top-down coastal courier sandbox lives in game/ as local HTML and ES modules.
// This script verifies the staged game scenes, copies the playable build and real screenshots,
// then writes the make.fun dossier with the vendored library. No remote assets or packages.
//
// Serve locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameEntry = join(here, 'game', 'index.html');
if (!existsSync(gameEntry) || !existsSync(join(here, 'game', 'src', 'main.js'))) {
  throw new Error('Sunline District is missing its local browser entrypoint.');
}

const allowedStages = new Set(['title', 'play', 'chase', 'win']);
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
if (!Array.isArray(shots) || shots.length < 3 || shots.length > 4) {
  throw new Error('shots.json must declare three or four real game scenes.');
}
const filenames = new Set();
const stages = new Set();
for (const shot of shots) {
  if (!shot || typeof shot.name !== 'string' || !/^\d+-(?:title|play|chase|win)\.(?:png|jpe?g)$/i.test(shot.name)) {
    throw new Error('Each screenshot needs a numbered title/play/chase/win filename.');
  }
  const stage = new URLSearchParams(String(shot.query ?? '').replace(/^\?/, '')).get('shot');
  if (!allowedStages.has(stage) || filenames.has(shot.name)) {
    throw new Error(`Invalid or duplicate screenshot stage: ${shot.query}`);
  }
  const image = join(here, 'screenshots', shot.name);
  if (!existsSync(image) || statSync(image).size > 262144) {
    throw new Error(`Missing screenshot or screenshot exceeds 256 KiB: ${shot.name}`);
  }
  filenames.add(shot.name);
  stages.add(stage);
}
for (const required of ['title', 'play', 'win']) {
  if (!stages.has(required)) throw new Error(`shots.json must include the ${required} scene.`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// These caps mirror the scorer: screenshot count and size, file count and total game bytes, and path length.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
