import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function copyIfExists(from, to) {
  try { await fs.copyFile(from, to); console.log('Copied', path.basename(from)); return true; }
  catch { return false; }
}

async function main() {
  const srcDir = path.resolve(__dirname, '../node_modules/quill/dist');
  const dstDir = path.resolve(__dirname, '../vendor');
  await fs.mkdir(dstDir, { recursive: true });

  const okJS = await copyIfExists(path.join(srcDir, 'quill.min.js'), path.join(dstDir, 'quill.js'))
            || await copyIfExists(path.join(srcDir, 'quill.js'),     path.join(dstDir, 'quill.js'));
  if (!okJS) throw new Error('Could not find quill(.min).js in node_modules/quill/dist');

  await copyIfExists(path.join(srcDir, 'quill.snow.css'), path.join(dstDir, 'quill.snow.css'));
  await copyIfExists(path.join(srcDir, 'quill.core.css'), path.join(dstDir, 'quill.core.css'));
}

main().catch(e => { console.error('Failed to copy Quill assets:', e); process.exit(1); });
