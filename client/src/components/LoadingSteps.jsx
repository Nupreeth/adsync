import { IconCheck, IconSpinner } from "./Icons";

const STEPS = [
  "Analyzing ad creative...",
  "Fetching landing page...",
  "Generating personalization...",
];

export default function LoadingSteps({ currentStep = 0, progress = 0, slowMode = false, onCancel }) {
  return (
    <div className="space-y-3 rounded-2xl border border-adsync-border bg-adsync-surface/80 p-4">
      <div className="fixed left-0 right-0 top-[60px] z-40 h-1.5 bg-adsync-border/60">
        <div
          className="h-full bg-gradient-to-r from-adsync-primary to-adsync-secondary transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      {STEPS.map((label, index) => {
        const completed = index < currentStep;
        const active = index === currentStep;
        return (
          <div key={label} className="flex items-center gap-3">
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                completed
                  ? "border-adsync-success bg-adsync-success/20 text-adsync-success"
                  : active
                    ? "border-adsync-primary bg-adsync-primary/20 text-adsync-primary"
                    : "border-adsync-border text-adsync-muted"
              }`}
            >
              {completed ? <IconCheck className="h-4 w-4" /> : active ? <IconSpinner className="h-4 w-4" /> : null}
            </span>
            <span className={`${active ? "text-white" : "text-adsync-muted"}`}>{label}</span>
          </div>
        );
      })}

      <p className="text-sm text-adsync-muted">Usually takes 15-25 seconds.</p>
      {slowMode ? (
        <div className="flex items-center justify-between rounded-lg border border-adsync-warning/40 bg-adsync-warning/10 px-3 py-2 text-sm text-amber-200">
          <span>This is taking longer than usual. Still working...</span>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-white/20 px-2 py-1 text-xs text-white hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
