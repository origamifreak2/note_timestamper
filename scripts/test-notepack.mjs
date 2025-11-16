import fs from 'fs';
import path from 'path';

(async function(){
  const yazl = (await import('yazl')).default || (await import('yazl'));
  const yauzl = (await import('yauzl')).default || (await import('yauzl'));

  const outFile = path.join(process.cwd(), 'scripts','test_session.notepack');
  const zipfile = new yazl.ZipFile();
  zipfile.addBuffer(Buffer.from('<p>hello notes</p>','utf-8'),'notes.html');
  zipfile.addBuffer(Buffer.from('fake-media-data'),'media.webm');
  zipfile.addBuffer(Buffer.from(JSON.stringify({createdAt:new Date().toISOString(),mediaFile:'media.webm',notesFile:'notes.html',version:1},null,2)),'session.json');

  const outStream = fs.createWriteStream(outFile);
  zipfile.outputStream.pipe(outStream).on('close', async ()=>{
    console.log('WROTE', outFile);
    // now read back
    yauzl.open(outFile, {lazyEntries:true}, (err, zf)=>{
      if(err) return console.error('open err', err);
      zf.readEntry();
      const entries = {};
      zf.on('entry', (entry)=>{
        if(/\/$/.test(entry.fileName)){ zf.readEntry(); return; }
        zf.openReadStream(entry, (err, rs)=>{
          if(err) return console.error('readstream err', err);
          const chunks = [];
          rs.on('data', c=>chunks.push(c));
          rs.on('end', ()=>{
            entries[entry.fileName] = Buffer.concat(chunks);
            zf.readEntry();
          });
        });
      });
      zf.on('end', ()=>{
        console.log('READ entries', Object.keys(entries));
        console.log('notes.html:', entries['notes.html'].toString('utf-8'));
        console.log('meta:', entries['session.json'].toString('utf-8'));
      });
    });
  });
  zipfile.end();
})();