import { describe, it, expect } from 'vitest';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// dynamic import for ESM packages that may expose default/commonjs forms
async function imp(name){
  const m = await import(name);
  return m.default || m;
}

describe('notepack zip creation', () => {
  it('creates and reads a minimal notepack zip', async () => {
    const yazl = await imp('yazl');
    const yauzl = await imp('yauzl');

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nt-test-'));
    const outFile = path.join(tmp, `session-${randomUUID()}.notepack`);

    const meta = { createdAt: new Date().toISOString(), mediaFile: 'media.webm', notesFile: 'notes.html', version: 1 };

    const zipfile = new yazl.ZipFile();
    zipfile.addBuffer(Buffer.from('<p>hello notes</p>', 'utf-8'), 'notes.html');
    zipfile.addBuffer(Buffer.from('fake-media-data'), 'media.webm');
    zipfile.addBuffer(Buffer.from(JSON.stringify(meta), 'utf-8'), 'session.json');

    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(outFile);
      zipfile.outputStream.pipe(ws).on('close', resolve).on('error', reject);
      zipfile.end();
    });

    // read back
    const entries = {};
    await new Promise((resolve, reject) => {
      yauzl.open(outFile, { lazyEntries: true }, (err, zf) => {
        if (err) return reject(err);
        zf.readEntry();
        zf.on('entry', (entry) => {
          if (/\/$/.test(entry.fileName)) { zf.readEntry(); return; }
          zf.openReadStream(entry, (err2, rs) => {
            if (err2) return reject(err2);
            const chunks = [];
            rs.on('data', c => chunks.push(c));
            rs.on('end', () => {
              entries[entry.fileName] = Buffer.concat(chunks);
              zf.readEntry();
            });
          });
        });
        zf.on('end', resolve);
        zf.on('error', reject);
      });
    });

    expect(Object.keys(entries).sort()).toEqual(['media.webm','notes.html','session.json']);
    expect(entries['notes.html'].toString('utf-8')).toContain('hello notes');
    const readMeta = JSON.parse(entries['session.json'].toString('utf-8'));
    expect(readMeta.version).toBe(1);
    expect(readMeta.mediaFile).toBe('media.webm');
  });
});
