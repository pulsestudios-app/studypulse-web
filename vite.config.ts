import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

import { buildCsp } from "./tooling/csp.ts";

const REQUIRED_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_BACKEND_URL", "VITE_APP_KEY"] as const;

/** Production-only CSP <meta>; dev is skipped because the React refresh preamble is an inline script. */
function contentSecurityPolicy(env: Record<string, string>): Plugin {
  return {
    name: "studypulse:csp",
    apply: "build",
    transformIndexHtml(html) {
      const csp = buildCsp({
        supabaseUrl: env.VITE_SUPABASE_URL,
        backendUrl: env.VITE_BACKEND_URL,
        posthogHost: env.VITE_POSTHOG_HOST,
        sentryDsn: env.VITE_SENTRY_DSN,
      });
      return html.replace(
        "<!-- CSP -->",
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

/** GitHub Pages serves 404.html for unknown paths; reuse the SPA shell so deep links work. */
function spaFallback(): Plugin {
  let outDir = "dist";
  return {
    name: "studypulse:spa-fallback",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, "index.html"), resolve(outDir, "404.html"));
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  if (command === "build" && mode !== "test") {
    const missing = REQUIRED_ENV.filter((key) => !env[key]?.trim());
    if (missing.length > 0) {
      throw new Error(`Missing required build env: ${missing.join(", ")} (see .env.example)`);
    }
  }

  return {
    plugins: [react(), contentSecurityPolicy(env), spaFallback()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Local dev talks to Railway through this proxy so no localhost CORS entry is needed.
        "/backend": {
          target: env.VITE_BACKEND_PROXY_TARGET || "https://studypulse-production.up.railway.app",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/backend/, ""),
        },
      },
    },
    build: {
      sourcemap: false,
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "tooling/**/*.test.ts"],
    },
  };
});
