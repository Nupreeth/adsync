import { useMemo, useState } from "react";
import MessageMatchGauge from "./MessageMatchGauge";
import OriginalCard from "./OriginalCard";
import PersonalizedCard from "./PersonalizedCard";
import RecommendationsGrid from "./RecommendationsGrid";
import { IconCopy, IconDownload, IconWarning } from "./Icons";

const TABS = ["Original", "Personalized", "Recommendations"];

function normalize(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

export default function ResultsPanel({ adAnalysis, pageContent, personalized }) {
  const [tab, setTab] = useState("Original");

  const fields = useMemo(
    () => [
      {
        id: "title",
        label: "Page Title",
        original: pageContent?.title,
        updated: pageContent?.title,
        rationale: "",
      },
      {
        id: "headline",
        label: "Headline (H1)",
        original: pageContent?.h1,
        updated: personalized?.new_headline,
        rationale: personalized?.cro_rationale?.headline,
      },
      {
        id: "subheadline",
        label: "Subheadline (H2)",
        original: pageContent?.h2,
        updated: personalized?.new_subheadline,
        rationale: personalized?.cro_rationale?.subheadline,
      },
      {
        id: "cta",
        label: "CTA Text",
        original: pageContent?.cta_text,
        updated: personalized?.new_cta_text,
        rationale: personalized?.cro_rationale?.cta,
      },
      {
        id: "body",
        label: "Body Copy",
        original: pageContent?.body_copy,
        updated: personalized?.new_hero_body,
        rationale: personalized?.cro_rationale?.body,
      },
    ],
    [pageContent, personalized]
  );

  const changedMap = useMemo(() => {
    const map = {};
    fields.forEach((field) => {
      map[field.id] = normalize(field.original) !== normalize(field.updated);
    });
    return map;
  }, [fields]);

  const fullPayload = useMemo(
    () => ({
      adAnalysis,
      pageContent,
      personalized,
    }),
    [adAnalysis, pageContent, personalized]
  );

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(fullPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "adsync-result.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const copyAll = async () => {
    const text = [
      `Headline: ${personalized?.new_headline || ""}`,
      `Subheadline: ${personalized?.new_subheadline || ""}`,
      `Hero Body: ${personalized?.new_hero_body || ""}`,
      `CTA: ${personalized?.new_cta_text || ""}`,
    ].join("\n\n");
    await navigator.clipboard.writeText(text);
  };

  const copyAsHtml = async () => {
    const htmlSnippet = `<h1>${personalized?.new_headline || ""}</h1>
<h2>${personalized?.new_subheadline || ""}</h2>
<p>${personalized?.new_hero_body || ""}</p>
<button>${personalized?.new_cta_text || ""}</button>`;
    await navigator.clipboard.writeText(htmlSnippet);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-adsync-border bg-adsync-surface/50 p-4 transition-all duration-500">
      <MessageMatchGauge
        before={personalized?.message_match_score_before}
        after={personalized?.message_match_score_after}
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((tabName) => (
          <button
            key={tabName}
            type="button"
            onClick={() => setTab(tabName)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              tab === tabName
                ? "bg-adsync-primary text-white"
                : "border border-adsync-border bg-transparent text-adsync-muted hover:text-white"
            }`}
          >
            {tabName}
          </button>
        ))}
      </div>

      {tab === "Original" ? (
        <div className="space-y-3">
          {fields.map((field) => (
            <OriginalCard
              key={field.id}
              label={field.label}
              content={field.original}
              changed={changedMap[field.id]}
            />
          ))}
        </div>
      ) : null}

      {tab === "Personalized" ? (
        <div className="space-y-3">
          {fields
            .filter((field) => field.id !== "title")
            .map((field) => (
              <PersonalizedCard
                key={field.id}
                label={field.label}
                original={field.original}
                updated={field.updated}
                rationale={field.rationale}
                changed={changedMap[field.id]}
              />
            ))}

          {personalized?.grounding_notes ? (
            <div className="rounded-xl border border-adsync-warning/40 bg-adsync-warning/10 p-4 text-sm text-amber-200">
              <span className="inline-flex items-start gap-2">
                <span className="mt-0.5 text-amber-200">
                  <IconWarning className="h-4 w-4" />
                </span>
                <span>Review before publishing: {personalized.grounding_notes}</span>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "Recommendations" ? (
        <RecommendationsGrid recommendations={personalized?.additional_recommendations || []} />
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-adsync-border pt-3">
        <button
          type="button"
          onClick={downloadJson}
          className="rounded-lg border border-adsync-border px-3 py-2 text-sm text-adsync-muted hover:bg-white/10 hover:text-white"
        >
          <span className="inline-flex items-center gap-2">
            <IconDownload className="h-4 w-4" /> Download JSON
          </span>
        </button>
        <button
          type="button"
          onClick={copyAll}
          className="rounded-lg border border-adsync-border px-3 py-2 text-sm text-adsync-muted hover:bg-white/10 hover:text-white"
        >
          <span className="inline-flex items-center gap-2">
            <IconCopy className="h-4 w-4" /> Copy All Copy
          </span>
        </button>
        <button
          type="button"
          onClick={copyAsHtml}
          className="rounded-lg border border-adsync-border px-3 py-2 text-sm text-adsync-muted hover:bg-white/10 hover:text-white"
        >
          {"< >"} Copy as HTML
        </button>
      </div>
    </section>
  );
}
