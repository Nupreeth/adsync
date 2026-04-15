export default function OriginalCard({ label, content, changed }) {
  return (
    <div
      className={`rounded-xl border border-adsync-border bg-adsync-surface/70 p-4 ${
        changed ? "border-l-4 border-l-adsync-danger" : "border-l-4 border-l-adsync-border"
      }`}
    >
      <p className="mb-2 text-xs uppercase tracking-wide text-adsync-muted">{label}</p>
      <p className="text-base leading-relaxed text-white">{content || "(not available)"}</p>
    </div>
  );
}

