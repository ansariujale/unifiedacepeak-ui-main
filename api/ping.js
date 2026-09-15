/* Deployment check for the API proxy next to it: reaching this confirms the
   platform is building this directory's functions and routing /api/* to them,
   which separates "the proxy is broken" from "the proxy was never deployed".
   Answers only about itself and touches nothing else. */
export default function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.status(200).end(
    JSON.stringify({
      ok: true,
      path: req.url,
      target: process.env.API_PROXY_TARGET || 'https://api2.acepeak.com',
      tenant: process.env.API_PROXY_TENANT_ORIGIN || 'https://ucaas.acepeak.com',
      viteApiBaseUrlIsSet: Boolean(process.env.VITE_API_BASE_URL),
      /* Names only, never values: the point is to see what the platform adds
         to a request on its way through, and a header's contents here could
         be somebody's bearer token. */
      incomingHeaderNames: Object.keys(req.headers).sort(),
    }),
  );
}
