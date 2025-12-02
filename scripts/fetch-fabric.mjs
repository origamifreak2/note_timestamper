import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function copyIfExists(from, to) {
  try {
    await fs.copyFile(from, to);
    console.log('Copied', path.basename(from));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const srcDir = path.resolve(__dirname, '../node_modules/fabric/dist');
  const dstDir = path.resolve(__dirname, '../vendor');
  await fs.mkdir(dstDir, { recursive: true });

  const okJS =
    (await copyIfExists(path.join(srcDir, 'index.min.js'), path.join(dstDir, 'fabric.js'))) ||
    (await copyIfExists(path.join(srcDir, 'index.js'), path.join(dstDir, 'fabric.js')));
  if (!okJS) throw new Error('Could not find fabric index(.min).js in node_modules/fabric/dist');
}

main().catch((e) => {
  console.error('Failed to copy Fabric.js assets:', e);
  process.exit(1);
});
