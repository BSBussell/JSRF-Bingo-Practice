// Scales the drill card into the popout window while trying to keep small
// layouts readable. The extra text-stretch/font-boost heuristics are not
// mathematically pure, but they keep narrow windows from turning into mush.
import { useLayoutEffect, useRef, useState } from "react";

export function PopoutViewport({ children }) {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const frameRef = useRef(0);
  const [layout, setLayout] = useState({
    ready: false,
    scale: 1,
    textScaleY: 1,
    fontBoost: 0,
    compactReadable: false,
    width: 0,
    height: 0
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) {
      return undefined;
    }

    function measure() {
      frameRef.current = 0;

      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;
      const contentWidth = content.scrollWidth;
      const contentHeight = content.scrollHeight;

      if (!viewportWidth || !viewportHeight || !contentWidth || !contentHeight) {
        return;
      }

      const widthScale = viewportWidth / contentWidth;
      const heightScale = viewportHeight / contentHeight;
      const nextScale = Math.min(widthScale, heightScale);
      const widthConstrained = widthScale <= heightScale;
      const crushStartScale = 0.9;
      const crushRange = 0.28;
      // When width is the bottleneck, a tiny vertical stretch reads better
      // than uniformly crushing already stylized type.
      const textStretchProgress = widthConstrained
        ? Math.min(Math.max((crushStartScale - nextScale) / crushRange, 0), 1)
        : 0;
      const nextTextScaleY = 1 + textStretchProgress * 0.16;
      const widthTightness = Math.min(Math.max((540 - viewportWidth) / 140, 0), 1);
      const heightCapacity = Math.min(Math.max((viewportHeight - 700) / 180, 0), 1);
      const nextFontBoost = widthTightness * heightCapacity * 0.18;
      const nextCompactReadable = nextFontBoost > 0.04;

      setLayout((previousLayout) => {
        if (
          previousLayout.ready &&
          previousLayout.width === contentWidth &&
          previousLayout.height === contentHeight &&
          Math.abs(previousLayout.scale - nextScale) < 0.001 &&
          Math.abs(previousLayout.textScaleY - nextTextScaleY) < 0.001 &&
          Math.abs(previousLayout.fontBoost - nextFontBoost) < 0.001 &&
          previousLayout.compactReadable === nextCompactReadable
        ) {
          // ResizeObserver can get chatty; skip state churn when the visual
          // result is effectively unchanged.
          return previousLayout;
        }

        return {
          ready: true,
          scale: nextScale,
          textScaleY: nextTextScaleY,
          fontBoost: nextFontBoost,
          compactReadable: nextCompactReadable,
          width: contentWidth,
          height: contentHeight
        };
      });
    }

    function queueMeasure() {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = requestAnimationFrame(measure);
    }

    const resizeObserver = new ResizeObserver(() => {
      queueMeasure();
    });

    resizeObserver.observe(viewport);
    resizeObserver.observe(content);
    queueMeasure();

    document.fonts?.ready.then(() => {
      queueMeasure();
    });

    return () => {
      resizeObserver.disconnect();

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <div className="popout-viewport" ref={viewportRef}>
      <div
        className={`popout-scale-shell ${layout.ready ? "is-ready" : ""}`}
        style={
          layout.ready
            ? {
                width: `${layout.width * layout.scale}px`,
                height: `${layout.height * layout.scale}px`
              }
            : undefined
        }
      >
        <div
          className={`popout-scale-target ${layout.compactReadable ? "is-readable-compact" : ""}`}
          ref={contentRef}
          style={
            layout.ready
              ? {
                  transform: `scale(${layout.scale})`,
                  "--popout-text-scale-y": `${layout.textScaleY}`,
                  "--popout-font-boost": `${layout.fontBoost}`
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
