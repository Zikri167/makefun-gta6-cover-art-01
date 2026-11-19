// Panel layouts for Neon Palms covers. Every layout describes its panels as
// fractions of the cover (x, y, w, h in 0..1), so one layout works at every
// export size. A layout may reserve one panel as the title cell, where the
// caption is lettered on a graded block instead of over a photo, and says
// where an overlay caption anchors when there is no title cell.

function gridPanels(cols, rows, margin) {
  const panels = [];
  const cw = (1 - margin * 2) / cols;
  const ch = (1 - margin * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      panels.push({ x: margin + c * cw, y: margin + r * ch, w: cw, h: ch });
    }
  }
  return panels;
}

export const LAYOUTS = [
  {
    id: 'nine-grid',
    name: 'Nine Grid',
    blurb: 'The classic nine-panel cover with a lettered title block.',
    titleCell: 4,
    captionZone: 'cell',
    panels() {
      return gridPanels(3, 3, 0.028);
    },
  },
  {
    id: 'hero-three',
    name: 'Hero + Three',
    blurb: 'One big hero panel with three beats stacked beside it.',
    titleCell: -1,
    captionZone: 'bottom',
    panels() {
      const m = 0.028;
      const heroW = 0.575;
      const sideX = m + heroW + 0.016;
      const sideW = 1 - m - sideX;
      const sideH = (1 - m * 2) / 3;
      return [
        { x: m, y: m, w: heroW, h: 1 - m * 2 },
        { x: sideX, y: m, w: sideW, h: sideH },
        { x: sideX, y: m + sideH, w: sideW, h: sideH },
        { x: sideX, y: m + sideH * 2, w: sideW, h: sideH },
      ];
    },
  },
  {
    id: 'top-story',
    name: 'Top Story',
    blurb: 'A wide scene up top, three panels underneath, title over the sky.',
    titleCell: -1,
    captionZone: 'top',
    panels() {
      const m = 0.028;
      const topH = 0.52;
      const botY = m + topH + 0.016;
      const botH = 1 - m - botY;
      const cw = (1 - m * 2 - 0.032) / 3;
      return [
        { x: m, y: m, w: 1 - m * 2, h: topH },
        { x: m, y: botY, w: cw, h: botH },
        { x: m + cw + 0.016, y: botY, w: cw, h: botH },
        { x: m + (cw + 0.016) * 2, y: botY, w: cw, h: botH },
      ];
    },
  },
  {
    id: 'six-pack',
    name: 'Six Pack',
    blurb: 'Two columns of three, title riding over the top row.',
    titleCell: -1,
    captionZone: 'top',
    panels() {
      return gridPanels(2, 3, 0.028);
    },
  },
  {
    id: 'full-bleed',
    name: 'Full Bleed',
    blurb: 'A single photo edge to edge with the title over a scrim.',
    titleCell: -1,
    captionZone: 'bottom',
    panels() {
      return [{ x: 0.014, y: 0.014, w: 0.972, h: 0.972 }];
    },
  },
  {
    id: 'snap-tilt',
    name: 'Tilted Snaps',
    blurb: 'Loose snapshots scattered over a full-frame scene.',
    titleCell: -1,
    captionZone: 'top',
    panels() {
      return [
        { x: 0, y: 0, w: 1, h: 1 },
        { x: 0.045, y: 0.335, w: 0.40, h: 0.46, rot: -0.105, frame: true },
        { x: 0.545, y: 0.295, w: 0.40, h: 0.46, rot: 0.085, frame: true },
        { x: 0.295, y: 0.565, w: 0.42, h: 0.375, rot: -0.038, frame: true },
      ];
    },
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}
