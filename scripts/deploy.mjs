// Opt-in deployment only; CI supplies the secret and the already-tested commit SHA.
const hook = process.env.RENDER_DEPLOY_HOOK_URL;
if (!hook) {
  console.log('No Render hook configured; deployment skipped.');
  process.exit(0);
}
const url = new URL(hook);
if (url.protocol !== 'https:' || url.hostname !== 'api.render.com')
  throw new Error('Expected an HTTPS Render deployment hook.');
url.searchParams.set('ref', process.env.GITHUB_SHA ?? '');
if (!url.searchParams.get('ref')) throw new Error('Tested commit SHA required.');
const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Deployment request failed (${response.status}).`);
console.log('Render accepted deployment of the tested commit; check its rollout health in Render.');
