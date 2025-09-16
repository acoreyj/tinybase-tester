### Tinybase Tester Monorepo

This repo contains:
- **Astro app** (`packages/astro`) rendering Tinybase tables in React.
- **Tinybase WebSocket server** (`packages/tinybase-server`) running on Cloudflare Workers (via Wrangler).

### Prerequisites
- pnpm: install from `https://pnpm.io/installation`.

### Install
```bash
pnpm install
```

### Run the Tinybase server (local)
```bash
pnpm run dev-tinybase-server
```
This starts a local Worker (default `http://localhost:8787` with WS at `ws://localhost:8787`).

### Configure Astro to point at the server
Create `packages/astro/.env` with:
```bash
TINYBASE_SERVER=ws://localhost:8787
```
The Astro app reads `TINYBASE_SERVER` on the client (see `packages/astro/astro.config.mjs`).

### Start the Astro app
In a separate terminal:
```bash
pnpm run dev
```
This runs `@tinybase-tester/astro` dev server. Open the printed URL and verify tables load and sync (no console errors; rows appear in the Tinybase tables).

### Deploy the Tinybase server
```bash
pnpm run deploy-tinybase-server
```
Copy the deployed hostname (e.g. `https://your-worker.example.workers.dev`). The WS endpoint is the same origin using `wss://`.

Update `packages/astro/.env`:
```bash
TINYBASE_SERVER=wss://your-worker.example.workers.dev
```

Restart Astro dev if it’s running, then retest the app.

### Scripts (root)
- `pnpm run dev`: start Astro app
- `pnpm run dev-tinybase-server`: start local Tinybase server
- `pnpm run deploy-tinybase-server`: deploy the server to Cloudflare

### Notes
- The client connects to `${TINYBASE_SERVER}/tinybase` over WebSocket.
- If using a custom port/origin, ensure CORS/WS allowed by Wrangler defaults.

