// Neon Palms Cover Studio — editor state, photo handling, panel editing,
// undo/redo and PNG export. Everything runs locally: photos are read from
// the visitor's own machine and never leave it.

import { LAYOUTS, layoutById } from './layouts.js';
import { GRADES, gradeById, gradePhotoToCanvas } from './grades.js';
import { SIZES, LETTER_THEMES, drawCover, panelRects, coverSourceRect } from './render.js';

const SAMPLES = [
  { src: 'samples/boulevard.jpg', name: 'Boulevard' },
  { src: 'samples/pier.jpg', name: 'The Pier' },
  { src: 'samples/neon-street.jpg', name: 'Neon Street' },
  { src: 'samples/skyline-dusk.jpg', name: 'Dusk Skyline' },
  { src: 'samples/speedboat-bay.jpg', name: 'Speedboat Bay' },
];

// Photo presets per layout, by sample index, so a fresh cover looks
// composed before the visitor changes anything. -1 leaves a panel empty.
const PRESETS = {
  'nine-grid': [0, 3, 1, 2, -1, 4, 3, 0, 1],
  'hero-three': [0, 2, 3, 4],
  'top-story': [3, 0, 1, 4],
  'six-pack': [0, 2, 3, 1, 4, 0],
  'full-bleed': [0],
  'snap-tilt': [3, 0, 1, 4],
};

const state = {
  sizeKey: 'wide',
  layoutId: 'nine-grid',
  gradeId: 'vice-sunset',
  gradeAmount: 0.85,
  ink: false,
  grain: true,
  vignette: true,
  caption: 'NEON PALMS',
  subtitle: 'vice nights',
  letterTheme: 'sunset',
  captionScale: 1,
  badgeOn: true,
  badgeText: 'LAUNCH WEEK',
  stars: 5,
  panels: [],
  selectedPanel: 0,
  selectedPhoto: 0,
};

const photos = []; // { img, name }
const gradeCache = new Map();
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const sctx = stage.getContext('2d');

function layout() {
  return layoutById(state.layoutId);
}

function grade() {
  return gradeById(state.gradeId);
}

function blankPanel(photo) {
  return { photo: photo === undefined ? -1 : photo, zoom: 1, ox: 0, oy: 0, spread: false };
}

// Default framing per sample photo: where the good part of the picture sits
// when a panel crops it. Boulevard is a portrait shot whose face rides high;
// the pier portrait reads best a little above centre.
const FRAMING = {
  0: { oy: -0.55 },
  1: { oy: -0.3 },
  4: { oy: 0.15 },
};

function ensurePanels(usePreset) {
  const count = layout().panels().length;
  const preset = PRESETS[state.layoutId] || [];
  while (state.panels.length < count) {
    const i = state.panels.length;
    const panel = blankPanel(usePreset && preset[i] !== undefined ? preset[i] : -1);
    if (usePreset && panel.photo >= 0) {
      const framing = FRAMING[panel.photo];
      if (framing) Object.assign(panel, framing);
      // A photo used twice reads as two different shots when the second
      // panel crops a different slice of it.
      if (preset.slice(0, i).includes(panel.photo)) panel.ox = 0.35;
    }
    state.panels.push(panel);
  }
  state.panels.length = count;
  if (state.selectedPanel >= count || state.selectedPanel === layout().titleCell) {
    state.selectedPanel = layout().titleCell === 0 ? 1 : 0;
  }
}

function panelCanvas(i) {
  const p = state.panels[i];
  if (!p || p.photo < 0 || !photos[p.photo]) return null;
  const key = [p.photo, state.gradeId, Math.round(state.gradeAmount * 20), state.ink ? 6 : 0].join('|');
  if (!gradeCache.has(key)) {
    gradeCache.set(key, gradePhotoToCanvas(photos[p.photo].img, grade(), state.gradeAmount, state.ink ? 6 : 0));
  }
  return gradeCache.get(key);
}

function makeView(W, H) {
  return {
    layout: layout(),
    grade: grade(),
    gradeAmount: state.gradeAmount,
    caption: state.caption,
    subtitle: state.subtitle,
    letterTheme: state.letterTheme,
    captionScale: state.captionScale,
    badgeOn: state.badgeOn,
    badgeText: state.badgeText,
    stars: state.stars,
    grainOn: state.grain,
    vignetteOn: state.vignette,
    W,
    H,
    panelCanvas,
    panelState: (i) => state.panels[i] || blankPanel(-1),
  };
}

function render() {
  const { w, h } = SIZES[state.sizeKey];
  if (stage.width !== w || stage.height !== h) {
    stage.width = w;
    stage.height = h;
  }
  drawCover(sctx, makeView(w, h), w, h);
  drawSelection(w, h);
}

function drawSelection(W, H) {
  const rects = panelRects(layout(), W, H);
  const i = state.selectedPanel;
  const panel = rects[i];
  if (!panel || i === layout().titleCell) return;
  sctx.save();
  if (panel.rot) {
    sctx.translate(panel.px + panel.pw / 2, panel.py + panel.ph / 2);
    sctx.rotate(panel.rot);
    sctx.translate(-(panel.px + panel.pw / 2), -(panel.py + panel.ph / 2));
  }
  sctx.lineWidth = Math.max(2, W * 0.0022);
  sctx.setLineDash([14, 9]);
  sctx.strokeStyle = '#ff2e88';
  sctx.strokeRect(panel.px + 3, panel.py + 3, panel.pw - 6, panel.ph - 6);
  sctx.setLineDash([]);
  sctx.restore();
}

// ---------- history ----------

const undoStack = [];
const redoStack = [];

function snapshot() {
  return JSON.stringify({
    sizeKey: state.sizeKey,
    layoutId: state.layoutId,
    gradeId: state.gradeId,
    gradeAmount: state.gradeAmount,
    ink: state.ink,
    grain: state.grain,
    vignette: state.vignette,
    caption: state.caption,
    subtitle: state.subtitle,
    letterTheme: state.letterTheme,
    captionScale: state.captionScale,
    badgeOn: state.badgeOn,
    badgeText: state.badgeText,
    stars: state.stars,
    panels: state.panels,
    selectedPanel: state.selectedPanel,
  });
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  syncHistoryButtons();
}

function applySnapshot(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  gradeCache.clear();
  ensurePanels(false);
  syncUI();
  render();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  applySnapshot(undoStack.pop());
  syncHistoryButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  applySnapshot(redoStack.pop());
  syncHistoryButtons();
}

function syncHistoryButtons() {
  $('undoBtn').disabled = !undoStack.length;
  $('redoBtn').disabled = !redoStack.length;
}

// ---------- UI sync ----------

function syncUI() {
  $('sizeSel').value = state.sizeKey;
  $('captionInput').value = state.caption;
  $('subtitleInput').value = state.subtitle;
  $('letterSel').value = state.letterTheme;
  $('captionSize').value = Math.round(state.captionScale * 100);
  $('gradeAmt').value = Math.round(state.gradeAmount * 100);
  $('inkToggle').checked = state.ink;
  $('grainToggle').checked = state.grain;
  $('vigToggle').checked = state.vignette;
  $('badgeToggle').checked = state.badgeOn;
  $('badgeInput').value = state.badgeText;
  $('starsRange').value = state.stars;
  $('starsVal').textContent = String(state.stars);
  document.querySelectorAll('#layoutChips button').forEach((b) => b.classList.toggle('active', b.dataset.id === state.layoutId));
  document.querySelectorAll('#gradeChips button').forEach((b) => b.classList.toggle('active', b.dataset.id === state.gradeId));
  syncPanelUI();
  syncTray();
}

function syncPanelUI() {
  const i = state.selectedPanel;
  const p = state.panels[i];
  const count = state.panels.length;
  $('panelName').textContent = `Panel ${i + 1} of ${count}`;
  $('panelPhotoName').textContent = p && p.photo >= 0 && photos[p.photo] ? photos[p.photo].name : 'No photo yet — pick one from the tray';
  if (p) {
    $('zoomRange').value = Math.round(p.zoom * 100);
    $('xRange').value = Math.round(p.ox * 100);
    $('yRange').value = Math.round(p.oy * 100);
    $('panelSpreadToggle').checked = !!p.spread;
  }
}

function syncTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.className = 'thumb' + (i === state.selectedPhoto ? ' active' : '');
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.name;
    const label = document.createElement('span');
    label.textContent = photo.name;
    btn.append(img, label);
    btn.title = `Put ${photo.name} in the selected panel`;
    btn.addEventListener('click', () => {
      state.selectedPhoto = i;
      const p = state.panels[state.selectedPanel];
      if (p) {
        p.photo = i;
        pushHistory();
      }
      syncTray();
      syncPanelUI();
      render();
    });
    tray.append(btn);
  });
}

// ---------- photo loading ----------

function loadPhoto(src, name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ img, name });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function addUserPhotos(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    const photo = await loadPhoto(dataUrl, file.name.replace(/\.[^.]+$/, ''));
    if (photo) {
      photos.push(photo);
      state.selectedPhoto = photos.length - 1;
      const p = state.panels[state.selectedPanel];
      if (p && p.photo < 0) p.photo = state.selectedPhoto;
    }
  }
  pushHistory();
  syncTray();
  syncPanelUI();
  render();
}

// ---------- export ----------

function renderToCanvas(sizeKey) {
  const { w, h } = SIZES[sizeKey];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas.getContext('2d'), makeView(w, h), w, h);
  return canvas;
}

function exportPNG(sizeKey) {
  renderToCanvas(sizeKey).toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-palms-cover-${sizeKey}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

// A small handle for embedding and for the studio's own screenshot runs:
// renders a cover exactly as the Export button does.
window.neonPalms = {
  exportDataURL: (sizeKey) => renderToCanvas(sizeKey || state.sizeKey).toDataURL('image/png'),
  sizes: Object.keys(SIZES),
};

// ---------- pointer editing ----------

function stagePoint(evt) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((evt.clientX - rect.left) / rect.width) * stage.width,
    y: ((evt.clientY - rect.top) / rect.height) * stage.height,
  };
}

function hitPanel(x, y) {
  const rects = panelRects(layout(), stage.width, stage.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    if (i === layout().titleCell) continue;
    const p = rects[i];
    let lx = x;
    let ly = y;
    if (p.rot) {
      const cx = p.px + p.pw / 2;
      const cy = p.py + p.ph / 2;
      const dx = x - cx;
      const dy = y - cy;
      const cos = Math.cos(-p.rot);
      const sin = Math.sin(-p.rot);
      lx = cx + dx * cos - dy * sin;
      ly = cy + dx * sin + dy * cos;
    }
    if (lx >= p.px && lx <= p.px + p.pw && ly >= p.py && ly <= p.py + p.ph) return i;
  }
  return -1;
}

let drag = null;

stage.addEventListener('pointerdown', (evt) => {
  const pt = stagePoint(evt);
  const hit = hitPanel(pt.x, pt.y);
  if (hit < 0) return;
  if (hit !== state.selectedPanel) {
    state.selectedPanel = hit;
    syncPanelUI();
    syncTray();
    render();
  }
  const p = state.panels[hit];
  drag = { panel: hit, startX: pt.x, startY: pt.y, ox: p.ox, oy: p.oy, moved: false };
  stage.setPointerCapture(evt.pointerId);
});

stage.addEventListener('pointermove', (evt) => {
  if (!drag) return;
  const pt = stagePoint(evt);
  const dx = pt.x - drag.startX;
  const dy = pt.y - drag.startY;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  const p = state.panels[drag.panel];
  const src = panelCanvas(drag.panel);
  if (!src || !p) return;
  const rects = panelRects(layout(), stage.width, stage.height);
  const r = rects[drag.panel];
  if (p.spread) {
    const scale = Math.max(stage.width / src.width, stage.height / src.height) * Math.max(1, p.zoom);
    const dw = src.width * scale;
    const dh = src.height * scale;
    if (dw > stage.width) p.ox = clamp(drag.ox + (dx * 2) / (stage.width - dw) * -1, -1, 1);
    if (dh > stage.height) p.oy = clamp(drag.oy + (dy * 2) / (stage.height - dh) * -1, -1, 1);
  } else {
    const s = coverSourceRect(src.width, src.height, r.pw, r.ph, p.zoom, drag.ox, drag.oy);
    const slackX = src.width - s.sw;
    const slackY = src.height - s.sh;
    if (slackX > 0.5) p.ox = clamp(drag.ox - (dx / s.scale) * (2 / slackX), -1, 1);
    if (slackY > 0.5) p.oy = clamp(drag.oy - (dy / s.scale) * (2 / slackY), -1, 1);
  }
  syncPanelUI();
  render();
});

stage.addEventListener('pointerup', () => {
  if (drag && drag.moved) pushHistory();
  drag = null;
});

let wheelTimer = null;
stage.addEventListener(
  'wheel',
  (evt) => {
    evt.preventDefault();
    const pt = stagePoint(evt);
    const hit = hitPanel(pt.x, pt.y);
    const i = hit >= 0 ? hit : state.selectedPanel;
    const p = state.panels[i];
    if (!p) return;
    if (i !== state.selectedPanel) {
      state.selectedPanel = i;
      syncPanelUI();
    }
    p.zoom = clamp(p.zoom * Math.exp(-evt.deltaY * 0.0012), 1, 4);
    syncPanelUI();
    render();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(pushHistory, 450);
  },
  { passive: false },
);

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------- build the controls ----------

function buildChips() {
  const layoutBox = $('layoutChips');
  for (const l of LAYOUTS) {
    const btn = document.createElement('button');
    btn.dataset.id = l.id;
    btn.innerHTML = `<strong></strong><small></small>`;
    btn.querySelector('strong').textContent = l.name;
    btn.querySelector('small').textContent = l.blurb;
    btn.addEventListener('click', () => {
      if (state.layoutId === l.id) return;
      state.layoutId = l.id;
      ensurePanels(true);
      pushHistory();
      syncUI();
      render();
    });
    layoutBox.append(btn);
  }
  const gradeBox = $('gradeChips');
  for (const g of GRADES) {
    const btn = document.createElement('button');
    btn.dataset.id = g.id;
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = `linear-gradient(90deg, ${g.stops.map(([t, c]) => `${c} ${Math.round(t * 100)}%`).join(', ')})`;
    const label = document.createElement('span');
    label.textContent = g.name;
    btn.append(swatch, label);
    btn.addEventListener('click', () => {
      if (state.gradeId === g.id) return;
      state.gradeId = g.id;
      gradeCache.clear();
      pushHistory();
      syncUI();
      render();
    });
    gradeBox.append(btn);
  }
  const letterSel = $('letterSel');
  for (const [id, theme] of Object.entries(LETTER_THEMES)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = theme.name;
    letterSel.append(opt);
  }
  const sizeSel = $('sizeSel');
  for (const s of Object.values(SIZES)) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.name} — ${s.label}`;
    sizeSel.append(opt);
  }
  const quick = $('quickExport');
  for (const s of Object.values(SIZES)) {
    const btn = document.createElement('button');
    btn.textContent = `PNG ${s.label}`;
    btn.addEventListener('click', () => exportPNG(s.id));
    quick.append(btn);
  }
}

function bindControls() {
  $('sizeSel').addEventListener('change', (e) => {
    state.sizeKey = e.target.value;
    pushHistory();
    render();
  });
  $('exportBtn').addEventListener('click', () => exportPNG(state.sizeKey));
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    }
  });
  const textBind = (id, key) => {
    $(id).addEventListener('input', (e) => {
      state[key] = e.target.value;
      render();
    });
    $(id).addEventListener('change', pushHistory);
  };
  textBind('captionInput', 'caption');
  textBind('subtitleInput', 'subtitle');
  textBind('badgeInput', 'badgeText');
  $('letterSel').addEventListener('change', (e) => {
    state.letterTheme = e.target.value;
    pushHistory();
    render();
  });
  $('captionSize').addEventListener('input', (e) => {
    state.captionScale = Number(e.target.value) / 100;
    render();
  });
  $('captionSize').addEventListener('change', pushHistory);
  $('gradeAmt').addEventListener('input', (e) => {
    state.gradeAmount = Number(e.target.value) / 100;
    gradeCache.clear();
    render();
  });
  $('gradeAmt').addEventListener('change', pushHistory);
  const toggleBind = (id, key, after) => {
    $(id).addEventListener('change', (e) => {
      state[key] = e.target.checked;
      if (after) after();
      pushHistory();
      render();
    });
  };
  toggleBind('inkToggle', 'ink', () => gradeCache.clear());
  toggleBind('grainToggle', 'grain');
  toggleBind('vigToggle', 'vignette');
  toggleBind('badgeToggle', 'badgeOn');
  $('starsRange').addEventListener('input', (e) => {
    state.stars = Number(e.target.value);
    $('starsVal').textContent = e.target.value;
    render();
  });
  $('starsRange').addEventListener('change', pushHistory);
  const panelRange = (id, apply) => {
    $(id).addEventListener('input', (e) => {
      const p = state.panels[state.selectedPanel];
      if (!p) return;
      apply(p, Number(e.target.value) / 100);
      render();
    });
    $(id).addEventListener('change', pushHistory);
  };
  panelRange('zoomRange', (p, v) => (p.zoom = clamp(v, 1, 4)));
  panelRange('xRange', (p, v) => (p.ox = clamp(v, -1, 1)));
  panelRange('yRange', (p, v) => (p.oy = clamp(v, -1, 1)));
  $('panelSpreadToggle').addEventListener('change', (e) => {
    const p = state.panels[state.selectedPanel];
    if (!p) return;
    p.spread = e.target.checked;
    pushHistory();
    render();
  });
  $('addPhotosBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    addUserPhotos([...e.target.files]);
    e.target.value = '';
  });
  $('spreadBtn').addEventListener('click', () => {
    const idx = state.selectedPhoto;
    state.panels.forEach((p) => {
      p.photo = idx;
      p.spread = true;
    });
    pushHistory();
    syncPanelUI();
    render();
  });
  $('shuffleBtn').addEventListener('click', () => {
    state.panels.forEach((p, i) => {
      if (i === layout().titleCell) return;
      p.photo = Math.floor(Math.random() * photos.length);
      p.spread = false;
      p.zoom = 1;
      p.ox = 0;
      p.oy = 0;
    });
    pushHistory();
    syncPanelUI();
    render();
  });
  stage.addEventListener('dragover', (e) => e.preventDefault());
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    addUserPhotos([...e.dataTransfer.files]);
  });
}

// ---------- go ----------

async function init() {
  buildChips();
  bindControls();
  ensurePanels(true);
  const loaded = await Promise.all(SAMPLES.map((s) => loadPhoto(s.src, s.name)));
  loaded.forEach((photo) => {
    if (photo) photos.push(photo);
  });
  try {
    await Promise.race([
      Promise.all([document.fonts.load('80px Anton'), document.fonts.load('80px Pacifico')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fonts fall back to sans; the render still works */
  }
  syncUI();
  render();
  document.body.dataset.ready = '1';
}

init();
