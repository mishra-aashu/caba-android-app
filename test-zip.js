import fs from 'fs';
import archiver from 'archiver';
import packageJson from './package.json' with { type: 'json' };

const version = packageJson.version;
const timestamp = Date.now().toString();
const zipFileName = `ota-${version}-${timestamp}.zip`;

const output = fs.createWriteStream(zipFileName);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log(archive.pointer() + ' total bytes');
  console.log('archiver has been finalized and the output file descriptor has closed.');
});

archive.pipe(output);
archive.directory('dist/', false);
archive.finalize();
