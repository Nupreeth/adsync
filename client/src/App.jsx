import { useEffect, useMemo, useRef, useState } from "react";
import AdInput from "./components/AdInput";
import UrlInput from "./components/UrlInput";
import GenerateButton from "./components/GenerateButton";
import LoadingSteps from "./components/LoadingSteps";
import ResultsPanel from "./components/ResultsPanel";
import ManualFallback from "./components/ManualFallback";
import ErrorBanner from "./components/ErrorBanner";
import { IconBolt } from "./components/Icons";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const INITIAL_MANUAL = {
  headline: "",
  subheadline: "",
  cta: "",
  body: "",
};

function isValidHttpsUrl(value) {
  const trimmed = (value || "").trim();
  if (!/^https:\/\//i.test(trimmed)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return true;
  } catch (err) {
    return false;
  }
}

async function parseResponse(response) {
  let body = {};
  try {
    body = await response.json();
  } catch (err) {
    body = {};
  }
  return body;
}

export default function App() {
  const [adMode, setAdMode] = useState("upload");
  const [adFile, setAdFile] = useState(null);
  const [adFilePreview, setAdFilePreview] = useState("");
  const [adImageUrl, setAdImageUrl] = useState("");
  const [adImageUrlPreview, setAdImageUrlPreview] = useState("");
  const [adImageUrlError, setAdImageUrlError] = useState("");
  const [landingUrl, setLandingUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [slowMode, setSlowMode] = useState(false);

  const [errorBanner, setErrorBanner] = useState({ message: "", type: "error" });
  const [scrapeFailed, setScrapeFailed] = useState(false);
  const [manualValues, setManualValues] = useState(INITIAL_MANUAL);
  const [aiOutputInvalid, setAiOutputInvalid] = useState(false);

  const [adAnalysis, setAdAnalysis] = useState(null);
  const [pageContent, setPageContent] = useState(null);
  const [personalized, setPersonalized] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");

  const abortRef = useRef(null);
  const slowTimerRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (personalized && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [personalized]);

  useEffect(
    () => () => {
      if (adFilePreview) URL.revokeObjectURL(adFilePreview);
      if (abortRef.current) abortRef.current.abort();
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    },
    [adFilePreview]
  );

  const canGenerate = useMemo(() => {
    const hasAd = adMode === "upload" ? Boolean(adFile) : Boolean(adImageUrl.trim());
    return hasAd && isValidHttpsUrl(landingUrl);
  }, [adMode, adFile, adImageUrl, landingUrl]);

  const clearFlowErrors = () => {
    setErrorBanner({ message: "", type: "error" });
    setAiOutputInvalid(false);
  };

  const resetOutputState = () => {
    setScrapeFailed(false);
    setManualValues(INITIAL_MANUAL);
    setPersonalized(null);
    setPreviewHtml("");
  };

  const setStep = (index, progressValue) => {
    setCurrentStep(index);
    setProgress(progressValue);
  };

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setLoading(false);
    setSlowMode(false);
    setProgress(0);
    setErrorBanner({ message: "Request was cancelled.", type: "warning" });
  };

  const requestJson = async (path, options, signal) => {
    const response = await fetch(`${API_BASE}${path}`, { ...options, signal });
    const body = await parseResponse(response);
    if (!response.ok) {
      const error = new Error(body.error || "Request failed");
      error.code = body.error || "REQUEST_FAILED";
      throw error;
    }
    return body;
  };

  const analyzeAd = async (signal) => {
    if (adMode === "upload" && adFile) {
      const formData = new FormData();
      formData.append("image", adFile);
      return requestJson("/api/analyze-ad", { method: "POST", body: formData }, signal);
    }
    return requestJson(
      "/api/analyze-ad",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: adImageUrl.trim() }),
      },
      signal
    );
  };

  const scrapePage = (signal) =>
    requestJson(
      "/api/scrape-page",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: landingUrl.trim() }),
      },
      signal
    );

  const personalize = (analysis, content, signal) =>
    requestJson(
      "/api/personalize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAnalysis: analysis, pageContent: content }),
      },
      signal
    );

  const renderPreview = (personalization, signal) =>
    requestJson(
      "/api/render-page",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: landingUrl.trim(), personalized: personalization }),
      },
      signal
    );

  const startSlowTimer = () => {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => {
      setSlowMode(true);
    }, 25000);
  };

  const finishLoading = () => {
    setLoading(false);
    setSlowMode(false);
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    abortRef.current = null;
    window.setTimeout(() => setProgress(0), 600);
  };

  const runPersonalizeOnly = async (analysis, content) => {
    setLoading(true);
    setStep(2, 74);
    setSlowMode(false);
    startSlowTimer();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const output = await personalize(analysis, content, controller.signal);
      setPersonalized(output);
      setAiOutputInvalid(false);

      try {
        const rendered = await renderPreview(output, controller.signal);
        setPreviewHtml(rendered?.html || "");
      } catch (err) {
        setPreviewHtml("");
      }

      setStep(3, 100);
    } catch (error) {
      if (error.name === "AbortError") return;
      if (error.code === "AI_OUTPUT_INVALID") {
        setAiOutputInvalid(true);
        setErrorBanner({
          message: "The AI returned an unexpected response. Please try again.",
          type: "error",
        });
      } else {
        setErrorBanner({
          message: "Connection error. Check your internet and try again.",
          type: "error",
        });
      }
    } finally {
      finishLoading();
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate || loading) return;

    clearFlowErrors();
    resetOutputState();
    setAdAnalysis(null);
    setPageContent(null);
    setLoading(true);
    setStep(0, 10);
    setSlowMode(false);
    startSlowTimer();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const analysis = await analyzeAd(controller.signal);
      setAdAnalysis(analysis);
      setStep(1, 40);

      let scraped;
      try {
        scraped = await scrapePage(controller.signal);
      } catch (error) {
        if (error.code === "SCRAPE_FAILED") {
          setScrapeFailed(true);
          setErrorBanner({
            message: "We couldn't fetch that page automatically. It may block web scrapers.",
            type: "warning",
          });
          return;
        }
        throw error;
      }

      setPageContent(scraped);
      setStep(2, 72);

      const output = await personalize(analysis, scraped, controller.signal);
      setPersonalized(output);

      try {
        const rendered = await renderPreview(output, controller.signal);
        setPreviewHtml(rendered?.html || "");
      } catch (err) {
        setPreviewHtml("");
      }

      setStep(3, 100);
    } catch (error) {
      if (error.name === "AbortError") return;
      if (error.code === "AI_OUTPUT_INVALID") {
        setAiOutputInvalid(true);
        setErrorBanner({
          message: "The AI returned an unexpected response. Please try again.",
          type: "error",
        });
      } else if (error.code === "SCRAPE_FAILED") {
        setScrapeFailed(true);
      } else {
        setErrorBanner({
          message: "Connection error. Check your internet and try again.",
          type: "error",
        });
      }
    } finally {
      finishLoading();
    }
  };

  const handleManualChange = (key, value) => {
    setManualValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleManualSubmit = async () => {
    if (!adAnalysis) return;
    clearFlowErrors();

    const manualPageContent = {
      url: landingUrl.trim(),
      title: "",
      meta_description: "",
      h1: manualValues.headline,
      h2: manualValues.subheadline,
      cta_text: manualValues.cta,
      body_copy: manualValues.body,
      trust_signals: [],
    };

    setPageContent(manualPageContent);
    await runPersonalizeOnly(adAnalysis, manualPageContent);
  };

  const retryStep4 = async () => {
    if (!adAnalysis || !pageContent) return;
    clearFlowErrors();
    await runPersonalizeOnly(adAnalysis, pageContent);
  };

  const handleFileChange = (file) => {
    if (adFilePreview) URL.revokeObjectURL(adFilePreview);
    setAdFile(file);
    setAdFilePreview(URL.createObjectURL(file));
    setAdMode("upload");
    setAdImageUrlError("");
  };

  const handleFileRemove = () => {
    if (adFilePreview) URL.revokeObjectURL(adFilePreview);
    setAdFile(null);
    setAdFilePreview("");
  };

  const resolveImageUrlPreview = () => {
    const trimmed = adImageUrl.trim();
    setAdImageUrlError("");
    setAdImageUrlPreview(trimmed);
  };

  const onImageUrlLoadError = () => {
    setAdImageUrlError("Image URL didn't load. Try uploading instead.");
    setErrorBanner({
      message: "Image URL failed to load. Switched to Upload tab.",
      type: "warning",
    });
    setAdImageUrlPreview("");
  };

  return (
    <div className="min-h-screen bg-adsync-bg text-adsync-text">
      <header className="fixed inset-x-0 top-0 z-50 h-[60px] border-b border-adsync-border bg-adsync-bg/95 backdrop-blur">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4">
          <p className="inline-flex items-center gap-2 font-display text-xl font-bold text-indigo-300">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-400/30">
              <IconBolt className="h-5 w-5" />
            </span>
            AdSync
          </p>
          <p className="hidden text-sm text-adsync-muted sm:block">
            Ad-to-page personalization, powered by Claude
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-20">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-extrabold leading-tight text-white md:text-5xl">
            Turn Ad Clicks Into Conversions
          </h1>
          <p className="mt-4 text-lg text-adsync-muted">
            Paste your ad and landing page. Get personalized copy that matches your message, in
            seconds.
          </p>
        </section>

        <section className="mt-8 space-y-4">
          <ErrorBanner
            message={errorBanner.message}
            type={errorBanner.type}
            onClose={() => setErrorBanner({ message: "", type: "error" })}
          />

          {aiOutputInvalid && adAnalysis && pageContent ? (
            <div className="rounded-xl border border-adsync-danger/40 bg-adsync-danger/10 p-4">
              <p className="text-sm text-rose-200">The AI output was invalid after retry.</p>
              <button
                type="button"
                onClick={retryStep4}
                disabled={loading}
                className="mt-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/10"
              >
                Retry Step 4
              </button>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-adsync-border bg-adsync-surface p-6">
              <h2 className="font-display text-2xl font-bold">Ad Creative</h2>
              <p className="mt-1 text-sm text-adsync-muted">
                Upload image or use image URL input.
              </p>
              <div className="mt-4">
                <AdInput
                  mode={adMode}
                  setMode={setAdMode}
                  adFile={adFile}
                  adFilePreview={adFilePreview}
                  adImageUrl={adImageUrl}
                  adImageUrlPreview={adImageUrlPreview}
                  adImageUrlError={adImageUrlError}
                  onFileChange={handleFileChange}
                  onFileRemove={handleFileRemove}
                  onImageUrlChange={setAdImageUrl}
                  onResolveImageUrl={resolveImageUrlPreview}
                  onImageUrlLoadError={onImageUrlLoadError}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-adsync-border bg-adsync-surface p-6">
              <h2 className="font-display text-2xl font-bold">Landing Page URL</h2>
              <p className="mt-1 text-sm text-adsync-muted">
                Must be publicly accessible.
              </p>
              <div className="mt-4">
                <UrlInput value={landingUrl} onChange={setLandingUrl} />
              </div>
            </div>
          </div>

          {!loading ? (
            <GenerateButton disabled={!canGenerate} loading={loading} onClick={handleGenerate} />
          ) : (
            <LoadingSteps
              currentStep={currentStep}
              progress={progress}
              slowMode={slowMode}
              onCancel={handleCancel}
            />
          )}

          {scrapeFailed ? (
            <ManualFallback
              values={manualValues}
              onChange={handleManualChange}
              onSubmit={handleManualSubmit}
              loading={loading}
            />
          ) : null}
        </section>

        <section ref={resultsRef} className="mt-8">
          <div
            className={`transition-all duration-500 ${
              personalized ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-5 opacity-0"
            }`}
          >
            {personalized ? (
              <ResultsPanel
                adAnalysis={adAnalysis}
                pageContent={pageContent}
                personalized={personalized}
                previewHtml={previewHtml}
              />
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
