/*
 * Server-side proxy for the backend API, and the deployed counterpart of the
 * dev proxy in vite.config.ts. Everything below mirrors the reasoning there.
 *
 * Two things break when the built app talks to api2.acepeak.com straight from
 * the browser on a host the backend does not know (a *.vercel.app deployment,
 * for instance):
 *
 *   1. CORS. The API answers preflights but only echoes
 *      Access-Control-Allow-Origin for origins registered as a tenant, so the
 *      browser discards every response and the app renders the maintenance
 *      screen.
 *   2. Tenant resolution. The API matches the "website settings" record on the
 *      Origin/Referer of the request, so a request arriving with an unknown
 *      origin matches no site and comes back 422 "Website settings not found" -
 *      which the login screen reports as bad credentials even when they are
 *      correct.
 *
 * Routing the calls through this function fixes both: the browser talks only to
 * its own origin (CORS never applies), and the hop to the API is made here,
 * server-side, presenting the deployed tenant's own origin.
 *
 * For this to be used, VITE_API_BASE_URL must be empty in the deployment's
 * environment, exactly as it is in the local .env, so the app's requests stay
 * relative and land here. Set it to the API's absolute URL and the browser goes
 * there directly again, which is the CORS failure above.
 *
 * Written against the (req, res) signature rather than Web Request/Response:
 * it is the form every version of the Node runtime accepts.
 *
 * Reached through the /api/(.*) rewrite in vercel.json rather than by a
 * bracketed catch-all filename (api/[...path].js), which this project never
 * registered - every /api/* path answered with the platform's own NOT_FOUND
 * while a plain sibling file in the same directory served fine. The rewrite
 * hands the original path over in `path`, since the request that arrives here
 * names this file instead. Rewrites are consulted only after the filesystem,
 * so a real function file (api/ping.js) still wins over this one.
 */

const API_ORIGIN = stripTrailingSlash(process.env.API_PROXY_TARGET || 'https://api2.acepeak.com');
const TENANT_ORIGIN = stripTrailingSlash(
  process.env.API_PROXY_TENANT_ORIGIN || 'https://ucaas.acepeak.com',
);

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

/* Connection-level headers describe the hop that just ended, not the message,
   so they must not be replayed onto the next one. content-length goes with them
   because the body is re-sent here and fetch recomputes it; accept-encoding
   because letting the API compress for us would mean decompressing before the
   bytes could be handed back. */
const HOP_BY_HOP = new Set([
  'accept-encoding',
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/* Headers the platform adds on the way into this function, none of which the
   dev proxy this mirrors ever sends - so forwarding them makes the deployed
   request differ from the local one that works.

   x-forwarded-host is the harmful one: it names the deployment's own hostname,
   and a backend that trusts proxy headers will believe that over the Origin
   set below, which is the whole mechanism this proxy depends on. The
   x-forwarded-for/x-real-ip family is dropped for the same reason - a request
   should look like it comes from here, consistently, rather than carrying a
   client address the API may bind a one-time code to and then re-check from a
   different instance's address.

   x-vercel-oidc-token and the proxy signatures are dropped because they are
   credentials: they identify this deployment to the platform, and an API on
   someone else's host has no business receiving them. */
const isInjectedByPlatform = (name) =>
  name.startsWith('x-vercel-') ||
  name.startsWith('x-forwarded-') ||
  name === 'forwarded' ||
  name === 'x-real-ip' ||
  name === 'x-invocation-id';

/* The platform parses JSON and form bodies for us and leaves anything else -
   a file upload, most importantly - unread on the stream. Forward whichever
   one actually happened, byte for byte where it matters. */
async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;

  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) return req.body;
    return JSON.stringify(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req, res) {
  /* Rebuild what the caller actually asked for: the rewrite replaced the path
     with this file's own and moved the real one into `path`, so drop that
     parameter again and keep whatever query the caller sent alongside it. */
  const asked = new URL(req.url, 'http://proxy.invalid');
  const forwardedPath = (asked.searchParams.get('path') || '').replace(/^\/+/, '');
  asked.searchParams.delete('path');
  const query = asked.searchParams.toString();
  const target = `${API_ORIGIN}/api/${forwardedPath}${query ? `?${query}` : ''}`;

  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP.has(lower) || isInjectedByPlatform(lower) || value === undefined) continue;
    headers[name] = Array.isArray(value) ? value.join(', ') : value;
  }
  /* The whole point of the hop: present the tenant the API knows, not the
     deployment's own hostname. */
  headers.origin = TENANT_ORIGIN;
  headers.referer = `${TENANT_ORIGIN}/`;

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: await readBody(req),
      /* A 3xx is the API's answer and belongs to the browser, which knows its
         own origin; following it here would resolve it against the API host. */
      redirect: 'manual',
    });
  } catch (error) {
    /* Failing to reach the API at all is a gateway problem, not the API
       answering - say so rather than passing up a misleading status. */
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({ success: false, message: `API unreachable: ${error?.message || error}` }),
    );
    return;
  }

  upstream.headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    /* The body is re-sent here, so length and encoding are recomputed for this
       response; copying the old ones would describe the wrong message. CORS
       headers are dropped because the browser's request was same-origin - an
       Allow-Origin naming the tenant would only contradict that. Set-Cookie is
       handled below, where it can stay several headers. */
    if (
      lower === 'content-encoding' ||
      lower === 'content-length' ||
      lower === 'transfer-encoding' ||
      lower === 'connection' ||
      lower === 'set-cookie' ||
      lower.startsWith('access-control-')
    ) {
      return;
    }
    res.setHeader(name, value);
  });

  /* Several Set-Cookie headers must stay several headers; the iteration above
     would fold them into one comma-joined string no browser will parse. */
  if (typeof upstream.headers.getSetCookie === 'function') {
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) res.setHeader('set-cookie', cookies);
  }

  res.statusCode = upstream.status;
  res.end(Buffer.from(await upstream.arrayBuffer()));
}
