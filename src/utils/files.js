import fs from 'fs/promises';
import path from 'path';

export async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

export function safeName(v) {
  return String(v).replace(/[^\w\d-_]+/g, '_').slice(0, 120);
}

export function buildOutPath(baseDir, promptId, variantIdx, ext='jpg') {
  return path.join(baseDir, `${safeName(promptId)}_${variantIdx}.${ext}`);
}
