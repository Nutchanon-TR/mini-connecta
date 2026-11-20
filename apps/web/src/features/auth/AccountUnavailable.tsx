export function AccountUnavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="form-card" aria-label="Account unavailable">
      <p className="notice error" role="alert">{message}</p>
      <button className="button secondary" type="button" onClick={onRetry}>Retry account</button>
    </section>
  );
}
