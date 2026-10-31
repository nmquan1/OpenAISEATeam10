// Compatibility entry: Vite owns the dependency graph and build output.
import { spawnSync } from 'node:child_process';
const result = spawnSync('npm', ['run', 'build', '--workspace', '@market-maker/frontend'], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url),
});
process.exit(result.status ?? 1);
