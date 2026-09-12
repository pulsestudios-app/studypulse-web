import "./styles/global.css";
import "./styles/app.css";
import "./styles/results.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { initAnalytics } from "./lib/analytics";
import { missingConfig } from "./lib/config";
import { initSentry } from "./lib/sentry";

const container = document.getElementById("root");
if (!container) {
  throw new Error("#root missing");
}
const root = createRoot(container);

if (missingConfig.length > 0) {
  root.render(
    <main className="center-screen">
      <div className="card not-found">
        <h1 className="type-title">StudyPulse isn't configured</h1>
        <p className="text-secondary">Missing build variables: {missingConfig.join(", ")}. See .env.example.</p>
      </div>
    </main>,
  );
} else {
  initSentry();
  initAnalytics();
  // Loaded after the config check: the Supabase client throws on an empty URL.
  void import("./App").then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
