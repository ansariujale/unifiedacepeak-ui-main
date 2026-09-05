import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import tailwindcss from "@tailwindcss/vite";

const enableCrossOriginIsolation = process.env.VITE_CROSS_ORIGIN_ISOLATION === 'true';

// On the deployment server the .env files live outside the repo (real secrets —
// Stripe, PayPal, HubSpot, WhatsApp token, Turnstile — shouldn't sit in a
// project directory that could end up in version control or get shared).
//
// That path only exists on the server, and pointing envDir at a directory that
// isn't there loads no variables at all rather than falling back: every
// VITE_* value came through undefined, so axios had no baseURL, the org
// metadata request failed and the app rendered the maintenance screen. On a
// local checkout fall back to the project root and read the .env there.
const SERVER_ENV_DIR = '/etc/mycountrymobile-web';
const envDir = fs.existsSync(SERVER_ENV_DIR) ? SERVER_ENV_DIR : undefined;

// Origin the API recognises as this deployment's tenant; see the dev proxy below.
const TENANT_ORIGIN = process.env.VITE_DEV_PROXY_ORIGIN || 'https://ucaas.acepeak.com';

export default defineConfig({
  envDir,
  define: {
    global: 'globalThis',
    Lame: {},
    Presets: {},
    GainAnalysis: {},
    QuantizePVT: {},
    Quantize: {},
    Takehiro: {},
    Reservoir: {},
    MPEGMode: {},
    BitStream: {},
    assetsInclude: ['**/*.wasm'],
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: enableCrossOriginIsolation
      ? {
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Opener-Policy': 'same-origin',
        }
      : undefined,
    // Dev only — Vite's proxy is not part of `vite build`, so this changes
    // nothing about how the deployed app reaches the API.
    //
    // The backend answers preflights with Allow-Credentials, Allow-Methods,
    // Allow-Headers and Max-Age but never Access-Control-Allow-Origin, so a
    // browser rejects every cross-origin response from it and the app renders
    // the maintenance screen. Proxying makes the request same-origin from the
    // browser's point of view: it goes to localhost and Vite forwards it
    // server-side, where CORS does not apply. Leave VITE_API_BASE_URL empty in
    // the local .env for this to be used.
    proxy: {
      '/api': {
        target: 'https://api2.acepeak.com',
        changeOrigin: true,
        // The API resolves which tenant ("website settings") a request belongs
        // to from Origin/Referer, not from the path or anything the app sends.
        // changeOrigin only rewrites Host, so a proxied dev request still
        // arrives with Origin http://localhost:5173, matches no site and comes
        // back 422 "Website settings not found" — which the login screen
        // reports as bad credentials even when they are correct. Present the
        // deployed domain so local dev hits the same tenant as production.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', TENANT_ORIGIN);
            proxyReq.setHeader('referer', `${TENANT_ORIGIN}/`);
          });
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.wasm')) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
