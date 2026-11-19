// Neon Palms Cover Studio — the hand-in program for gta6-cover-art-01.
//
// The studio itself is the static web app in app/ (plain files a desktop
// browser runs offline; no build step, no network). This program's whole
// job is to hand that app in: copy app/ and screenshots/ from this
// repository into the output directory and write the dossier the judge
// reads, using the kit's vendored library so the bytes match the scorer's
// own rebuild. Node 22, standard library only.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });

// The app, exactly as it sits in the repository.
cpSync(join(repoDir, 'app'), join(outputDir, 'app'), { recursive: true });

// The screenshots: the cover first by name, then the editor and the other
// exported covers.
const shotsDir = join(repoDir, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier, under the scorer's own caps: at most 4 screenshots of
// 256 KiB, at most 993 files and 48 MiB under app/, no app path over
// 1,000 bytes, and the dossier text capped at 160 KiB.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
