export default function ErrorBanner({ message, type = "error", onClose }) {
  if (!message) return null;

  const classes =
    type === "warning"
      ? "border-adsync-warning/40 bg-adsync-warning/10 text-amber-200"
      : "border-adsync-danger/40 bg-adsync-danger/10 text-rose-200";

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>
      <div className="flex items-start justify-between gap-3">
        <p>{message}</p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/20 px-2 py-0.5 text-xs text-white/80 hover:bg-white/10"
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}

