import { useEffect, useMemo, useState } from "react";
import { resolveLearningVideoManifest, tapeVideosByArea } from "../data/learnVideos.js";

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

export function LearnPanel({ objective, phaseInfo, autoplay, muted }) {
  const source = useMemo(() => {
    if (!objective) {
      return null;
    }

    const tapeVideo = tapeVideosByArea[objective.area];

    if (phaseInfo?.phase === "tape" && tapeVideo) {
      return {
        manifest: tapeVideo
      };
    }

    const objectiveVideo = resolveLearningVideoManifest(objective);
    if (objectiveVideo) {
      return {
        manifest: objectiveVideo
      };
    }

    if (phaseInfo?.needsTape && tapeVideo) {
      return {
        manifest: tapeVideo
      };
    }

    return null;
  }, [objective, phaseInfo?.needsTape, phaseInfo?.phase]);

  const options = useMemo(() => {
    if (!source) {
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
  }, [source]);

  const [selectedOptionKey, setSelectedOptionKey] = useState(
    source && options[0] ? buildOptionKey(options[0]) : ""
  );

  useEffect(() => {
    setSelectedOptionKey(source && options[0] ? buildOptionKey(options[0]) : "");
  }, [options, source]);

  const selectedVideo =
    options.find((option) => buildOptionKey(option) === selectedOptionKey) ?? options[0] ?? null;
  const hasVariants = options.length > 1;

  if (!objective) {
    return null;
  }

  if (!source || !selectedVideo) {
    return (
      <div className="learn-panel no-variants">
        <div className="learn-empty">No mapped video for this square.</div>
      </div>
    );
  }

  return (
    <div className={`learn-panel ${hasVariants ? "has-variants" : "no-variants"}`}>
      <div className="learn-video-frame">
        <iframe
          title={selectedVideo.label}
          src={buildYoutubeEmbedUrl(selectedVideo, {
            autoplay,
            muted
          })}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          loading="lazy"
        />
      </div>

      {hasVariants ? (
        <div className="learn-variant-menu">
          <button className="secondary-button learn-variant-trigger" type="button">
            Variants
          </button>
          <div className="learn-variant-list" role="menu" aria-label="Video variants">
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
