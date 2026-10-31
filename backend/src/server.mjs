import {createApp} from './api/app.mjs';
try {process.loadEnvFile(new URL('../../.env', import.meta.url));} catch(error) {if(error.code !== 'ENOENT') throw error;}
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
const server = createApp({apiToken:process.env.MARKET_MAKER_API_TOKEN ?? ''});
server.on('error',error=>{console.error(`Server failed: ${error.code ?? error.name}`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Market Maker: http://localhost:${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.once(signal,()=>{
  server.close(()=>process.exit(0));
  setTimeout(()=>{server.closeAllConnections();process.exit(1);},10000).unref();
});
