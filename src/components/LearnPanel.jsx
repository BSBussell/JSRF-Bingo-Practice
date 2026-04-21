import { useMemo } from "react";
import { resolveLearningVideoManifest, tapeVideosByArea } from "../data/learnVideos.js";
import { LearningVideoPanel } from "./LearningVideoPanel.jsx";

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

  if (!objective) {
    return null;
  }

  return (
    <LearningVideoPanel
      sources={source ? [{ key: "square", label: "Square", manifest: source.manifest }] : []}
      autoplay={autoplay}
      muted={muted}
    />
  );
}
