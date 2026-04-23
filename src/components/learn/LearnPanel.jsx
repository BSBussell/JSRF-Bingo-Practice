import { getLearningVideoEmptyLabel } from "../../data/learnVideos.js";
import { LearningVideoPanel } from "./LearningVideoPanel.jsx";

export function LearnPanel({
  sources,
  autoplay,
  muted
}) {
  return (
    <LearningVideoPanel
      sources={sources}
      autoplay={autoplay}
      muted={muted}
      emptyLabel={getLearningVideoEmptyLabel()}
    />
  );
}
