import { Link } from "react-router";

import type { PlanSummary } from "./planSummary";

export function PlanBadge({ summary, loading }: { summary: PlanSummary | undefined; loading: boolean }) {
  if (loading || !summary) {
    return <div className="plan-badge plan-badge-loading skeleton" aria-hidden="true" />;
  }
  const nearLimit = !summary.unlimited && summary.usedFraction >= 0.9;
  return (
    <Link to="/settings" className="plan-badge" title={summary.usageLine}>
      <span className={`plan-pill${summary.plan === "free" ? "" : " plan-pill-paid"}`}>{summary.label}</span>
      <span className="plan-usage">
        <span className="plan-usage-text">{summary.shortUsage}</span>
        {!summary.unlimited ? (
          <span
            className="plan-meter"
            role="meter"
            aria-label="Minutes used this cycle"
            aria-valuemin={0}
            aria-valuemax={summary.limitMinutes}
            aria-valuenow={summary.usedMinutes}
          >
            <span
              className={`plan-meter-fill${nearLimit ? " plan-meter-fill-warn" : ""}`}
              style={{ width: `${Math.round(summary.usedFraction * 100)}%` }}
            />
          </span>
        ) : null}
      </span>
    </Link>
  );
}
