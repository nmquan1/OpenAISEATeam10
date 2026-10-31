import { spawn } from 'node:child_process';
const child = spawn('npm', ['start'], { stdio: 'inherit', cwd: new URL('..', import.meta.url) });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
