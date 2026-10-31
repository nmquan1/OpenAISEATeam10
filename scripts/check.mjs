import {readdir} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {spawnSync} from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
function run(command, args) {
  const result = spawnSync(command, args, {cwd:root, stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
async function checkDirectory(directory) {
  const entries = await readdir(directory, {withFileTypes:true});
  for (const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
    if (entry.name === 'node_modules') continue;
    const path = resolve(directory,entry.name);
    if (entry.isDirectory()) await checkDirectory(path);
    else if (['.js','.mjs'].includes(extname(entry.name))) run(process.execPath,['--check',path]);
  }
}
for (const directory of ['backend','frontend','contracts','scripts']) await checkDirectory(resolve(root,directory));
run('npm',['test']);
run('npm',['run','build']);
