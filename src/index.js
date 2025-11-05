import 'dotenv/config';
import { loadPrompts } from './utils/csv.js';
import { generateImages } from './firefly.js';
import { info, error } from './utils/logger.js';

async function main() {
  const file = process.env.PROMPT_FILE;
  if (!file) throw new Error('PROMPT_FILE missing in env');

  const prompts = await loadPrompts(file);
  info(`Loaded ${prompts.length} prompts from ${file}`);

  await generateImages(prompts);
}

main().catch((e) => {
  error(e.stack || e.message);
  process.exit(1);
});
