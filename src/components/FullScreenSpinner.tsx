export function FullScreenSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="center-screen" role="status" aria-live="polite">
      <div className="spinner" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
