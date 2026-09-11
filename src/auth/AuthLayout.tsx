import type { ReactNode } from "react";

import { Logo } from "../components/Logo";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card card">
        <div className="auth-brand">
          <Logo size={32} />
        </div>
        <h1 className="type-title">{title}</h1>
        {subtitle ? <p className="auth-subtitle text-secondary">{subtitle}</p> : null}
        {children}
      </div>
      <p className="auth-footer type-caption text-secondary">
        <a href="https://pulsestudios.app/studypulse-legal.html" target="_blank" rel="noreferrer">
          Terms &amp; Privacy
        </a>
      </p>
    </main>
  );
}

export function FormNotice({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const className = tone === "error" ? "notice notice-error" : tone === "success" ? "notice notice-success" : "notice";
  return (
    <div className={className} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
