import { COPY } from "./copy";

/** Web stand-in for the phone's upgrade sheet: same gate copy, but purchases happen on the phone. */
export function UpgradeNotice({ message, button, feature }: { message: string; button: string; feature?: string }) {
  return (
    <div className="upgrade-notice card">
      <p className="upgrade-notice-text">{message}</p>
      <details className="upgrade-notice-details">
        <summary className="btn btn-primary btn-small">{button}</summary>
        <div className="upgrade-notice-body">
          <strong>{COPY.upgrade.title}</strong>
          {feature ? <p>{COPY.upgrade.feature(feature)}</p> : null}
          <p className="text-secondary type-caption">{COPY.upgrade.onPhoneBody}</p>
        </div>
      </details>
    </div>
  );
}

export function InlineError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="notice notice-error inline-error" role="alert">
      <div>
        <strong>{title}</strong>
        <div>{message}</div>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
