// Sunline District — all drawing. The city is painted from procedural geometry, the HUD is laid out
// on a 1280x720 design canvas, and every scene (title, play, pause, win, loss) lives here.

import {
  DISTRICTS,
  FONT,
  MISSION,
  MISSIONS,
  MONO,
  PALETTE,
  PIERS,
  PLAYER,
  ROADS,
  VEHICLE_TYPES,
  VIEW,
  WORLD,
} from './config.js';
import {
  currentVehicle,
  getObjective,
  interactionState,
  isOnRoad,
  nearestVehicle,
  objectiveDistance,
  playerPoint,
} from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

const UI_W = VIEW.width;
const UI_H = VIEW.height;
const TAU = Math.PI * 2;
const STAR_STATUS = ['CLEAR', 'WATCHED', 'PURSUIT', 'HEAT', 'LOCKDOWN', 'MANHUNT'];

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function pathRoundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRound(ctx, x, y, w, h, radius, color) {
  pathRoundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRound(ctx, x, y, w, h, radius, color, width = 1) {
  pathRoundRect(ctx, x, y, w, h, radius);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function starPath(ctx, x, y, outer, inner = outer * 0.44) {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const radius = point % 2 === 0 ? outer : inner;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (point === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatCash(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = 1;
  const fonts = new Map();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(320, window.innerWidth);
    height = Math.max(240, window.innerHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  function font(size, weight = '400', mono = false) {
    const key = `${size}|${weight}|${mono}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${mono ? MONO : FONT}`);
    ctx.font = fonts.get(key);
  }

  function text(value, x, y, size, color, options = {}) {
    font(size, options.weight ?? '400', options.mono ?? false);
    ctx.fillStyle = color;
    ctx.textAlign = options.align ?? 'left';
    ctx.textBaseline = options.baseline ?? 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = options.spacing ? `${options.spacing}px` : '0px';
    ctx.fillText(value, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function measure(value, size, weight = '400', mono = false) {
    font(size, weight, mono);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    return ctx.measureText(value).width;
  }

  function chip(value, x, y, color, size = 10, bg = 'rgba(0,0,0,0.22)') {
    const w = measure(value, size, '700', true) + 14;
    fillRound(ctx, x, y, w, size + 10, 5, bg);
    text(value, x + 7, y + size + 1, size, color, { weight: '700', mono: true });
    return w;
  }

  // --------------------------------------------------------------------------- world

  function drawOcean(world, view) {
    const gradient = ctx.createLinearGradient(WORLD.shoreX, 0, WORLD.width, WORLD.height);
    gradient.addColorStop(0, '#17505a');
    gradient.addColorStop(0.48, PALETTE.water);
    gradient.addColorStop(1, PALETTE.deepWater);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(WORLD.shoreX - 4, 0, WORLD.width - WORLD.shoreX + 4, WORLD.height);
    ctx.clip();
    const rowTop = Math.max(0, Math.floor(view.top / 46) * 46);
    const rowBottom = Math.min(WORLD.height, view.bottom + 48);
    for (let row = rowTop; row < rowBottom; row += 46) {
      const amplitude = 4 + (row % 3) * 2;
      ctx.beginPath();
      for (let x = WORLD.shoreX - 20; x <= WORLD.width + 20; x += 32) {
        const y = row + Math.sin(x * 0.018 + world.time * 0.55 + row) * amplitude;
        if (x <= WORLD.shoreX - 20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = row % 92 === 0 ? 'rgba(190, 233, 221, 0.18)' : 'rgba(123, 197, 190, 0.09)';
      ctx.lineWidth = row % 92 === 0 ? 1.5 : 1;
      ctx.stroke();
    }
    // A few glints, deterministic by row.
    for (let index = 0; index < 34; index += 1) {
      const x = WORLD.shoreX + 40 + ((index * 157) % (WORLD.width - WORLD.shoreX - 60));
      const y = 60 + ((index * 311) % (WORLD.height - 120));
      const alpha = 0.12 + 0.1 * Math.sin(world.time * 1.4 + index);
      ctx.fillStyle = `rgba(231, 250, 238, ${alpha})`;
      ctx.fillRect(x, y, 12 + (index % 4) * 5, 1.5);
    }
    ctx.restore();

    // Foam at the shoreline.
    ctx.beginPath();
    for (let y = 0; y <= WORLD.height; y += 18) {
      const x = WORLD.shoreX + Math.sin(y * 0.026 + world.time * 0.8) * 5;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(224, 243, 230, 0.58)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function drawCityBase(world, view) {
    ctx.fillStyle = '#3e474b';
    ctx.fillRect(0, 0, WORLD.shoreX, WORLD.height);

    // Beach and promenade.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(WORLD.beachX, 0, WORLD.shoreX - WORLD.beachX, WORLD.height);
    ctx.fillStyle = 'rgba(120, 88, 48, 0.13)';
    for (let y = 4; y < WORLD.height; y += 34) ctx.fillRect(WORLD.beachX + 4, y, WORLD.shoreX - WORLD.beachX - 8, 2);
    ctx.fillStyle = '#5a6264';
    ctx.fillRect(WORLD.promenadeX, 0, WORLD.beachX - WORLD.promenadeX, WORLD.height);
    ctx.strokeStyle = 'rgba(226, 213, 181, 0.14)';
    ctx.lineWidth = 1;
    for (let y = 0; y < WORLD.height; y += 26) {
      ctx.beginPath();
      ctx.moveTo(WORLD.promenadeX + 8, y);
      ctx.lineTo(WORLD.beachX - 8, y);
      ctx.stroke();
    }
    // Promenade railing.
    ctx.strokeStyle = 'rgba(22, 37, 40, 0.48)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(WORLD.beachX - 5, 0);
    ctx.lineTo(WORLD.beachX - 5, WORLD.height);
    ctx.stroke();

    // Blocks read slightly darker than the pavement around them.
    const xs = [0, ...ROADS.vertical];
    const ys = [0, ...ROADS.horizontal, WORLD.height];
    for (let ix = 0; ix < xs.length - 1; ix += 1) {
      for (let iy = 0; iy < ys.length - 1; iy += 1) {
        const left = ix === 0 ? 24 : xs[ix] + ROADS.width / 2 + 2;
        const right = ix === xs.length - 2 ? WORLD.promenadeX : xs[ix + 1] - ROADS.width / 2 - 2;
        const top = iy === 0 ? 24 : ys[iy] + ROADS.width / 2 + 2;
        const bottom = iy === ys.length - 2 ? WORLD.height - 24 : ys[iy + 1] - ROADS.width / 2 - 2;
        if (right - left < 4 || bottom - top < 4) continue;
        ctx.fillStyle = 'rgba(30, 38, 41, 0.22)';
        ctx.fillRect(left + 18, top + 18, right - left - 36, bottom - top - 36);
      }
    }

    // District names are painted on the ground, quietly.
    for (const district of DISTRICTS) {
      text(district.text, district.x, district.y, 42, 'rgba(227, 211, 172, 0.075)', {
        weight: '800',
        align: 'center',
        spacing: 5,
      });
    }
  }

  function drawRoads(world, view) {
    const half = ROADS.width / 2;
    ctx.fillStyle = PALETTE.asphalt;
    for (const x of ROADS.vertical) {
      if (x < view.left - half || x > view.right + half) continue;
      ctx.fillRect(x - half, 0, ROADS.width, WORLD.height);
      ctx.fillStyle = PALETTE.asphaltEdge;
      ctx.fillRect(x - half, 0, 3, WORLD.height);
      ctx.fillRect(x + half - 3, 0, 3, WORLD.height);
      ctx.fillStyle = PALETTE.asphalt;
    }
    for (const y of ROADS.horizontal) {
      if (y < view.top - half || y > view.bottom + half) continue;
      ctx.fillRect(0, y - half, WORLD.shoreX, ROADS.width);
      ctx.fillStyle = PALETTE.asphaltEdge;
      ctx.fillRect(0, y - half, WORLD.shoreX, 3);
      ctx.fillRect(0, y + half - 3, WORLD.shoreX, 3);
      ctx.fillStyle = PALETTE.asphalt;
    }

    // Lane paint and crossing bars.
    ctx.save();
    ctx.strokeStyle = 'rgba(220, 190, 110, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 18]);
    for (const x of ROADS.vertical) {
      if (x < view.left - half || x > view.right + half) continue;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.height);
      ctx.stroke();
    }
    for (const y of ROADS.horizontal) {
      if (y < view.top - half || y > view.bottom + half) continue;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.shoreX, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(235, 225, 199, 0.37)';
    for (const x of ROADS.vertical) {
      for (const y of ROADS.horizontal) {
        if (x < view.left - 100 || x > view.right + 100 || y < view.top - 100 || y > view.bottom + 100) continue;
        for (let step = -3; step <= 3; step += 1) {
          ctx.fillRect(x + step * 11 - 3, y - half - 17, 6, 12);
          ctx.fillRect(x + step * 11 - 3, y + half + 5, 6, 12);
          ctx.fillRect(x - half - 17, y + step * 11 - 3, 12, 6);
          ctx.fillRect(x + half + 5, y + step * 11 - 3, 12, 6);
        }
      }
    }
    ctx.restore();
  }

  function drawPark(park, world) {
    ctx.fillStyle = PALETTE.grass;
    fillRound(ctx, park.x, park.y, park.w, park.h, 12, PALETTE.grass);
    ctx.fillStyle = 'rgba(16, 40, 28, 0.35)';
    fillRound(ctx, park.x + 12, park.y + 12, park.w - 24, park.h - 24, 9, 'rgba(16, 40, 28, 0.32)');
    ctx.strokeStyle = 'rgba(202, 186, 141, 0.26)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(park.x + park.w / 2, park.y + 8);
    ctx.lineTo(park.x + park.w / 2, park.y + park.h - 8);
    ctx.moveTo(park.x + 8, park.y + park.h / 2);
    ctx.lineTo(park.x + park.w - 8, park.y + park.h / 2);
    ctx.stroke();
    text(park.name.toUpperCase(), park.x + 16, park.y + park.h - 14, 10, 'rgba(226, 227, 194, 0.54)', {
      weight: '700',
      mono: true,
      spacing: 1.5,
    });
  }

  function drawFountain(fountain) {
    ctx.fillStyle = 'rgba(5, 16, 19, 0.3)';
    ctx.beginPath();
    ctx.arc(fountain.x + 5, fountain.y + 7, fountain.radius + 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8b918c';
    ctx.beginPath();
    ctx.arc(fountain.x, fountain.y, fountain.radius + 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2d7a82';
    ctx.beginPath();
    ctx.arc(fountain.x, fountain.y, fountain.radius + 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(206, 239, 229, 0.5)';
    ctx.beginPath();
    ctx.arc(fountain.x - 2, fountain.y - 2, fountain.radius * 0.36, 0, TAU);
    ctx.fill();
  }

  function drawLots(world) {
    for (const lot of world.lots) {
      ctx.fillStyle = '#333c40';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(230, 199, 118, 0.42)';
      ctx.lineWidth = 2;
      ctx.strokeRect(lot.x + 6, lot.y + 6, lot.w - 12, lot.h - 12);
      const bays = Math.max(2, Math.floor(lot.w / 70));
      for (let index = 0; index <= bays; index += 1) {
        const x = lot.x + 12 + (index * (lot.w - 24)) / bays;
        ctx.beginPath();
        ctx.moveTo(x, lot.y + 24);
        ctx.lineTo(x, lot.y + lot.h - 18);
        ctx.stroke();
      }
      text(lot.label, lot.x + 12, lot.y + 18, 10, 'rgba(233, 208, 141, 0.64)', {
        weight: '700',
        mono: true,
        spacing: 1.5,
      });
    }
  }

  function drawPier(pier) {
    ctx.fillStyle = 'rgba(10, 28, 31, 0.32)';
    ctx.fillRect(pier.x + 8, pier.y + 10, pier.w, pier.h);
    ctx.fillStyle = '#6b5540';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.fillStyle = '#7c644b';
    for (let x = pier.x + 7; x < pier.x + pier.w - 4; x += 17) ctx.fillRect(x, pier.y + 3, 9, pier.h - 6);
    ctx.fillStyle = '#332a20';
    for (let x = pier.x + 18; x < pier.x + pier.w; x += 62) {
      ctx.beginPath();
      ctx.arc(x, pier.y + pier.h + 10, 5, 0, TAU);
      ctx.arc(x, pier.y - 10, 5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(24, 22, 18, 0.5)';
    ctx.fillRect(pier.x, pier.y - 2, pier.w, 2);
    ctx.fillRect(pier.x, pier.y + pier.h, pier.w, 2);
    text(pier.name.toUpperCase(), pier.x + 14, pier.y + 18, 9, 'rgba(245, 230, 192, 0.7)', {
      weight: '700',
      mono: true,
      spacing: 1.2,
    });
  }

  function drawLighthouse(world) {
    const x = 3072;
    const y = 1266;
    ctx.fillStyle = 'rgba(4, 14, 17, 0.28)';
    ctx.beginPath();
    ctx.arc(x + 7, y + 9, 32, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8dfc8';
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#b75749';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#2e3a3f';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, TAU);
    ctx.fill();
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 44);
    glow.addColorStop(0, `rgba(255, 212, 116, ${0.5 + Math.sin(world.time * 2) * 0.15})`);
    glow.addColorStop(1, 'rgba(255, 194, 85, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 44, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd477';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, TAU);
    ctx.fill();
    text('LANTERN', x, y + 43, 9, 'rgba(237, 218, 177, 0.72)', {
      weight: '700',
      mono: true,
      align: 'center',
      spacing: 1.4,
    });
  }

  function drawBuilding(building, view) {
    if (building.x > view.right + 80 || building.y > view.bottom + 80
      || building.x + building.w < view.left - 80 || building.y + building.h < view.top - 80) return;
    const { x, y, w, h, style } = building;
    ctx.fillStyle = PALETTE.shadow;
    fillRound(ctx, x + 11, y + 13, w, h, 7, PALETTE.shadow);
    fillRound(ctx, x, y, w, h, 7, style.trim);
    fillRound(ctx, x + 4, y + 4, w - 8, h - 8, 5, style.base);
    fillRound(ctx, x + 10, y + 10, w - 20, h - 20, 4, style.roof);

    // Roof panel and seams.
    ctx.strokeStyle = 'rgba(235, 237, 222, 0.10)';
    ctx.lineWidth = 1;
    if (w > 86) {
      for (let gx = x + 24; gx < x + w - 14; gx += 29) {
        ctx.beginPath();
        ctx.moveTo(gx, y + 14);
        ctx.lineTo(gx, y + h - 14);
        ctx.stroke();
      }
    }

    // Lit windows along the street-facing edge.
    const lit = (building.detail + Math.floor(x + y)) % 4;
    if (w > 60 && h > 55) {
      const count = Math.floor((w - 24) / 20);
      for (let index = 0; index < count; index += 1) {
        const wx = x + 16 + index * 20;
        const warm = (index + lit) % 3 === 0;
        ctx.fillStyle = warm ? 'rgba(255, 210, 135, 0.68)' : 'rgba(114, 179, 177, 0.30)';
        ctx.fillRect(wx, y + h - 21, 11, 5);
      }
    }

    // Rooftop machinery and solar panels.
    const d = building.detail;
    ctx.fillStyle = 'rgba(18, 25, 28, 0.42)';
    fillRound(ctx, x + 26 + (d % 17), y + 24, 30, 20, 3, 'rgba(18, 25, 28, 0.46)');
    fillRound(ctx, x + w - 54 - (d % 13), y + 24 + (d % 11), 21, 16, 2, 'rgba(18, 25, 28, 0.40)');
    if (d % 5 === 0 && w > 150 && h > 100) {
      ctx.strokeStyle = 'rgba(230, 232, 218, 0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.17, 0, TAU);
      ctx.stroke();
      text('H', x + w / 2, y + h / 2 + 6, 17, 'rgba(230, 232, 218, 0.28)', { weight: '800', align: 'center' });
    } else if (w > 150 && h > 80) {
      ctx.save();
      ctx.translate(x + w - 58, y + h - 48);
      ctx.rotate(-0.2);
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          ctx.fillStyle = row % 2 === 0 ? 'rgba(46, 101, 111, 0.65)' : 'rgba(36, 82, 91, 0.66)';
          ctx.fillRect(col * 13, row * 10, 9, 6);
        }
      }
      ctx.restore();
    }

    if (building.sign) {
      const signWidth = Math.min(w - 24, measure(building.sign, 9, '700', true) + 16);
      ctx.fillStyle = 'rgba(7, 15, 18, 0.80)';
      fillRound(ctx, x + 12, y + h - 38, signWidth, 17, 3, 'rgba(7, 15, 18, 0.80)');
      ctx.fillStyle = building.signColor;
      ctx.globalAlpha = 0.9;
      text(building.sign, x + 20, y + h - 25, 9, building.signColor, { weight: '700', mono: true, spacing: 0.4 });
      ctx.globalAlpha = 1;
    } else if (w > 120) {
      text(building.name, x + 16, y + h - 25, 9, 'rgba(222, 227, 213, 0.30)', { weight: '600' });
    }
  }

  function drawTree(tree) {
    ctx.fillStyle = 'rgba(4, 14, 12, 0.28)';
    ctx.beginPath();
    ctx.ellipse(tree.x + 7, tree.y + 9, tree.r * 0.9, tree.r * 0.55, 0.3, 0, TAU);
    ctx.fill();
    if (tree.kind === 'palm') {
      ctx.strokeStyle = '#5c4934';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tree.x, tree.y + 4);
      ctx.lineTo(tree.x - 2, tree.y - 12);
      ctx.stroke();
      ctx.strokeStyle = ['#4f7c54', '#5f8f61', '#46704c'][tree.tint];
      ctx.lineWidth = 3;
      for (let frond = 0; frond < 7; frond += 1) {
        const angle = (frond / 7) * TAU + 0.3;
        ctx.beginPath();
        ctx.moveTo(tree.x - 2, tree.y - 12);
        ctx.quadraticCurveTo(
          tree.x - 2 + Math.cos(angle) * tree.r * 0.9,
          tree.y - 12 + Math.sin(angle) * tree.r * 0.55 - 6,
          tree.x - 2 + Math.cos(angle) * tree.r * 1.35,
          tree.y - 12 + Math.sin(angle) * tree.r * 0.9,
        );
        ctx.stroke();
      }
      ctx.fillStyle = '#40704f';
      ctx.beginPath();
      ctx.arc(tree.x - 2, tree.y - 12, 6, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = '#5e4c37';
      ctx.fillRect(tree.x - 2, tree.y - 3, 4, 10);
      ctx.fillStyle = ['#2f5a3d', '#376947', '#295039'][tree.tint];
      ctx.beginPath();
      ctx.arc(tree.x - tree.r * 0.34, tree.y - tree.r * 0.25, tree.r * 0.72, 0, TAU);
      ctx.arc(tree.x + tree.r * 0.34, tree.y - tree.r * 0.18, tree.r * 0.66, 0, TAU);
      ctx.arc(tree.x, tree.y - tree.r * 0.62, tree.r * 0.7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(173, 210, 152, 0.16)';
      ctx.beginPath();
      ctx.arc(tree.x - tree.r * 0.25, tree.y - tree.r * 0.58, tree.r * 0.32, 0, TAU);
      ctx.fill();
    }
  }

  function drawLamp(lamp) {
    const glow = ctx.createRadialGradient(lamp.x, lamp.y, 1, lamp.x, lamp.y, 26);
    glow.addColorStop(0, 'rgba(255, 211, 128, 0.24)');
    glow.addColorStop(1, 'rgba(255, 201, 106, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d292d';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd37e';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 2, 0, TAU);
    ctx.fill();
  }

  function drawUmbrella(umbrella) {
    ctx.fillStyle = 'rgba(20, 22, 19, 0.24)';
    ctx.beginPath();
    ctx.arc(umbrella.x + 4, umbrella.y + 5, 12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d87361';
    ctx.beginPath();
    ctx.arc(umbrella.x, umbrella.y, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#efddbd';
    ctx.beginPath();
    ctx.arc(umbrella.x, umbrella.y, 4, 0, TAU);
    ctx.fill();
  }

  function drawPedestrians(world) {
    for (const ped of world.pedestrians) {
      const bob = Math.sin(ped.phase) * 0.8;
      ctx.fillStyle = 'rgba(6, 14, 15, 0.22)';
      ctx.beginPath();
      ctx.ellipse(ped.x + 2, ped.y + 5, 6, 3.4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y - 2 + bob, 4.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ddb28f';
      ctx.beginPath();
      ctx.arc(ped.x, ped.y - 6 + bob, 2.7, 0, TAU);
      ctx.fill();
    }
  }

  function drawCops(world) {
    for (const cop of world.cops) {
      const bob = Math.sin(cop.phase) * 1.5;
      ctx.fillStyle = 'rgba(4, 12, 15, 0.3)';
      ctx.beginPath();
      ctx.ellipse(cop.x + 3, cop.y + 6, 8, 4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#233b57';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y - 3 + bob, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e4c09d';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y - 8 + bob, 3.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#16283c';
      ctx.fillRect(cop.x - 4, cop.y - 12 + bob, 8, 2.6);
      ctx.fillStyle = '#78d9ee';
      ctx.fillRect(cop.x - 1, cop.y - 2 + bob, 2, 2);
    }
  }

  function drawCar(vehicle, world, controlled) {
    const spec = VEHICLE_TYPES[vehicle.type];
    const police = vehicle.type === 'patrol';
    const length = police ? 98 : spec.length;
    const width = police ? 50 : spec.width;
    ctx.save();
    ctx.translate(vehicle.x, vehicle.y);
    ctx.rotate(vehicle.angle);
    ctx.fillStyle = 'rgba(3, 9, 12, 0.32)';
    ctx.beginPath();
    ctx.ellipse(3, 7, length * 0.52, width * 0.62, 0, 0, TAU);
    ctx.fill();

    // Wheels.
    ctx.fillStyle = '#111719';
    fillRound(ctx, -length * 0.3, -width / 2 - 2, length * 0.17, 5, 2, '#111719');
    fillRound(ctx, length * 0.17, -width / 2 - 2, length * 0.17, 5, 2, '#111719');
    fillRound(ctx, -length * 0.3, width / 2 - 3, length * 0.17, 5, 2, '#111719');
    fillRound(ctx, length * 0.17, width / 2 - 3, length * 0.17, 5, 2, '#111719');

    const bodyColor = police ? '#edf0e8' : vehicle.color;
    fillRound(ctx, -length / 2, -width / 2, length, width, 9, bodyColor);
    fillRound(ctx, -length / 2 + 7, -width / 2 + 4, length - 14, width - 8, 7, 'rgba(255,255,255,0.10)');
    if (police) {
      ctx.fillStyle = '#182938';
      fillRound(ctx, -length * 0.12, -width / 2 + 3, length * 0.32, width - 6, 3, '#182938');
      ctx.fillStyle = '#e5b645';
      ctx.fillRect(-length * 0.18, -width / 2 + 6, 3, width - 12);
    }
    // Cabin and windscreen.
    ctx.fillStyle = 'rgba(17, 34, 39, 0.82)';
    fillRound(ctx, -length * 0.12, -width * 0.34, length * 0.36, width * 0.68, 4, 'rgba(17, 34, 39, 0.82)');
    ctx.fillStyle = 'rgba(130, 195, 198, 0.30)';
    ctx.fillRect(length * 0.12, -width * 0.34, 5, width * 0.68);
    ctx.fillRect(-length * 0.22, -width * 0.34, 3, width * 0.68);
    // Lights.
    ctx.fillStyle = '#ffd88e';
    ctx.fillRect(length / 2 - 4, -width / 2 + 7, 3, 6);
    ctx.fillRect(length / 2 - 4, width / 2 - 13, 3, 6);
    ctx.fillStyle = '#e86657';
    ctx.fillRect(-length / 2 + 1, -width / 2 + 7, 2.5, 6);
    ctx.fillRect(-length / 2 + 1, width / 2 - 13, 2.5, 6);
    if (vehicle.type === 'taxi') {
      ctx.fillStyle = '#f6d875';
      fillRound(ctx, -3, -7, 8, 14, 2, '#f6d875');
    }
    if (vehicle.type === 'courier') {
      ctx.fillStyle = 'rgba(255, 247, 223, 0.78)';
      ctx.fillRect(-length * 0.36, -width / 2 + 7, length * 0.5, 3);
      text('SUNLINE', -length * 0.08, 3, 7, 'rgba(55, 31, 18, 0.8)', { weight: '800', mono: true, align: 'center' });
    }
    if (police) {
      const flash = Math.sin(world.time * 9 + vehicle.id) > 0;
      ctx.fillStyle = flash ? '#ff5a55' : '#4f7dff';
      fillRound(ctx, -6, -width / 2 + 2, 12, width - 4, 3, flash ? '#ff5a55' : '#4f7dff');
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 46);
      glow.addColorStop(0, flash ? 'rgba(255, 80, 76, 0.38)' : 'rgba(73, 122, 255, 0.38)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, TAU);
      ctx.fill();
    }
    if (controlled) {
      ctx.strokeStyle = 'rgba(99, 230, 213, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, length * 0.6, width * 0.82, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(world) {
    const player = world.player;
    if (!player.onFoot) return;
    const moving = player.speed > 2;
    const bob = moving ? Math.sin(player.walkPhase) * 1.8 : Math.sin(world.time * 2) * 0.5;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = 'rgba(4, 12, 14, 0.34)';
    ctx.beginPath();
    ctx.ellipse(1, 6, 11, 6, 0, 0, TAU);
    ctx.fill();
    // Legs.
    ctx.strokeStyle = '#203034';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.lineTo(-2 + bob * 0.8, -7);
    ctx.moveTo(-2, 3);
    ctx.lineTo(-2 - bob * 0.8, 7);
    ctx.stroke();
    // Courier jacket + satchel.
    ctx.fillStyle = '#2f7f76';
    fillRound(ctx, -7, -6, 16, 12, 5, '#2f7f76');
    ctx.fillStyle = '#ef9a5c';
    fillRound(ctx, -10, -5, 7, 10, 2, '#ef9a5c');
    ctx.fillStyle = '#b7e4d5';
    ctx.beginPath();
    ctx.arc(6, 0, 4.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d9ad86';
    ctx.beginPath();
    ctx.arc(7, 0, 3.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1b2b2e';
    ctx.fillRect(8, -4.2, 3, 8.4);
    ctx.restore();
    if (world.mission.cargo) {
      const pulse = 0.55 + Math.sin(world.time * 5) * 0.2;
      ctx.strokeStyle = `rgba(255, 180, 94, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 19, 0, TAU);
      ctx.stroke();
    }
  }

  function drawObjective(world) {
    const objective = getObjective(world);
    if (!objective) return;
    const color = objective.kind === 'pickup' ? MISSION.markers.pickup : MISSION.markers.drop;
    const pulse = (Math.sin(world.time * 3.2) + 1) / 2;
    const radius = 28 + pulse * 8;
    const glow = ctx.createRadialGradient(objective.x, objective.y, 3, objective.x, objective.y, 78);
    glow.addColorStop(0, objective.kind === 'pickup' ? 'rgba(95, 227, 207, 0.35)' : 'rgba(255, 180, 94, 0.34)');
    glow.addColorStop(1, 'rgba(95, 227, 207, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, 78, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = `${color}aa`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, radius, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = `${color}55`;
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, radius + 12, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = 'rgba(8, 17, 20, 0.88)';
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, 17, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (objective.kind === 'pickup') {
      ctx.fillStyle = color;
      ctx.fillRect(objective.x - 7, objective.y - 6, 14, 12);
      ctx.fillStyle = 'rgba(10, 24, 26, 0.9)';
      ctx.fillRect(objective.x - 1, objective.y - 6, 2, 12);
      ctx.fillRect(objective.x - 7, objective.y - 1, 14, 2);
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(objective.x - 6, objective.y - 5);
      ctx.lineTo(objective.x, objective.y + 2);
      ctx.lineTo(objective.x + 6, objective.y - 5);
      ctx.moveTo(objective.x - 6, objective.y + 1);
      ctx.lineTo(objective.x, objective.y + 8);
      ctx.lineTo(objective.x + 6, objective.y + 1);
      ctx.stroke();
    }

    const label = objective.kind === 'pickup' ? 'PICK UP' : 'DELIVER';
    const labelWidth = measure(label, 10, '800', true) + 18;
    ctx.fillStyle = 'rgba(7, 15, 18, 0.9)';
    fillRound(ctx, objective.x - labelWidth / 2, objective.y - 52, labelWidth, 20, 4, 'rgba(7, 15, 18, 0.9)');
    text(label, objective.x, objective.y - 38, 10, color, { weight: '800', mono: true, align: 'center', spacing: 1.2 });
    const nameWidth = measure(objective.name, 12, '700') + 20;
    ctx.fillStyle = 'rgba(7, 15, 18, 0.70)';
    fillRound(ctx, objective.x - nameWidth / 2, objective.y + 42, nameWidth, 22, 4, 'rgba(7, 15, 18, 0.70)');
    text(objective.name, objective.x, objective.y + 57, 12, PALETTE.cream, { weight: '700', align: 'center' });
  }

  function drawParticles(world) {
    for (const particle of world.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPulse(world) {
    const pulse = world.pulseVisual;
    if (!pulse) return;
    const progress = 1 - clamp(pulse.life / pulse.maxLife, 0, 1);
    const radius = Math.max(18, pulse.range * progress);
    const alpha = clamp(pulse.life / pulse.maxLife, 0, 1);
    ctx.save();
    ctx.translate(pulse.x, pulse.y);
    ctx.rotate(pulse.angle);
    ctx.fillStyle = `rgba(98, 226, 208, ${0.12 * alpha})`;
    ctx.strokeStyle = `rgba(120, 255, 230, ${0.78 * alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, -pulse.halfAngle, pulse.halfAngle);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, radius, -pulse.halfAngle, pulse.halfAngle);
    ctx.stroke();
    ctx.restore();
  }

  function drawWorld(world, view) {
    drawOcean(world, view);
    drawCityBase(world, view);
    drawRoads(world, view);
    for (const park of world.parks) drawPark(park, world);
    drawLots(world);
    for (const fountain of world.fountains) drawFountain(fountain);
    for (const pier of world.piers) drawPier(pier);
    drawLighthouse(world);
    for (const building of world.buildings) drawBuilding(building, view);

    for (const tree of world.trees) {
      if (tree.x < view.left - 40 || tree.x > view.right + 40 || tree.y < view.top - 40 || tree.y > view.bottom + 40) continue;
      drawTree(tree);
    }
    for (const umbrella of world.umbrellas) drawUmbrella(umbrella);
    for (const lamp of world.lamps) {
      if (lamp.x < view.left - 30 || lamp.x > view.right + 30 || lamp.y < view.top - 30 || lamp.y > view.bottom + 30) continue;
      drawLamp(lamp);
    }
    drawObjective(world);

    for (const vehicle of world.vehicles) {
      if (vehicle.x < view.left - 90 || vehicle.x > view.right + 90 || vehicle.y < view.top - 90 || vehicle.y > view.bottom + 90) continue;
      drawCar(vehicle, world, vehicle.id === world.player.inVehicle);
    }
    for (const patrol of world.patrols) {
      if (!patrol.active) continue;
      if (patrol.x < view.left - 100 || patrol.x > view.right + 100 || patrol.y < view.top - 100 || patrol.y > view.bottom + 100) continue;
      drawCar({ ...patrol, type: 'patrol', color: '#e8ece5', occupied: false }, world, false);
    }
    drawPedestrians(world);
    drawCops(world);
    drawPlayer(world);
    drawParticles(world);
    drawPulse(world);
  }

  // --------------------------------------------------------------------------- HUD

  function panel(x, y, w, h, accent = null) {
    fillRound(ctx, x, y, w, h, 8, PALETTE.panel);
    strokeRound(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8, PALETTE.panelLine, 1);
    if (accent) {
      ctx.fillStyle = accent;
      fillRound(ctx, x, y, 3, h, 1.5, accent);
    }
  }

  function drawHealthPanel(world) {
    const player = world.player;
    panel(22, 22, 288, 108, PALETTE.amber);
    text('SUNLINE DISTRICT', 40, 46, 11, PALETTE.amber, { weight: '800', mono: true, spacing: 1.8 });
    text('COURIER 07', 40, 66, 18, PALETTE.HUDInk, { weight: '800', spacing: 1.2 });
    text(formatCash(player.cash), 292, 66, 18, PALETTE.cream, { weight: '800', mono: true, align: 'right' });

    const barX = 40;
    const barY = 82;
    const barW = 190;
    ctx.fillStyle = 'rgba(232, 238, 225, 0.13)';
    fillRound(ctx, barX, barY, barW, 8, 4, 'rgba(232, 238, 225, 0.13)');
    const health = clamp(player.health / PLAYER.maxHealth, 0, 1);
    const healthColor = health > 0.55 ? PALETTE.good : health > 0.25 ? PALETTE.amber : PALETTE.danger;
    if (health > 0) fillRound(ctx, barX, barY, Math.max(4, barW * health), 8, 4, healthColor);
    text('HP', 40, 106, 9, 'rgba(237, 239, 225, 0.48)', { weight: '700', mono: true, spacing: 1 });
    text(String(Math.ceil(player.health)), 66, 106, 9, healthColor, { weight: '700', mono: true });

    ctx.fillStyle = 'rgba(232, 238, 225, 0.10)';
    fillRound(ctx, 254, 82, 36, 8, 4, 'rgba(232, 238, 225, 0.10)');
    fillRound(ctx, 254, 82, Math.max(2, 36 * (player.stamina / PLAYER.staminaMax)), 8, 4, PALETTE.teal);
    text('STM', 254, 106, 8, 'rgba(237, 239, 225, 0.42)', { weight: '700', mono: true });
  }

  function drawMissionPanel(world) {
    const objective = getObjective(world);
    if (!objective) return;
    const x = UI_W / 2 - 244;
    const y = 22;
    panel(x, y, 488, 108, objective.kind === 'pickup' ? PALETTE.teal : PALETTE.amber);
    const mission = MISSIONS[world.mission.index];
    text(`CONTRACT ${String(world.mission.index + 1).padStart(2, '0')} / ${String(MISSIONS.length).padStart(2, '0')}`, x + 18, y + 25, 10, PALETTE.muted, { weight: '700', mono: true, spacing: 1.5 });
    text(mission.client.toUpperCase(), x + 470, y + 25, 10, PALETTE.amber, { weight: '700', mono: true, align: 'right', spacing: 1.2 });
    text(objective.kind === 'pickup' ? 'COLLECT THE PACKAGE' : 'MAKE THE DELIVERY', x + 18, y + 51, 19, PALETTE.HUDInk, { weight: '800', spacing: 0.6 });
    text(objective.name, x + 18, y + 75, 13, objective.kind === 'pickup' ? PALETTE.teal : PALETTE.amber, { weight: '700' });
    const d = objectiveDistance(world);
    text(`${Math.max(0, Math.round(d / 10))} m away · ${objective.hint}`, x + 18, y + 94, 10, 'rgba(238, 238, 224, 0.53)', {});
    // Contract dots.
    for (let index = 0; index < MISSIONS.length; index += 1) {
      const dotX = x + 398 + index * 17;
      ctx.fillStyle = index < world.mission.index ? PALETTE.good : index === world.mission.index ? PALETTE.amber : 'rgba(236, 235, 220, 0.18)';
      ctx.beginPath();
      ctx.arc(dotX, y + 91, 4, 0, TAU);
      ctx.fill();
    }
    const timer = formatTime(world.mission.timer);
    text(timer, x + 470, y + 75, 25, world.mission.timer <= 20 ? PALETTE.danger : PALETTE.cream, { weight: '800', mono: true, align: 'right' });
    text('TIME LEFT', x + 470, y + 94, 8, 'rgba(238, 238, 224, 0.43)', { weight: '700', mono: true, align: 'right', spacing: 1 });
  }

  function drawHeatPanel(world) {
    const x = UI_W - 22 - 220;
    const y = 22;
    panel(x, y, 220, 108, world.wanted >= 3 ? PALETTE.danger : world.wanted > 0 ? PALETTE.amber : null);
    text('PATROL HEAT', x + 18, y + 25, 10, PALETTE.muted, { weight: '700', mono: true, spacing: 1.5 });
    text(STAR_STATUS[world.wanted], x + 202, y + 25, 10, world.wanted >= 3 ? PALETTE.danger : world.wanted > 0 ? PALETTE.amber : PALETTE.good, { weight: '800', mono: true, align: 'right', spacing: 1 });
    for (let index = 0; index < 5; index += 1) {
      const filled = index < world.wanted;
      starPath(ctx, x + 29 + index * 28, y + 52, 10.5);
      ctx.fillStyle = filled ? (index >= 3 ? PALETTE.danger : PALETTE.amber) : 'rgba(238, 237, 222, 0.14)';
      ctx.fill();
      ctx.strokeStyle = filled ? 'rgba(255, 242, 216, 0.34)' : 'rgba(238, 237, 222, 0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(236, 235, 220, 0.12)';
    fillRound(ctx, x + 18, y + 78, 184, 5, 2.5, 'rgba(236, 235, 220, 0.12)');
    fillRound(ctx, x + 18, y + 78, Math.max(2, 184 * (world.suspicion / 100)), 5, 2.5, world.wanted >= 3 ? PALETTE.danger : PALETTE.amber);
    const active = world.patrols.filter((patrol) => patrol.active).length;
    text(`${active} units · ${world.cops.length} on foot`, x + 18, y + 99, 9, 'rgba(238, 238, 224, 0.46)', { weight: '600', mono: true });
    text(world.wanted >= 3 ? 'BREAK LINE OF SIGHT' : 'STAY COOL', x + 202, y + 99, 8, 'rgba(238, 238, 224, 0.36)', { weight: '700', mono: true, align: 'right', spacing: 0.8 });
  }

  function drawMinimap(world) {
    const x = 22;
    const y = UI_H - 22 - 168;
    const w = 222;
    const h = 168;
    panel(x, y, w, h);
    const mapX = x + 12;
    const mapY = y + 12;
    const mapW = w - 24;
    const mapH = h - 24;
    const scale = Math.min(mapW / WORLD.width, mapH / WORLD.height);
    const ox = mapX + (mapW - WORLD.width * scale) / 2;
    const oy = mapY + (mapH - WORLD.height * scale) / 2;
    ctx.save();
    fillRound(ctx, mapX, mapY, mapW, mapH, 5, '#0b242b');
    pathRoundRect(ctx, mapX, mapY, mapW, mapH, 5);
    ctx.clip();
    ctx.fillStyle = '#1a4b53';
    ctx.fillRect(ox + WORLD.shoreX * scale, oy, (WORLD.width - WORLD.shoreX) * scale, WORLD.height * scale);
    ctx.fillStyle = '#39444a';
    ctx.fillRect(ox, oy, WORLD.shoreX * scale, WORLD.height * scale);
    ctx.fillStyle = '#2c363b';
    for (const building of world.buildings) ctx.fillRect(ox + building.x * scale, oy + building.y * scale, Math.max(1, building.w * scale), Math.max(1, building.h * scale));
    ctx.strokeStyle = 'rgba(216, 190, 111, 0.34)';
    ctx.lineWidth = Math.max(1, ROADS.width * scale);
    for (const road of ROADS.vertical) {
      ctx.beginPath();
      ctx.moveTo(ox + road * scale, oy);
      ctx.lineTo(ox + road * scale, oy + WORLD.height * scale);
      ctx.stroke();
    }
    for (const road of ROADS.horizontal) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + road * scale);
      ctx.lineTo(ox + WORLD.shoreX * scale, oy + road * scale);
      ctx.stroke();
    }
    for (const patrol of world.patrols) {
      if (!patrol.active) continue;
      ctx.fillStyle = world.wanted >= 2 ? '#ff6d5f' : '#ffb45e';
      ctx.beginPath();
      ctx.arc(ox + patrol.x * scale, oy + patrol.y * scale, 2.6, 0, TAU);
      ctx.fill();
    }
    for (const cop of world.cops) {
      ctx.fillStyle = '#ff8d82';
      ctx.beginPath();
      ctx.arc(ox + cop.x * scale, oy + cop.y * scale, 2, 0, TAU);
      ctx.fill();
    }
    const objective = getObjective(world);
    if (objective) {
      const pulse = 3.4 + Math.sin(world.time * 4) * 1.4;
      ctx.strokeStyle = objective.kind === 'pickup' ? PALETTE.teal : PALETTE.amber;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ox + objective.x * scale, oy + objective.y * scale, pulse + 2, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = objective.kind === 'pickup' ? PALETTE.teal : PALETTE.amber;
      ctx.beginPath();
      ctx.arc(ox + objective.x * scale, oy + objective.y * scale, 2.2, 0, TAU);
      ctx.fill();
    }
    const point = playerPoint(world);
    const px = ox + point.x * scale;
    const py = oy + point.y * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(point.angle ?? 0);
    ctx.fillStyle = PALETTE.cream;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    text('COAST', x + w - 16, y + h - 14, 8, 'rgba(201, 237, 227, 0.5)', { weight: '700', mono: true, align: 'right', spacing: 1 });
    text('N', x + w - 18, y + 20, 9, 'rgba(238, 236, 220, 0.45)', { weight: '700', mono: true, align: 'center' });
    ctx.strokeStyle = 'rgba(238, 236, 220, 0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w - 18, y + 25);
    ctx.lineTo(x + w - 18, y + 33);
    ctx.stroke();
  }

  function drawInteraction(world) {
    const state = interactionState(world);
    if (!state) return;
    const label = state.label;
    const key = label.slice(0, 1);
    const body = label.slice(4);
    const w = 50 + measure(body, 14, '600') + 30;
    const x = UI_W / 2 - w / 2;
    const y = UI_H - 88;
    panel(x, y, w, 46, state.kind === 'pickup' ? PALETTE.teal : state.kind === 'drop' ? PALETTE.amber : null);
    fillRound(ctx, x + 12, y + 9, 28, 28, 6, 'rgba(239, 235, 219, 0.12)');
    text(key, x + 26, y + 28, 14, PALETTE.cream, { weight: '800', mono: true, align: 'center' });
    text(body, x + 50, y + 28, 14, PALETTE.cream, { weight: '600' });
  }

  function drawSpeed(world) {
    const vehicle = currentVehicle(world);
    const x = UI_W - 22 - 186;
    const y = UI_H - 22 - 104;
    if (!vehicle) {
      const footY = UI_H - 22 - 118;
      panel(x, footY, 186, 118);
      text('ON FOOT', x + 18, footY + 25, 10, PALETTE.muted, { weight: '700', mono: true, spacing: 1.4 });
      text('WASD move · SHIFT sprint', x + 18, footY + 49, 10, 'rgba(240, 237, 222, 0.72)', { weight: '600' });
      text('E interact / enter vehicle', x + 18, footY + 68, 10, 'rgba(240, 237, 222, 0.72)', { weight: '600' });
      text('SPACE  FLARE PULSE', x + 18, footY + 89, 9, 'rgba(240, 237, 222, 0.72)', { weight: '700', mono: true, spacing: 0.3 });
      const pulseReady = world.player.pulseCooldown <= 0;
      text(pulseReady ? 'READY' : `${world.player.pulseCooldown.toFixed(1)}s`, x + 168, footY + 89, 9, pulseReady ? PALETTE.good : PALETTE.amber, { weight: '700', mono: true, align: 'right' });
      text('P pause · R restart', x + 18, footY + 108, 9, 'rgba(240, 237, 222, 0.38)', { weight: '500' });
      return;
    }
    panel(x, y, 186, 100, PALETTE.teal);
    const spec = VEHICLE_TYPES[vehicle.type];
    const speed = Math.abs(vehicle.speed);
    const kmh = Math.round(speed * 0.38);
    text(spec.label.toUpperCase(), x + 18, y + 28, 10, PALETTE.teal, { weight: '700', mono: true, spacing: 1.2 });
    text(String(kmh), x + 18, y + 72, 34, PALETTE.cream, { weight: '800', mono: true });
    text('KM/H', x + 18 + measure(String(kmh), 34, '800', true) + 6, y + 72, 9, 'rgba(238, 238, 224, 0.42)', { weight: '700', mono: true });
    const ratio = clamp(speed / spec.maxSpeed, 0, 1);
    ctx.strokeStyle = 'rgba(236, 235, 220, 0.13)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + 146, y + 62, 28, Math.PI * 0.78, Math.PI * 0.22);
    ctx.stroke();
    ctx.strokeStyle = isOnRoad(world, vehicle.x, vehicle.y) ? PALETTE.teal : PALETTE.amber;
    ctx.beginPath();
    ctx.arc(x + 146, y + 62, 28, Math.PI * 0.78, Math.PI * 0.78 + Math.PI * 0.44 * ratio);
    ctx.stroke();
    text(isOnRoad(world, vehicle.x, vehicle.y) ? 'ROAD' : 'OFF ROAD', x + 146, y + 92, 8, 'rgba(238, 238, 224, 0.44)', { weight: '700', mono: true, align: 'center', spacing: 1 });
  }

  function drawToasts(world) {
    let y = 148;
    for (let index = Math.max(0, world.toasts.length - 3); index < world.toasts.length; index += 1) {
      const toastItem = world.toasts[index];
      const alpha = clamp(toastItem.life / 0.7, 0, 1) * clamp((toastItem.maxLife - toastItem.life) / 0.22, 0, 1);
      const tone = toastItem.tone === 'good' ? PALETTE.good : toastItem.tone === 'warn' ? PALETTE.amber : toastItem.tone === 'bad' ? PALETTE.danger : PALETTE.teal;
      const w = measure(toastItem.text, 13, '600') + 42;
      const x = UI_W / 2 - w / 2;
      ctx.globalAlpha = alpha;
      fillRound(ctx, x, y, w, 34, 7, 'rgba(7, 15, 18, 0.84)');
      strokeRound(ctx, x + 0.5, y + 0.5, w - 1, 33, 7, `${tone}55`, 1);
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.arc(x + 16, y + 17, 3, 0, TAU);
      ctx.fill();
      text(toastItem.text, x + 28, y + 22, 13, PALETTE.cream, { weight: '600' });
      ctx.globalAlpha = 1;
      y += 40;
    }
  }

  function drawObjectiveArrow(world, worldToUi) {
    const objective = getObjective(world);
    if (!objective) return;
    const p = worldToUi(objective.x, objective.y);
    const marginX = 94;
    const top = 150;
    const bottom = 480;
    if (p.x > marginX && p.x < UI_W - marginX && p.y > top && p.y < bottom) return;
    const cx = UI_W / 2;
    const cy = (top + bottom) / 2;
    const angle = Math.atan2(p.y - cy, p.x - cx);
    let x = cx + Math.cos(angle) * 1000;
    let y = cy + Math.sin(angle) * 1000;
    const left = marginX;
    const right = UI_W - marginX;
    const topEdge = top;
    const bottomEdge = bottom;
    if (x < left) {
      const t = (left - cx) / (x - cx);
      x = left;
      y = cy + (y - cy) * t;
    } else if (x > right) {
      const t = (right - cx) / (x - cx);
      x = right;
      y = cy + (y - cy) * t;
    }
    if (y < topEdge) {
      const t = (topEdge - cy) / (y - cy);
      y = topEdge;
      x = cx + (x - cx) * t;
    } else if (y > bottomEdge) {
      const t = (bottomEdge - cy) / (y - cy);
      y = bottomEdge;
      x = cx + (x - cx) * t;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = objective.kind === 'pickup' ? PALETTE.teal : PALETTE.amber;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -8);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const d = Math.max(0, Math.round(objectiveDistance(world) / 10));
    const label = `${d} m`;
    const w = measure(label, 10, '700', true) + 14;
    fillRound(ctx, x - w / 2, y + 13, w, 19, 4, 'rgba(7, 15, 18, 0.8)');
    text(label, x, y + 26, 10, PALETTE.cream, { weight: '700', mono: true, align: 'center' });
  }

  function drawHud(world, worldToUi) {
    drawHealthPanel(world);
    drawMissionPanel(world);
    drawHeatPanel(world);
    drawMinimap(world);
    drawInteraction(world);
    drawSpeed(world);
    drawToasts(world);
    drawObjectiveArrow(world, worldToUi);
    if (world.player.hurtFlash > 0.02) {
      const gradient = ctx.createRadialGradient(UI_W / 2, UI_H / 2, 180, UI_W / 2, UI_H / 2, 700);
      gradient.addColorStop(0, 'rgba(255, 72, 58, 0)');
      gradient.addColorStop(1, `rgba(255, 55, 45, ${0.33 * world.player.hurtFlash})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, UI_W, UI_H);
    }
    if (world.flash > 0.01) {
      ctx.fillStyle = `rgba(255, 224, 170, ${world.flash * 0.2})`;
      ctx.fillRect(0, 0, UI_W, UI_H);
    }
  }

  // --------------------------------------------------------------------------- screens

  function drawTitle(world, best) {
    const gradient = ctx.createLinearGradient(0, 0, UI_W * 0.74, UI_H);
    gradient.addColorStop(0, 'rgba(5, 13, 17, 0.96)');
    gradient.addColorStop(0.55, 'rgba(5, 13, 17, 0.78)');
    gradient.addColorStop(1, 'rgba(5, 13, 17, 0.10)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, UI_W, UI_H);
    const bottom = ctx.createLinearGradient(0, UI_H * 0.62, 0, UI_H);
    bottom.addColorStop(0, 'rgba(5, 13, 17, 0)');
    bottom.addColorStop(1, 'rgba(5, 13, 17, 0.9)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, 0, UI_W, UI_H);

    // Warm sun behind the right-hand city.
    const sun = ctx.createRadialGradient(985, 160, 8, 985, 160, 132);
    sun.addColorStop(0, 'rgba(255, 205, 119, 0.55)');
    sun.addColorStop(0.42, 'rgba(255, 178, 88, 0.14)');
    sun.addColorStop(1, 'rgba(255, 170, 80, 0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(985, 160, 132, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 206, 128, 0.22)';
    ctx.lineWidth = 1;
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath();
      ctx.arc(985, 160, 52 + ring * 22, 0, TAU);
      ctx.stroke();
    }

    chip('AN ORIGINAL OFFLINE COURIER STORY', 68, 94, PALETTE.teal, 9);
    text('SUNLINE', 64, 236, 86, PALETTE.cream, { weight: '800', spacing: 4 });
    text('DISTRICT', 64, 318, 86, PALETTE.amber, { weight: '800', spacing: 4 });
    ctx.fillStyle = 'rgba(238, 232, 210, 0.25)';
    ctx.fillRect(68, 344, 386, 1);
    text('Three packages. One crooked coast. Keep the engine warm.', 68, 378, 17, 'rgba(244, 240, 225, 0.78)', { weight: '500' });

    const cardX = 68;
    const cardY = 428;
    panel(cardX, cardY, 470, 184, PALETTE.amber);
    text('CONTROLS', cardX + 20, cardY + 30, 10, PALETTE.amber, { weight: '800', mono: true, spacing: 2 });
    const rows = [
      ['WASD / ARROWS', 'Move on foot · drive · steer'],
      ['E', 'Interact · enter / exit vehicle'],
      ['SHIFT', 'Sprint on foot'],
      ['SPACE', 'Flare pulse on foot · handbrake in car'],
      ['P / ESC', 'Pause · R restart'],
    ];
    for (let index = 0; index < rows.length; index += 1) {
      const rowY = cardY + 55 + index * 24;
      text(rows[index][0], cardX + 20, rowY, 11, PALETTE.cream, { weight: '700', mono: true, spacing: 0.6 });
      text(rows[index][1], cardX + 174, rowY, 12, 'rgba(239, 236, 222, 0.66)', { weight: '500' });
    }

    const pulse = 0.64 + Math.sin(world.time * 2.5) * 0.24;
    ctx.globalAlpha = pulse;
    text('PRESS ENTER OR CLICK TO START', 68, 658, 18, PALETTE.amber, { weight: '800', spacing: 1.4 });
    ctx.globalAlpha = 1;
    text(`BEST CASH  ${formatCash(best)}`, 1212, 658, 11, 'rgba(240, 237, 222, 0.52)', { weight: '700', mono: true, align: 'right', spacing: 1 });
    text('Procedural coast · no downloads · no network', 1212, 684, 10, 'rgba(240, 237, 222, 0.30)', { weight: '500', align: 'right' });
  }

  function drawPause(world) {
    ctx.fillStyle = 'rgba(4, 10, 13, 0.72)';
    ctx.fillRect(0, 0, UI_W, UI_H);
    const x = UI_W / 2 - 240;
    const y = 194;
    panel(x, y, 480, 300, PALETTE.teal);
    text('SHIFT PAUSED', UI_W / 2, y + 62, 32, PALETTE.cream, { weight: '800', align: 'center', spacing: 2 });
    text('The coast can wait.', UI_W / 2, y + 92, 14, 'rgba(240, 237, 222, 0.6)', { align: 'center' });
    text(`${formatCash(world.player.cash)}  ·  ${formatTime(world.elapsed)}  ·  HEAT ${world.wanted}/5`, UI_W / 2, y + 145, 13, PALETTE.amber, { weight: '700', mono: true, align: 'center', spacing: 0.6 });
    text('P / ESC   resume', UI_W / 2, y + 208, 18, PALETTE.teal, { weight: '800', align: 'center', spacing: 1.4 });
    text('R   restart shift', UI_W / 2, y + 242, 14, 'rgba(240, 237, 222, 0.64)', { weight: '600', align: 'center' });
    text('The clock is frozen.', UI_W / 2, y + 275, 10, 'rgba(240, 237, 222, 0.32)', { align: 'center' });
  }

  function drawEnd(world, best) {
    const win = world.outcome === 'win';
    const lapsed = world.outcome === 'lapsed';
    const accent = win ? PALETTE.good : lapsed ? PALETTE.amber : PALETTE.danger;
    ctx.fillStyle = 'rgba(4, 10, 13, 0.78)';
    ctx.fillRect(0, 0, UI_W, UI_H);
    const x = UI_W / 2 - 330;
    const y = 132;
    panel(x, y, 660, 444, accent);
    const tone = win ? 'SHIFT COMPLETE' : lapsed ? 'CONTRACT LAPSED' : 'BUSTED';
    text(win ? 'THE COAST IS QUIET' : lapsed ? 'THE CLOCK RAN OUT' : 'THE PATROL CLOSED IN', UI_W / 2, y + 58, 11, accent, {
      weight: '800',
      mono: true,
      align: 'center',
      spacing: 2.2,
    });
    text(tone, UI_W / 2, y + 112, 40, PALETTE.cream, { weight: '800', align: 'center', spacing: 2.2 });
    text(
      win
        ? 'Three drops, one clean line down the coast. Sunline remembers.'
        : lapsed
          ? 'A contract slipped through your fingers. The city moves on.'
          : 'The patrol got the cuffs on before the next light changed.',
      UI_W / 2,
      y + 146,
      14,
      'rgba(240, 237, 222, 0.64)',
      { align: 'center' },
    );

    const stats = [
      ['CASH BANKED', formatCash(world.player.cash)],
      ['DELIVERIES', `${world.stats.deliveries} / ${MISSIONS.length}`],
      ['PEAK HEAT', `${world.stats.peakHeat} / 5`],
      ['SHIFT TIME', formatTime(world.stats.time)],
    ];
    for (let index = 0; index < stats.length; index += 1) {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const sx = x + 72 + col * 278;
      const sy = y + 196 + row * 74;
      text(stats[index][0], sx, sy, 9, 'rgba(240, 237, 222, 0.42)', { weight: '700', mono: true, spacing: 1.3 });
      text(stats[index][1], sx, sy + 28, 24, PALETTE.cream, { weight: '800', mono: true });
    }
    if (best > 0) text(`BEST CASH  ${formatCash(best)}`, UI_W / 2, y + 356, 10, 'rgba(240, 237, 222, 0.42)', { weight: '700', mono: true, align: 'center', spacing: 1 });
    const pulse = 0.66 + Math.sin(world.time * 2.8) * 0.22;
    ctx.globalAlpha = pulse;
    text('PRESS ENTER OR CLICK TO RUN ANOTHER SHIFT', UI_W / 2, y + 402, 16, accent, { weight: '800', align: 'center', spacing: 1.1 });
    ctx.globalAlpha = 1;
    text('R   instant restart', UI_W / 2, y + 426, 10, 'rgba(240, 237, 222, 0.38)', { weight: '600', align: 'center' });
  }

  // --------------------------------------------------------------------------- frame

  function draw(world, screen, ui = {}) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, width, height);

    const zoom = Math.max(width / UI_W, height / UI_H);
    const shake = world.shake > 0 ? world.shake : 0;
    const shakeX = shake > 0 ? Math.sin(world.time * 83) * 7 * shake : 0;
    const shakeY = shake > 0 ? Math.cos(world.time * 71) * 5 * shake : 0;
    const cameraX = world.camera.x + shakeX;
    const cameraY = world.camera.y + shakeY;
    const halfW = width / (2 * zoom);
    const halfH = height / (2 * zoom);
    const view = {
      left: cameraX - halfW,
      right: cameraX + halfW,
      top: cameraY - halfH,
      bottom: cameraY + halfH,
    };

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraX, -cameraY);
    drawWorld(world, view);
    ctx.restore();

    const uiScale = Math.min(width / UI_W, height / UI_H);
    const offsetX = (width - UI_W * uiScale) / 2;
    const offsetY = (height - UI_H * uiScale) / 2;
    const worldToUi = (x, y) => ({
      x: (width / 2 + (x - cameraX) * zoom - offsetX) / uiScale,
      y: (height / 2 + (y - cameraY) * zoom - offsetY) / uiScale,
    });

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(uiScale, uiScale);
    if (screen === SCREEN_TITLE) {
      drawTitle(world, ui.best ?? 0);
    } else if (screen === SCREEN_WIN || screen === SCREEN_LOSE) {
      drawEnd(world, ui.best ?? 0);
    } else {
      drawHud(world, worldToUi);
      if (screen === SCREEN_PAUSED) drawPause(world);
    }
    ctx.restore();
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize };
}
