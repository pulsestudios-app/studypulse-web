import { Link } from "react-router";

import { useDocumentTitle } from "./useDocumentTitle";

export function NotFoundPage() {
  useDocumentTitle("Not found");
  return (
    <main className="center-screen">
      <div className="card not-found">
        <h1 className="type-title">Page not found</h1>
        <p className="text-secondary">That page doesn't exist.</p>
        <Link to="/library" className="btn btn-primary">
          Go to your library
        </Link>
      </div>
    </main>
  );
}

export function CrashFallback() {
  return (
    <main className="center-screen">
      <div className="card not-found">
        <h1 className="type-title">Something went wrong</h1>
        <p className="text-secondary">Please reload the page. If it keeps happening, sign out and back in.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </main>
  );
}
