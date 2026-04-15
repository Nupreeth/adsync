import { IconCheck } from "./Icons";

function validateHttpsUrl(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "neutral";
  if (!/^https:\/\//i.test(trimmed)) return "invalid";
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return "valid";
  } catch (err) {
    return "invalid";
  }
}

export default function UrlInput({ value, onChange }) {
  const status = validateHttpsUrl(value);
  const isValid = status === "valid";
  const isInvalid = status === "invalid";

  const baseClass =
    "w-full rounded-xl border bg-transparent px-4 py-4 text-base text-white placeholder:text-adsync-muted/60 focus:outline-none";
  const stateClass = isValid
    ? "border-adsync-success pr-10"
    : isInvalid
      ? "border-adsync-danger pr-10"
      : "border-adsync-border";

  return (
    <div className="space-y-2">
      <label htmlFor="landing-url" className="text-sm font-medium text-adsync-text">
        Landing Page URL
      </label>
      <div className="relative">
        <input
          id="landing-url"
          type="url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://yoursite.com/landing"
          className={`${baseClass} ${stateClass}`}
        />
        {isValid ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-adsync-success">
            <IconCheck className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      {isInvalid ? (
        <p className="text-sm text-adsync-danger">Please enter a valid https:// URL</p>
      ) : (
        <p className="text-sm text-adsync-muted">
          Must be publicly accessible. We&apos;ll fetch and analyze it.
        </p>
      )}
    </div>
  );
}
