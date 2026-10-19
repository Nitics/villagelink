// Serves the e2e build and runs the browser test: npm run e2e
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

mkdirSync('tests/shots', { recursive: true });
const server = await preview({ preview: { port: 4173, strictPort: true }, build: { outDir: 'dist-e2e' } });
process.env.APP_URL = 'http://localhost:4173/';
process.env.SHOTS = 'tests/shots/';
process.on('exit', () => server.httpServer.close());
await import('./e2e.mjs');
