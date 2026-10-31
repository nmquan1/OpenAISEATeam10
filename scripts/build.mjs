import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
await rm(dist, {recursive:true, force:true});
await mkdir(resolve(dist,'engine'), {recursive:true});
await mkdir(resolve(dist,'contracts'), {recursive:true});
await mkdir(resolve(dist,'docs'), {recursive:true});
await cp(resolve(root,'frontend/index.html'), resolve(dist,'index.html'));
await cp(resolve(root,'frontend/src'), resolve(dist,'src'), {recursive:true});
// The static preview shares the deterministic engine without shipping server code.
const engine = await readFile(resolve(root,'backend/src/engine/index.js'), 'utf8');
await writeFile(resolve(dist,'engine/index.js'), engine.replaceAll('../../../contracts/', '../contracts/'));
await cp(resolve(root,'contracts/model.js'), resolve(dist,'contracts/model.js'));
// Explicit public-document allowlist excludes internal planning and agent strategy.
for (const name of ['research.md','architecture.md','data-contract.md','api.md']) {
  const source = resolve(root,'docs',name);
  try {await cp(source, resolve(dist,'docs',name));}
  catch (error) {if(error.code !== 'ENOENT') throw error;}
}
console.log('Built static scenario preview in dist/ (AI requires the backend).');
