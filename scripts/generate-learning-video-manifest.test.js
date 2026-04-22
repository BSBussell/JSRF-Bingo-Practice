import assert from "node:assert/strict";
import test from "node:test";

import { buildLearningVideoManifest } from "./generate-learning-video-manifest.mjs";

const objectives = [
  {
    id: "dogen_005",
    area: "Dogen",
    code: "005",
    type: "default",
    target: null,
    description: "Isolated Platform down the hill"
  },
  {
    id: "sdpp_graffiti",
    area: "SDPP",
    code: "graffiti",
    type: "graffiti",
    target: null,
    description: "Spray 100% GRAFFITI"
  },
  {
    id: "hwy0_136",
    area: "HWY0",
    code: "136",
    type: "air_count",
    target: 5,
    description: "Air x 5"
  },
  {
    id: "bp_130",
    area: "BP",
    code: "130",
    type: "points_goal",
    target: 50000,
    description: "Points x 50k"
  },
  {
    id: "99th_098",
    area: "_99th",
    code: "098",
    type: "default",
    target: null,
    description: "Light Wallride"
  },
  {
    id: "sewers_graffiti",
    area: "Sewers",
    code: "graffiti",
    type: "graffiti",
    target: null,
    description: "Spray 100% GRAFFITI"
  },
  {
    id: "kibo_133",
    area: "Kibo",
    code: "133",
    type: "trick_count",
    target: 60,
    description: "Tricks x 60"
  }
];

function buildManifest(playlistResults) {
  return buildLearningVideoManifest({
    playlistResults,
    objectives,
    areas: ["Dogen", "Shibuya"],
    titleAliasesByObjectiveId: {
      sewers_graffiti: ["JSRF Bingo Sewers route"],
      kibo_133: ["Kibogaoka - Tape unlock to tricks", "Kibogaoka - Tape unlock to points"]
    },
    generatedAt: "2026-04-22T00:00:00.000Z"
  });
}

test("playlist metadata becomes explicit objective and area manifest entries", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: [
        {
          videoId: "square-video",
          title: "Dogenzaka - Isolated Platform",
          sourceKey: "primary",
          position: 1
        },
        {
          videoId: "tape-video",
          title: "Dogenzaka - Tape",
          sourceKey: "primary",
          position: 2
        }
      ]
    }
  ]);

  assert.equal(manifest.objectives.dogen_005.primary.videoId, "square-video");
  assert.equal(manifest.areas.Dogen.tape.videoId, "tape-video");
});

test("primary source wins over fallback when both match", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: [
        {
          videoId: "primary-match",
          title: "SDPP - Graffiti Route",
          sourceKey: "primary",
          position: 1
        }
      ]
    },
    {
      key: "fallback",
      label: "Fallback",
      url: "https://youtube.com/playlist?list=fallback",
      playlistId: "fallback",
      videos: [
        {
          videoId: "fallback-match",
          title: "SDPP Bingo Graffiti Route",
          sourceKey: "fallback",
          position: 1
        }
      ]
    }
  ]);

  assert.equal(manifest.objectives.sdpp_graffiti.primary.videoId, "primary-match");
  assert.deepEqual(
    manifest.objectives.sdpp_graffiti.variants.map((variant) => variant.videoId),
    ["fallback-match"]
  );
});

test("additional matches from the winning source become variants", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: [
        {
          videoId: "hard-version",
          title: "Dogenzaka - Isolated Platform hard version",
          sourceKey: "primary",
          position: 2
        },
        {
          videoId: "standard-version",
          title: "Dogenzaka - Isolated Platform",
          sourceKey: "primary",
          position: 1
        }
      ]
    }
  ]);

  assert.equal(manifest.objectives.dogen_005.primary.videoId, "standard-version");
  assert.deepEqual(
    manifest.objectives.dogen_005.variants.map((variant) => variant.videoId),
    ["hard-version"]
  );
});

test("fallback objective matches become variants when primary source has a match", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: [
        {
          videoId: "primary-match",
          title: "Dogenzaka - Isolated Platform",
          sourceKey: "primary",
          position: 1
        }
      ]
    },
    {
      key: "fallback",
      label: "Fallback",
      url: "https://youtube.com/playlist?list=fallback",
      playlistId: "fallback",
      videos: [
        {
          videoId: "fallback-match",
          title: "Dogenzaka - Isolated Platform backup",
          sourceKey: "fallback",
          position: 1
        }
      ]
    }
  ]);

  assert.equal(manifest.objectives.dogen_005.primary.videoId, "primary-match");
  assert.deepEqual(
    manifest.objectives.dogen_005.variants.map((variant) => variant.videoId),
    ["fallback-match"]
  );
  assert.deepEqual(manifest.areas.Dogen?.miscTech, undefined);
});

test("fallback source fills entries missing from primary", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: []
    },
    {
      key: "fallback",
      label: "Fallback",
      url: "https://youtube.com/playlist?list=fallback",
      playlistId: "fallback",
      videos: [
        {
          videoId: "fallback-match",
          title: "SDPP Bingo Graffiti Route",
          sourceKey: "fallback",
          position: 1
        }
      ]
    }
  ]);

  assert.equal(manifest.objectives.sdpp_graffiti.primary.videoId, "fallback-match");
  assert.equal(manifest.objectives.sdpp_graffiti.primary.sourceKey, "fallback");
});

test("diagnostics include unmatched objectives and missing tape areas", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: [
        {
          videoId: "match",
          title: "Highway Zero - Air x5",
          sourceKey: "primary",
          position: 1
        }
      ]
    }
  ]);

  assert.deepEqual(manifest.diagnostics.unmatchedObjectiveIds, [
    "dogen_005",
    "sdpp_graffiti",
    "bp_130",
    "99th_098",
    "sewers_graffiti",
    "kibo_133"
  ]);
  assert.deepEqual(manifest.diagnostics.areasMissingTape, ["Dogen", "Shibuya"]);
  assert.deepEqual(manifest.diagnostics.unrecognizedMiscTechVideoIds, []);
});

test("title aliases resolve unconventional playlist titles without runtime mappings", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: [
        {
          videoId: "alias-match",
          title: "JSRF Bingo Sewers route",
          sourceKey: "primary",
          position: 1
        }
      ]
    }
  ]);

  assert.equal(manifest.objectives.sewers_graffiti.primary.videoId, "alias-match");
});

test("variant collection does not match point-area titles or sibling wallrides too loosely", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: [
        {
          videoId: "points-match",
          title: "Bottom Point - 50k Points",
          sourceKey: "primary",
          position: 1
        },
        {
          videoId: "tricks-not-points",
          title: "Bottom Point - Tricks x50",
          sourceKey: "primary",
          position: 2
        },
        {
          videoId: "light-wallride",
          title: "99th Street - Light Wallride",
          sourceKey: "primary",
          position: 3
        },
        {
          videoId: "dark-wallride",
          title: "99th Street - Dark Wallride",
          sourceKey: "primary",
          position: 4
        }
      ]
    }
  ]);

  assert.equal(manifest.objectives.bp_130.primary.videoId, "points-match");
  assert.deepEqual(manifest.objectives.bp_130.variants, []);
  assert.equal(manifest.objectives["99th_098"].primary.videoId, "light-wallride");
  assert.deepEqual(manifest.objectives["99th_098"].variants, []);
});

test("multiple title aliases can produce a primary guide and variant", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: [
        {
          videoId: "tricks-alias",
          title: "Kibogaoka - Tape unlock to tricks",
          sourceKey: "primary",
          position: 1
        },
        {
          videoId: "points-alias",
          title: "Kibogaoka - Tape unlock to points",
          sourceKey: "primary",
          position: 2
        }
      ]
    }
  ]);

  assert.equal(manifest.objectives.kibo_133.primary.videoId, "tricks-alias");
  assert.deepEqual(
    manifest.objectives.kibo_133.variants.map((variant) => variant.videoId),
    ["points-alias"]
  );
});

test("unlock aliases are authoritative so similarly named tech falls through to misc tech", () => {
  const manifest = buildLearningVideoManifest({
    playlistResults: [
      {
        key: "primary",
        label: "Primary",
        url: "https://youtube.com/playlist?list=primary",
        playlistId: "primary",
        videos: [
          {
            videoId: "stall-launch",
            title: "Kibogaoka - Stall Launch (Boogie Warp)",
            sourceKey: "primary",
            position: 1
          },
          {
            videoId: "boogie-unlock",
            title: "Kibogaoka - Boogie",
            sourceKey: "primary",
            position: 2
          }
        ]
      }
    ],
    objectives: [
      {
        id: "kibo_unlock_boogie",
        area: "Kibo",
        code: "unlock_boogie",
        type: "unlock",
        target: null,
        description: "Unlock Boogie"
      }
    ],
    areas: ["Kibo"],
    titleAliasesByObjectiveId: {
      kibo_unlock_boogie: ["Kibogaoka - Boogie"]
    },
    generatedAt: "2026-04-22T00:00:00.000Z"
  });

  assert.equal(manifest.objectives.kibo_unlock_boogie.primary.videoId, "boogie-unlock");
  assert.deepEqual(manifest.objectives.kibo_unlock_boogie.variants, []);
  assert.deepEqual(
    manifest.areas.Kibo.miscTech.map((video) => video.videoId),
    ["stall-launch"]
  );
});

test("unconsumed area-matched playlist entries become area misc tech", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: [
        {
          videoId: "area-tech",
          title: "Dogenzaka movement tech",
          sourceKey: "primary",
          position: 1
        }
      ]
    }
  ]);

  assert.deepEqual(manifest.areas.Dogen.miscTech, [
    {
      videoId: "area-tech",
      title: "Dogenzaka movement tech",
      sourceKey: "primary"
    }
  ]);
});

test("objective and tape videos are not duplicated into misc tech", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: [
        {
          videoId: "square-video",
          title: "Dogenzaka - Isolated Platform",
          sourceKey: "primary",
          position: 1
        },
        {
          videoId: "tape-video",
          title: "Dogenzaka - Tape",
          sourceKey: "primary",
          position: 2
        }
      ]
    }
  ]);

  assert.equal(manifest.objectives.dogen_005.primary.videoId, "square-video");
  assert.equal(manifest.areas.Dogen.tape.videoId, "tape-video");
  assert.equal(manifest.areas.Dogen.miscTech, undefined);
  assert.deepEqual(manifest.miscTech.unrecognized, []);
});

test("unconsumed entries without an area match become unrecognized misc tech", () => {
  const manifest = buildManifest([
    {
      key: "primary",
      label: "Primary",
      url: "https://youtube.com/playlist?list=primary",
      playlistId: "primary",
      videos: [
        {
          videoId: "unrecognized-tech",
          title: "General JSRF camera notes",
          sourceKey: "primary",
          position: 1
        }
      ]
    }
  ]);

  assert.deepEqual(manifest.miscTech.unrecognized, [
    {
      videoId: "unrecognized-tech",
      title: "General JSRF camera notes",
      sourceKey: "primary"
    }
  ]);
  assert.deepEqual(manifest.diagnostics.unrecognizedMiscTechVideoIds, ["unrecognized-tech"]);
});
