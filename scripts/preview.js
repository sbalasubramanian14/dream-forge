// Explicitly headed preview for local visual review; no agent credentials needed.
import { chromium } from '@playwright/test';
import { startServer } from '../src/server.js';
import { getPort, request } from '../src/client.js';
let server;
try {server=await startServer(getPort());}
catch(error) {if(error.code!=='EADDRINUSE'||(await request('health')).app!=='dream-forge')throw error;}
const browser=await chromium.launch({headless:false});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.goto(`http://127.0.0.1:${getPort()}`);
console.log('Dream Forge preview is open. Close the browser when finished.');
await new Promise(resolve=>browser.on('disconnected',resolve));
server?.closeAllConnections();server?.close();
