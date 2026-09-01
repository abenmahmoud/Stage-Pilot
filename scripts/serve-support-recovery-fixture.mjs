import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Local UI fixture only: real page, fictitious HTTP responses, no credentials.
const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.argv[2] ?? 5188);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("invalid_fixture_port");
let submissions = 0;
let exchanges = 0;
let lastStatus = null;
const fixtureModule = "\0support-recovery-fixture";
const fixtureAuth = "\0support-recovery-auth";
const server = await createServer({
  root, configFile: false, envDir: false, envPrefix: [],
  define: {
    "import.meta.env.VITE_SUPPORT_API_ENABLED": '"true"',
    "import.meta.env.VITE_SUPPORT_ACCESS_CODE_ENABLED": '"true"',
    "import.meta.env.VITE_SUPPORT_ACCESS_RECOVERY_ENABLED": '"true"',
    "import.meta.env.VITE_AI_ASSISTANT_ENABLED": '"false"',
  },
  server: { host: "127.0.0.1", port, strictPort: true, watch: { ignored: ["**/specs/**", "**/docs/**"] } },
  plugins: [react(), tailwindcss(), {
    name: "support-recovery-fixture",
    enforce: "pre",
    resolveId(id) {
      if (id === "/__support_recovery_fixture.jsx") return fixtureModule;
      if (/\/supabase-browser(?:\.ts)?$/.test(id)) return fixtureAuth;
    },
    load(id) {
      if (id === fixtureAuth) return `export const supabase = { auth: {
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
      } };`;
      if (id === fixtureModule) return `import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { BrowserRouter } from 'react-router-dom';
        import Prototype from '/src/pages/prototype/LyceeConnectPrototype.tsx';
        import '/src/index.css';
        createRoot(document.getElementById('root')).render(
          React.createElement(React.StrictMode, null,
            React.createElement(BrowserRouter, null, React.createElement(Prototype))));`;
    },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        function json(status, payload) {
          res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
          res.end(JSON.stringify(payload));
        }
        if (url.pathname === "/__fixture_metrics") return json(200, { submissions, exchanges, lastStatus });
        if (url.pathname === "/api/support/access-recovery" && req.method === "POST") {
          let raw = "";
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 2048) return json(413, {});
          }
          let input;
          try { input = JSON.parse(raw); } catch { return json(400, {}); }
          if (!/^[a-z]+@example\.invalid$/.test(input.email ?? "")) return json(400, {});
          submissions++;
          await new Promise((resolve) => setTimeout(resolve, 400));
          lastStatus = input.email === "limited@example.invalid" ? 429 : input.email === "unavailable@example.invalid" ? 503 : 202;
          return json(lastStatus, input.email === "malformed@example.invalid" ? { accepted: true, unexpected: "rejected" } : lastStatus === 202 ? { accepted: true } : { error: "Fictitious failure" });
        }
        if (url.pathname.startsWith("/api/support/access/")) { exchanges++; return json(410, { error: "Fictitious expired link" }); }
        if (url.pathname === "/api/support/requests" && req.method === "GET") return json(200, { requests: [] });
        if (url.pathname === "/api/content/public") return json(200, { items: [], nextCursor: null, scope: "current" });
        if (url.pathname.startsWith("/api/")) return json(503, { error: "Fixture: operation unavailable" });
        if (url.pathname === "/" || url.pathname === "/prototype") {
          const html = await vite.transformIndexHtml(url.pathname,
            '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Suivi - verification fictive</title></head><body><div id="root"></div><script type="module" src="/__support_recovery_fixture.jsx"></script></body></html>');
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:*; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'" });
          return res.end(html);
        }
        next();
      });
    },
  }],
});
await server.listen();
console.log(`Fictitious recovery fixture: http://127.0.0.1:${port}/prototype?view=requests`);
async function stop() { await server.close(); process.exit(0); }
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
