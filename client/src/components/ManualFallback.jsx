export default function ManualFallback({ values, onChange, onSubmit, loading }) {
  return (
    <div className="rounded-2xl border border-adsync-warning/40 bg-adsync-warning/10 p-4">
      <h3 className="font-display text-xl font-bold text-white">
        We couldn&apos;t fetch that page automatically
      </h3>
      <p className="mt-1 text-sm text-amber-200/90">
        It may block web scrapers. Add page copy manually and continue.
      </p>

      <div className="mt-4 space-y-3">
        {[
          ["headline", "Current Headline"],
          ["subheadline", "Current Subheadline"],
          ["cta", "Current CTA text"],
          ["body", "Current body copy (first paragraph)"],
        ].map(([key, label]) => (
          <div key={key} className="space-y-1">
            <label className="text-sm text-white">{label}</label>
            <textarea
              rows={key === "body" ? 4 : 2}
              value={values[key] || ""}
              onChange={(event) => onChange(key, event.target.value)}
              className="w-full rounded-lg border border-adsync-border bg-black/20 px-3 py-2 text-white placeholder:text-adsync-muted/60 focus:border-adsync-primary focus:outline-none"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        className="mt-4 rounded-xl border border-adsync-primary bg-adsync-primary px-4 py-2 font-display text-white hover:bg-adsync-primary/90 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Try Again with Manual Input"}
      </button>
    </div>
  );
}

