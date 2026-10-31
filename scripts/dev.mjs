import { spawn } from 'node:child_process';
const children = ['@market-maker/backend', '@market-maker/frontend'].map((workspace) =>
  spawn('npm', ['run', 'dev', '--workspace', workspace], { stdio: 'inherit' }),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) child.on('exit', (code) => stop(code ?? 1));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
