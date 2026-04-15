import { useMemo } from "react";
import { IconArrowRight } from "./Icons";

function Gauge({ label, score, color }) {
  const normalized = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = useMemo(
    () => circumference - (normalized / 100) * circumference,
    [circumference, normalized]
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={radius} stroke="rgba(148,163,184,0.25)" strokeWidth="10" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="ring-gauge"
        />
      </svg>
      <div className="-mt-[86px] text-center">
        <div className="font-display text-2xl font-bold text-white">{normalized}</div>
        <div className="text-xs text-adsync-muted">{label}</div>
      </div>
    </div>
  );
}

export default function MessageMatchGauge({ before = 0, after = 0 }) {
  return (
    <div className="rounded-2xl border border-adsync-border bg-adsync-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl font-bold text-white">Message Match Score</h3>
        <p className="text-sm text-adsync-muted">Higher score = stronger ad-to-page message match</p>
      </div>
      <div className="flex items-center justify-center gap-2 md:gap-8">
        <Gauge label="Before" score={before} color={before >= 70 ? "#22C55E" : before >= 40 ? "#F59E0B" : "#EF4444"} />
        <span className="text-adsync-muted">
          <IconArrowRight className="h-6 w-6" />
        </span>
        <Gauge label="After" score={after} color="#10B981" />
      </div>
    </div>
  );
}
