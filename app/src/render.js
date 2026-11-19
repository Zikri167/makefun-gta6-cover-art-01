// The Neon Palms cover renderer. drawCover paints a whole cover — panels,
// grade, lettering, poster extras, grain and frame — onto any 2D context at
// any size, so the editor preview and the exported PNG are the same drawing.

import { gradeGradient } from './grades.js';

export const SIZES = {
  square: { id: 'square', name: 'Square', w: 1080, h: 1080, label: '1080 × 1080' },
  portrait: { id: 'portrait', name: 'Portrait', w: 1080, h: 1350, label: '1080 × 1350' },
  wide: { id: 'wide', name: 'Wide', w: 1920, h: 1080, label: '1920 × 1080' },
  story: { id: 'story', name: 'Story', w: 1080, h: 1920, label: '1080 × 1920' },
};

export const LETTER_THEMES = {
  sunset: {
    name: 'Sunset Gradient',
    stops: ['#fff6da', '#ffc24d', '#ff7a3d', '#ff2e6e'],
    subtitle: '#ffd9ec',
    glow: '#ff2e88',
  },
  chrome: {
    name: 'Chrome White',
    stops: ['#ffffff', '#e8eef5', '#93a7bd', '#f8fbff'],
    subtitle: '#ffe29a',
    glow: '#ffb347',
  },
  neon: {
    name: 'Neon Pop',
    stops: ['#d8fffb', '#2ee6ff', '#7a5cff', '#ff2e88'],
    subtitle: '#a8fff9',
    glow: '#19e3ff',
  },
};

export function panelRects(layout, W, H) {
  return layout.panels().map((p) => ({
    ...p,
    px: p.x * W,
    py: p.y * H,
    pw: p.w * W,
    ph: p.h * H,
  }));
}

// The source rectangle a cover-fit photo shows inside a destination box,
// with zoom (1 = plain cover fit) and offsets in -1..1 across the slack.
export function coverSourceRect(imgW, imgH, dstW, dstH, zoom, ox, oy) {
  const scale = Math.max(dstW / imgW, dstH / imgH) * Math.max(1, zoom || 1);
  const sw = dstW / scale;
  const sh = dstH / scale;
  const sx = (imgW - sw) * (0.5 + (ox || 0) * 0.5);
  const sy = (imgH - sh) * (0.5 + (oy || 0) * 0.5);
  return { sx, sy, sw, sh, scale };
}

function insetRect(r, d) {
  return { x: r.x + d, y: r.y + d, w: r.w - d * 2, h: r.h - d * 2 };
}

function drawPanelPhoto(ctx, view, index, rect) {
  const src = view.panelCanvas(index);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (!src) {
    const grad = gradeGradient(ctx, view.grade, rect.x, rect.y, rect.x, rect.y + rect.h);
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(10, 2, 20, 0.35)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255, 246, 230, 0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.max(13, Math.min(rect.w, rect.h) * 0.11);
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w * 0.9);
    ctx.restore();
    return;
  }
  const st = view.panelState(index);
  if (st.spread) {
    const scale = Math.max(view.W / src.width, view.H / src.height) * Math.max(1, st.zoom || 1);
    const dw = src.width * scale;
    const dh = src.height * scale;
    const x0 = (view.W - dw) * (0.5 + (st.ox || 0) * 0.5);
    const y0 = (view.H - dh) * (0.5 + (st.oy || 0) * 0.5);
    ctx.drawImage(src, x0, y0, dw, dh);
  } else {
    const s = coverSourceRect(src.width, src.height, rect.w, rect.h, st.zoom, st.ox, st.oy);
    ctx.drawImage(src, s.sx, s.sy, s.sw, s.sh, rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

function drawPanel(ctx, view, index, panel, W, H) {
  const minSide = Math.min(W, H);
  const base = { x: panel.px, y: panel.py, w: panel.pw, h: panel.ph };
  const gut = panel.frame ? 0 : minSide * 0.0055;
  const rect = insetRect(base, gut);
  ctx.save();
  if (panel.rot) {
    ctx.translate(base.x + base.w / 2, base.y + base.h / 2);
    ctx.rotate(panel.rot);
    ctx.translate(-(base.x + base.w / 2), -(base.y + base.h / 2));
  }
  if (panel.frame) {
    const f = minSide * 0.016;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = minSide * 0.028;
    ctx.shadowOffsetY = minSide * 0.01;
    ctx.fillStyle = '#f8f3e6';
    ctx.fillRect(rect.x - f, rect.y - f, rect.w + f * 2, rect.h + f * 2);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  drawPanelPhoto(ctx, view, index, rect);
  ctx.strokeStyle = 'rgba(12, 5, 24, 0.9)';
  ctx.lineWidth = Math.max(1.5, minSide * 0.0022);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function splitCaptionLines(ctx, text, size, maxW) {
  ctx.font = `${size}px Anton, sans-serif`;
  if (ctx.measureText(text).width <= maxW) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text];
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (!best || w < best.w) best = { w, lines: [a, b] };
  }
  return best.lines;
}

// Letters the caption: block display type with a themed gradient fill, a
// heavy dark outline and a neon script subtitle overlapping its top.
function drawCaptionBlock(ctx, view, cx, anchorY, maxW, sizeCap, anchor) {
  const theme = LETTER_THEMES[view.letterTheme] || LETTER_THEMES.sunset;
  const text = (view.caption || '').trim().toUpperCase() || 'YOUR TITLE';
  let size = sizeCap * (view.captionScale || 1);
  let lines = splitCaptionLines(ctx, text, size, maxW);
  ctx.font = `${size}px Anton, sans-serif`;
  let widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  while (widest > maxW && size > 12) {
    size *= 0.93;
    lines = splitCaptionLines(ctx, text, size, maxW);
    ctx.font = `${size}px Anton, sans-serif`;
    widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  }
  const lineH = size * 0.98;
  const blockH = lineH * lines.length;
  let top;
  if (anchor === 'bottom') top = anchorY - blockH;
  else if (anchor === 'center') top = anchorY - blockH / 2;
  else top = anchorY;
  const grad = ctx.createLinearGradient(0, top, 0, top + blockH);
  theme.stops.forEach((c, i) => grad.addColorStop(i / (theme.stops.length - 1), c));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  lines.forEach((line, i) => {
    const baseline = top + size * 0.82 + i * lineH;
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = size * 0.09;
    ctx.shadowOffsetY = size * 0.05;
    ctx.strokeStyle = '#150722';
    ctx.lineWidth = size * 0.17;
    ctx.strokeText(line, cx, baseline);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = grad;
    ctx.fillText(line, cx, baseline);
  });
  const sub = (view.subtitle || '').trim();
  if (sub) {
    const subSize = size * 0.44;
    ctx.save();
    ctx.translate(cx, top - size * 0.06);
    ctx.rotate(-0.045);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = subSize * 0.55;
    ctx.strokeStyle = 'rgba(21, 7, 34, 0.85)';
    ctx.lineWidth = subSize * 0.1;
    ctx.lineJoin = 'round';
    ctx.strokeText(sub, 0, 0);
    ctx.fillStyle = theme.subtitle;
    ctx.fillText(sub, 0, 0);
    ctx.restore();
  }
  return { top, bottom: top + blockH, size };
}

function drawTitleCell(ctx, view, rect, W, H) {
  const minSide = Math.min(W, H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = gradeGradient(ctx, view.grade, rect.x, rect.y, rect.x, rect.y + rect.h);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  // Halftone dots, the printed-poster texture.
  ctx.fillStyle = 'rgba(12, 0, 24, 0.20)';
  const step = minSide * 0.023;
  const rad = minSide * 0.0042;
  let row = 0;
  for (let y = rect.y + step * 0.6; y < rect.y + rect.h; y += step, row++) {
    for (let x = rect.x + step * 0.6 + (row % 2 ? step / 2 : 0); x < rect.x + rect.w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const sizeCap = Math.min(rect.h * 0.335, rect.w * 0.30);
  const block = drawCaptionBlock(ctx, view, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w * 0.88, sizeCap, 'center');
  if (view.stars > 0) {
    drawHeatMeter(ctx, view, rect.x + rect.w / 2, rect.y + rect.h - minSide * 0.052, minSide * 0.021, true);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(12, 5, 24, 0.9)';
  ctx.lineWidth = Math.max(1.5, minSide * 0.0022);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  return block;
}

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawHeatMeter(ctx, view, cx, cy, unit, centered) {
  const n = 5;
  const totalW = n * unit * 2.35;
  const labelW = unit * 3.4;
  const startX = centered ? cx - (totalW + labelW) / 2 : cx;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `${unit * 1.25}px Anton, sans-serif`;
  ctx.fillStyle = 'rgba(255, 246, 230, 0.95)';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = unit * 0.3;
  ctx.fillText('HEAT', startX, cy);
  for (let i = 0; i < n; i++) {
    const sx = startX + labelW + i * unit * 2.35 + unit * 1.1;
    starPath(ctx, sx, cy, unit);
    if (i < view.stars) {
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255, 246, 230, 0.65)';
      ctx.lineWidth = unit * 0.16;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBadgeRibbon(ctx, view, W, H) {
  const text = (view.badgeText || '').trim().toUpperCase();
  if (!text) return;
  const minSide = Math.min(W, H);
  const bh = minSide * 0.052;
  const bw = W * 0.42;
  const d = minSide * 0.104;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.translate(W - d, d);
  ctx.rotate(Math.PI / 4);
  const grad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  grad.addColorStop(0, '#ff2e88');
  grad.addColorStop(1, '#ff7a3d');
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = minSide * 0.012;
  ctx.fillStyle = grad;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.font = `${bh * 0.52}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff6ea';
  ctx.fillText(text, 0, bh * 0.04, bw * 0.92);
  ctx.restore();
}

let noiseCanvas = null;
function getNoiseCanvas() {
  if (noiseCanvas) return noiseCanvas;
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 140;
  noiseCanvas.height = 140;
  const nctx = noiseCanvas.getContext('2d');
  const data = nctx.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  nctx.putImageData(data, 0, 0);
  return noiseCanvas;
}

// Paint the whole cover. `view` carries the design state plus two lookups:
// panelCanvas(i) -> the graded photo canvas for panel i (or null), and
// panelState(i) -> { zoom, ox, oy, spread } for that panel.
export function drawCover(ctx, view, W, H) {
  const minSide = Math.min(W, H);
  const rects = panelRects(view.layout, W, H);
  ctx.fillStyle = '#f7f1e3';
  ctx.fillRect(0, 0, W, H);
  rects.forEach((panel, i) => {
    if (i === view.layout.titleCell) {
      const gut = minSide * 0.0055;
      drawTitleCell(ctx, view, { x: panel.px + gut, y: panel.py + gut, w: panel.pw - gut * 2, h: panel.ph - gut * 2 }, W, H);
    } else {
      drawPanel(ctx, view, i, panel, W, H);
    }
  });
  if (view.layout.titleCell < 0) {
    if (view.layout.captionZone === 'bottom') {
      const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
      grad.addColorStop(0, 'rgba(6, 1, 14, 0)');
      grad.addColorStop(1, 'rgba(6, 1, 14, 0.80)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.5, W, H * 0.5);
      drawCaptionBlock(ctx, view, W / 2, H * 0.972, W * 0.9, H * 0.135, 'bottom');
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, H * 0.46);
      grad.addColorStop(0, 'rgba(6, 1, 14, 0.74)');
      grad.addColorStop(1, 'rgba(6, 1, 14, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H * 0.46);
      // Low enough that the script subtitle, which rides above the title,
      // still clears the top edge of the cover.
      drawCaptionBlock(ctx, view, W / 2, H * 0.078, W * 0.9, H * 0.115, 'top');
    }
    if (view.stars > 0) {
      drawHeatMeter(ctx, view, W * 0.032, H * 0.972 - minSide * 0.028, minSide * 0.02, false);
    }
  }
  if (view.badgeOn) drawBadgeRibbon(ctx, view, W, H);
  if (view.grainOn) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(getNoiseCanvas(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (view.vignetteOn) {
    const rad = ctx.createRadialGradient(W / 2, H / 2, Math.max(W, H) * 0.52, W / 2, H / 2, Math.max(W, H) * 1.02);
    rad.addColorStop(0, 'rgba(10, 0, 22, 0)');
    rad.addColorStop(1, 'rgba(10, 0, 22, 0.40)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);
  }
  const lw = Math.max(2, minSide * 0.0075);
  ctx.strokeStyle = '#12081f';
  ctx.lineWidth = lw * 1.7;
  ctx.strokeRect(0, 0, W, H);
  ctx.strokeStyle = '#f7f1e3';
  ctx.lineWidth = lw;
  ctx.strokeRect(lw * 0.85, lw * 0.85, W - lw * 1.7, H - lw * 1.7);
}
