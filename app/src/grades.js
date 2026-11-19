// Colour grades for Neon Palms. A grade is a gradient map: each photo's
// luminance is pushed through the grade's colour stops, blended with a
// saturated, contrast-lifted copy of the photo itself. The same stops paint
// the title block, so a cover's photos and its lettering share one palette.

export const GRADES = [
  {
    id: 'vice-sunset',
    name: 'Vice Sunset',
    sat: 1.24,
    contrast: 1.07,
    stops: [
      [0.0, '#150826'],
      [0.3, '#5c1a54'],
      [0.55, '#c22e63'],
      [0.78, '#ff7a3d'],
      [1.0, '#ffd98a'],
    ],
  },
  {
    id: 'neon-nights',
    name: 'Neon Nights',
    sat: 1.3,
    contrast: 1.1,
    stops: [
      [0.0, '#04060f'],
      [0.35, '#0e2a5c'],
      [0.6, '#7a1e6e'],
      [0.82, '#ff2e88'],
      [1.0, '#8ef6ff'],
    ],
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    sat: 1.18,
    contrast: 1.05,
    stops: [
      [0.0, '#1d0f02'],
      [0.4, '#6e3410'],
      [0.72, '#d9822b'],
      [1.0, '#ffe9b0'],
    ],
  },
  {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    sat: 1.28,
    contrast: 1.08,
    stops: [
      [0.0, '#0d0221'],
      [0.4, '#3b0f6e'],
      [0.72, '#8b2ff7'],
      [1.0, '#ff9de2'],
    ],
  },
  {
    id: 'teal-heat',
    name: 'Teal Heat',
    sat: 1.2,
    contrast: 1.06,
    stops: [
      [0.0, '#02181d'],
      [0.4, '#065a60'],
      [0.75, '#12b5a5'],
      [1.0, '#d9fff3'],
    ],
  },
  {
    id: 'newsprint',
    name: 'Newsprint Ink',
    sat: 0.12,
    contrast: 1.12,
    stops: [
      [0.0, '#101010'],
      [0.5, '#8a8a8a'],
      [1.0, '#f5efe0'],
    ],
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// A 256-entry RGB lookup table built from a grade's stops.
export function buildGradeLUT(grade) {
  const lut = new Uint8Array(256 * 3);
  const stops = grade.stops.map(([t, hex]) => [t, hexToRgb(hex)]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        a = stops[s];
        b = stops[s + 1];
        break;
      }
    }
    const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
    for (let k = 0; k < 3; k++) {
      lut[i * 3 + k] = Math.round(a[1][k] + (b[1][k] - a[1][k]) * f);
    }
  }
  return lut;
}

// Grade one photo into a canvas of its own (long side capped at 1600 px).
// amount 0..1 blends the gradient map in; inkLevels > 0 posterises the
// photo into flat ink bands before the map is applied.
export function gradePhotoToCanvas(img, grade, amount, inkLevels) {
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const lut = buildGradeLUT(grade);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const mix = amount * 0.62;
  const sat = grade.sat;
  const con = grade.contrast;
  const quant = inkLevels > 1 ? inkLevels - 1 : 0;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i];
    let g = px[i + 1];
    let b = px[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + (r - lum) * sat;
    g = lum + (g - lum) * sat;
    b = lum + (b - lum) * sat;
    r = (r - 128) * con + 128;
    g = (g - 128) * con + 128;
    b = (b - 128) * con + 128;
    if (quant) {
      r = Math.round((r / 255) * quant) * (255 / quant);
      g = Math.round((g / 255) * quant) * (255 / quant);
      b = Math.round((b / 255) * quant) * (255 / quant);
    }
    const li = Math.max(0, Math.min(255, Math.round(lum))) * 3;
    px[i] = r + (lut[li] - r) * mix;
    px[i + 1] = g + (lut[li + 1] - g) * mix;
    px[i + 2] = b + (lut[li + 2] - b) * mix;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

// A vertical CSS-style gradient built from the same stops, for the title
// block and lettering fills.
export function gradeGradient(ctx, grade, x0, y0, x1, y1) {
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, hex] of grade.stops) grad.addColorStop(t, hex);
  return grad;
}
