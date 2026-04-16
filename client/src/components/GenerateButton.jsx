import { IconArrowRight, IconSpinner } from "./Icons";

export default function GenerateButton({ disabled, loading, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="h-14 w-full rounded-xl bg-gradient-to-br from-adsync-primary to-adsync-secondary font-display text-lg font-semibold text-white transition hover:scale-[1.01] hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <IconSpinner className="h-4 w-4" />
          Analyzing...
        </span>
      ) : (
        <span className="inline-flex items-center justify-center gap-2">
          Generate Personalized Page <IconArrowRight className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}
