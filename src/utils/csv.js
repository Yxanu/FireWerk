import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';

export async function loadPrompts(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const raw = await fs.readFile(filePath, 'utf8');
  if (ext === 'csv') return parse(raw, { columns: true, skip_empty_lines: true });
  if (ext === 'json') return JSON.parse(raw);
  throw new Error(`Unsupported input format: ${ext}`);
}
