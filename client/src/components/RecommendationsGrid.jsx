import { IconArrowUpRight } from "./Icons";

const PRINCIPLE_COLORS = {
  "Social Proof": "bg-blue-500/20 text-blue-200 border-blue-400/30",
  Urgency: "bg-red-500/20 text-red-200 border-red-400/30",
  Clarity: "bg-adsync-primary/15 text-white border-adsync-primary/40",
  Trust: "bg-green-500/20 text-green-200 border-green-400/30",
  Specificity: "bg-amber-500/20 text-amber-200 border-amber-400/30",
  "Visual Hierarchy": "bg-adsync-secondary/15 text-white border-adsync-secondary/40",
};

export default function RecommendationsGrid({ recommendations = [] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {recommendations.map((item, index) => {
        const colorClass = PRINCIPLE_COLORS[item.principle] || "bg-white/10 text-white border-white/20";
        return (
          <article key={`${item.title}-${index}`} className="rounded-xl border border-adsync-border bg-adsync-surface p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs ${colorClass}`}>{item.principle}</span>
              <span className="text-adsync-muted">
                <IconArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            <h4 className="font-display text-lg font-semibold text-white">{item.title}</h4>
            <p className="mt-2 text-sm leading-relaxed text-adsync-muted">{item.description}</p>
          </article>
        );
      })}
    </div>
  );
}
