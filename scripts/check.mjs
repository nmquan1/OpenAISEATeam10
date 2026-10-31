import { spawnSync } from 'node:child_process';
const result = spawnSync('npm', ['run', 'check'], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url),
});
process.exit(result.status ?? 1);
