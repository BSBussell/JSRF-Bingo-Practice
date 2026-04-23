import { useEffect, useMemo, useState } from "react";

function buildOptionKey(option) {
  if (option.playlistId) {
    return `playlist:${option.playlistId}:${option.videoId ?? "root"}`;
  }

  return `video:${option.videoId}`;
}

function buildYoutubeEmbedUrl(option, { autoplay, muted }) {
  const params = new URLSearchParams({
    rel: "0",
    autoplay: autoplay ? "1" : "0",
    mute: muted ? "1" : "0",
    playsinline: "1"
  });

  if (option.playlistId) {
    params.set("list", option.playlistId);
    if (option.videoId) {
      return `https://www.youtube-nocookie.com/embed/${option.videoId}?${params.toString()}`;
    }

    return `https://www.youtube-nocookie.com/embed/videoseries?${params.toString()}`;
  }

  return `https://www.youtube-nocookie.com/embed/${option.videoId}?${params.toString()}`;
}

function sourceOptions(source) {
  if (!source?.manifest) {
    return [];
  }

  const entries = [];

  if (source.manifest.primaryVideoId && source.manifest.primaryLabel) {
    entries.push({
      videoId: source.manifest.primaryVideoId,
      label: source.manifest.primaryLabel
    });
  }

  return [...entries, ...(source.manifest.variants ?? [])];
}

export function LearningVideoPanel({
  sources,
  autoplay = false,
  muted = false,
  emptyLabel = "No mapped video for this square.",
  className = ""
}) {
  const safeSources = useMemo(
    () =>
      (Array.isArray(sources) ? sources : [])
        .filter((source) => source?.manifest)
        .map((source, index) => ({
          key: source.key ?? `source-${index}`,
          label: source.label ?? "Guide",
          manifest: source.manifest
        })),
    [sources]
  );
  const [selectedSourceKey, setSelectedSourceKey] = useState(safeSources[0]?.key ?? "");
  const selectedSource =
    safeSources.find((source) => source.key === selectedSourceKey) ?? safeSources[0] ?? null;
  const options = useMemo(() => sourceOptions(selectedSource), [selectedSource]);
  const [selectedOptionKey, setSelectedOptionKey] = useState(
    selectedSource && options[0] ? buildOptionKey(options[0]) : ""
  );

  useEffect(() => {
    setSelectedSourceKey((currentKey) =>
      safeSources.some((source) => source.key === currentKey)
        ? currentKey
        : safeSources[0]?.key ?? ""
    );
  }, [safeSources]);

  useEffect(() => {
    setSelectedOptionKey((currentKey) =>
      options.some((option) => buildOptionKey(option) === currentKey)
        ? currentKey
        : selectedSource && options[0]
          ? buildOptionKey(options[0])
          : ""
    );
  }, [options, selectedSource]);

  const selectedVideo =
    options.find((option) => buildOptionKey(option) === selectedOptionKey) ?? options[0] ?? null;
  const hasVariants = options.length > 1;
  const hasSources = safeSources.length > 1;
  const rootClassName = [
    "learn-panel",
    hasVariants || hasSources ? "has-variants" : "no-variants",
    className
  ].filter(Boolean).join(" ");

  if (!selectedSource || !selectedVideo) {
    return (
      <div className="learn-panel no-variants">
        <div className="learn-empty">{emptyLabel}</div>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      {hasSources ? (
        <div className="learn-source-tabs" role="tablist" aria-label="Guide type">
          {safeSources.map((source) => (
            <button
              key={source.key}
              className={`learn-source-tab ${source.key === selectedSource.key ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={source.key === selectedSource.key}
              onClick={() => setSelectedSourceKey(source.key)}
            >
              {source.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="learn-video-frame">
        <iframe
          title={selectedVideo.label}
          src={buildYoutubeEmbedUrl(selectedVideo, {
            autoplay,
            muted
          })}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          loading="lazy"
        />
      </div>

      {hasVariants ? (
        <div className="learn-variant-menu">
          <button className="secondary-button learn-variant-trigger" type="button">
            Varients
          </button>
          <div className="learn-variant-list" role="menu" aria-label="Guide options">
            {options.map((option) => (
              <button
                key={buildOptionKey(option)}
                className={`learn-variant-option ${buildOptionKey(option) === buildOptionKey(selectedVideo) ? "is-active" : ""}`}
                type="button"
                onClick={() => setSelectedOptionKey(buildOptionKey(option))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
