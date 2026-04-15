import { useState } from "react";
import { IconCheck, IconCopy } from "./Icons";

export default function PersonalizedCard({ label, original, updated, rationale, changed }) {
  const [showWhy, setShowWhy] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(updated || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      // no-op
    }
  };

  return (
    <div
      className={`rounded-xl border border-adsync-border p-4 ${
        changed
          ? "border-l-4 border-l-adsync-success bg-adsync-success/5"
          : "border-l-4 border-l-adsync-border bg-adsync-surface/70"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-adsync-muted">{label}</p>
        <button
          type="button"
          onClick={copyText}
          className="rounded-md border border-white/20 px-2 py-1 text-xs text-white/90 hover:bg-white/10"
        >
          {copied ? (
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="h-3.5 w-3.5 text-adsync-success" />
              Copied
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <IconCopy className="h-3.5 w-3.5" />
              Copy
            </span>
          )}
        </button>
      </div>
      <p className="text-sm text-adsync-muted">
        <span className="font-semibold text-adsync-muted/80">Before:</span> {original || "(not available)"}
      </p>
      <p className="mt-2 text-base leading-relaxed text-white">
        <span className="font-semibold text-adsync-success">After:</span> {updated || "(not available)"}
      </p>

      {changed ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowWhy((prev) => !prev)}
            className="rounded-md border border-white/20 px-2 py-1 text-xs text-white/90 hover:bg-white/10"
          >
            Why?
          </button>
          {showWhy ? (
            <div className="mt-2 rounded-lg border border-adsync-border bg-black/20 p-3 text-sm text-adsync-muted">
              {rationale || "No rationale available."}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
