import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBingopediaLearningVideoSources,
  buildBingopediaMiscTechRows,
  buildBingopediaTapeRow,
  buildLearningVideoSources,
  resolveAreaMiscTechManifest,
  resolveLearningVideoManifest,
  resolveTapeVideoManifest,
  resolveUnrecognizedMiscTechManifest
} from "./learnVideos.js";

const syntheticManifest = {
  schemaVersion: 1,
  generatedAt: "2026-04-22T00:00:00.000Z",
  sources: [],
  objectives: {
    dogen_005: {
      primary: {
        videoId: "square-video",
        title: "Dogenzaka - Isolated Platform",
        sourceKey: "primary"
      },
      variants: [
        {
          videoId: "variant-video",
          title: "Dogenzaka - Isolated Platform Alternative",
          sourceKey: "primary"
        }
      ]
    },
    invalid_primary: {
      primary: {
        title: "Missing Video ID",
        sourceKey: "primary"
      }
    }
  },
  areas: {
    Dogen: {
      tape: {
        videoId: "tape-video",
        title: "Dogenzaka - Tape",
        sourceKey: "primary"
      },
      miscTech: [
        {
          videoId: "area-tech-video",
          title: "Dogenzaka movement tech",
          sourceKey: "primary"
        },
        {
          videoId: "area-tech-variant",
          title: "Dogenzaka movement tech variant",
          sourceKey: "fallback"
        }
      ]
    },
    Chuo: {
      tape: {
        title: "Missing Tape Video ID",
        sourceKey: "primary"
      }
    }
  },
  miscTech: {
    unrecognized: [
      {
        videoId: "unrecognized-tech-video",
        title: "General JSRF camera notes",
        sourceKey: "primary"
      }
    ]
  },
  diagnostics: {
    unmatchedObjectiveIds: [],
    areasMissingTape: [],
    unrecognizedMiscTechVideoIds: []
  }
};

test("objective lookup returns the explicit manifest video", () => {
  const manifest = resolveLearningVideoManifest({ id: "dogen_005" }, syntheticManifest);

  assert.deepEqual(manifest, {
    primaryVideoId: "square-video",
    primaryLabel: "Dogenzaka - Isolated Platform",
    variants: [
      {
        videoId: "variant-video",
        label: "Dogenzaka - Isolated Platform Alternative",
        sourceKey: "primary"
      }
    ]
  });
});

test("area tape lookup returns the explicit manifest video", () => {
  const manifest = resolveTapeVideoManifest("Dogen", syntheticManifest);

  assert.deepEqual(manifest, {
    primaryVideoId: "tape-video",
    primaryLabel: "Dogenzaka - Tape",
    variants: []
  });
});

test("missing manifest entries return null instead of inferred fallbacks", () => {
  assert.equal(resolveLearningVideoManifest({ id: "unknown_objective" }, syntheticManifest), null);
  assert.equal(resolveTapeVideoManifest("Shibuya", syntheticManifest), null);
  assert.equal(resolveAreaMiscTechManifest("Shibuya", syntheticManifest), null);
});

test("partial invalid manifest entries are ignored gracefully", () => {
  assert.equal(resolveLearningVideoManifest({ id: "invalid_primary" }, syntheticManifest), null);
  assert.equal(resolveTapeVideoManifest("Chuo", syntheticManifest), null);
});

test("practice source helper prefers tape phase and otherwise returns square source", () => {
  const objective = {
    id: "dogen_005",
    area: "Dogen"
  };

  assert.deepEqual(
    buildLearningVideoSources({
      objective,
      phaseInfo: { phase: "tape", needsTape: true },
      library: syntheticManifest
    }).map((source) => source.key),
    ["tape"]
  );
  assert.deepEqual(
    buildLearningVideoSources({
      objective,
      phaseInfo: { phase: "challenge", needsTape: true },
      library: syntheticManifest
    }).map((source) => source.key),
    ["square"]
  );
});

test("Bingopedia source helper returns square source without embedding tape entries", () => {
  assert.deepEqual(
    buildBingopediaLearningVideoSources(
      {
        area: "Dogen",
        needsTape: true,
        objective: { id: "dogen_005" }
      },
      syntheticManifest
    ).map((source) => source.key),
    ["square"]
  );
  assert.deepEqual(
    buildBingopediaLearningVideoSources(
      {
        area: "Shibuya",
        needsTape: true,
        objective: { id: "unknown_objective" }
      },
      syntheticManifest
    ),
    []
  );
});

test("Bingopedia tape helper returns a selectable row per area tape guide", () => {
  assert.deepEqual(buildBingopediaTapeRow("Dogen", syntheticManifest), {
    id: "tape:Dogen",
    area: "Dogen",
    title: "Dogenzaka - Tape",
    sources: [
      {
        key: "tape",
        label: "Tape Guide",
        manifest: {
          primaryVideoId: "tape-video",
          primaryLabel: "Dogenzaka - Tape",
          variants: []
        }
      }
    ]
  });
  assert.equal(buildBingopediaTapeRow("Shibuya", syntheticManifest), null);
});

test("area misc tech lookup returns explicit manifest videos", () => {
  assert.deepEqual(resolveAreaMiscTechManifest("Dogen", syntheticManifest), {
    primaryVideoId: "area-tech-video",
    primaryLabel: "Dogenzaka movement tech",
    variants: [
      {
        videoId: "area-tech-variant",
        label: "Dogenzaka movement tech variant",
        sourceKey: "fallback"
      }
    ]
  });
});

test("unrecognized misc tech lookup returns explicit manifest videos", () => {
  assert.deepEqual(resolveUnrecognizedMiscTechManifest(syntheticManifest), {
    primaryVideoId: "unrecognized-tech-video",
    primaryLabel: "General JSRF camera notes",
    variants: []
  });
});

test("Bingopedia misc tech helper returns selectable rows per video", () => {
  const dogenRows = buildBingopediaMiscTechRows("Dogen", syntheticManifest);
  const shibuyaRows = buildBingopediaMiscTechRows("Shibuya", syntheticManifest);

  assert.deepEqual(
    dogenRows.map((row) => [row.id, row.title, row.groupLabel]),
    [
      ["misc-tech:area:Dogen:area-tech-video", "Dogenzaka movement tech", "Misc. Tech"],
      ["misc-tech:area:Dogen:area-tech-variant", "Dogenzaka movement tech variant", "Misc. Tech"],
      [
        "misc-tech:unrecognized:unrecognized-tech-video",
        "General JSRF camera notes",
        "Unrecognized"
      ]
    ]
  );
  assert.deepEqual(shibuyaRows.map((row) => row.id), [
    "misc-tech:unrecognized:unrecognized-tech-video"
  ]);
  assert.deepEqual(dogenRows[0].sources[0].manifest, {
    primaryVideoId: "area-tech-video",
    primaryLabel: "Dogenzaka movement tech",
    variants: []
  });
});
