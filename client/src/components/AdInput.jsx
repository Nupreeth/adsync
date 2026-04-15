import { useRef, useState } from "react";
import { IconUpload, IconX } from "./Icons";

const TABS = [
  { id: "upload", label: "Upload Image" },
  { id: "url", label: "Image URL" },
];

export default function AdInput({
  mode,
  setMode,
  adFile,
  adFilePreview,
  adImageUrl,
  adImageUrlPreview,
  adImageUrlError,
  onFileChange,
  onFileRemove,
  onImageUrlChange,
  onResolveImageUrl,
  onImageUrlLoadError,
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFileChange(file);
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-adsync-border bg-[#0f1118] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              mode === tab.id
                ? "bg-adsync-primary text-white"
                : "text-adsync-muted hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-6 transition ${
            dragOver
              ? "border-adsync-primary bg-adsync-primary/10"
              : "border-adsync-border bg-adsync-surface/30"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFileChange(file);
            }}
          />

          {!adFile ? (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center">
              <div className="text-indigo-200">
                <IconUpload className="h-9 w-9" />
              </div>
              <p className="text-lg font-medium text-white">Drop ad image here</p>
              <p className="text-sm text-adsync-muted">or click to browse</p>
              <p className="text-xs text-adsync-muted">PNG / JPG / WebP</p>
            </div>
          ) : (
            <div className="space-y-3">
              {adFilePreview ? (
                <img
                  src={adFilePreview}
                  alt="Ad preview"
                  className="h-40 w-full rounded-lg object-cover"
                />
              ) : null}
              <div className="flex items-center justify-between gap-2 rounded-lg border border-adsync-border bg-black/20 px-3 py-2">
                <p className="truncate text-sm text-adsync-muted">{adFile.name}</p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFileRemove();
                  }}
                  className="rounded-md border border-white/20 px-2 py-1 text-xs text-white hover:bg-white/10"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <IconX className="h-3.5 w-3.5" />
                    Remove
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="url"
            value={adImageUrl}
            onChange={(event) => onImageUrlChange(event.target.value)}
            onBlur={onResolveImageUrl}
            onPaste={() => window.setTimeout(onResolveImageUrl, 0)}
            placeholder="https://cdn.example.com/ad-image.jpg"
            className="w-full rounded-xl border border-adsync-border bg-transparent px-4 py-3 text-white placeholder:text-adsync-muted/60 focus:border-adsync-primary focus:outline-none"
          />
          {adImageUrlError ? (
            <p className="text-sm text-adsync-danger">
              {adImageUrlError} Auto-switched to Upload tab.
            </p>
          ) : null}
          {adImageUrlPreview ? (
            <img
              src={adImageUrlPreview}
              alt="Ad URL preview"
              className="h-40 w-full rounded-lg object-cover"
              onError={() => {
                onImageUrlLoadError();
                setMode("upload");
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
