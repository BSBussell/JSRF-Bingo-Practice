import assert from "node:assert/strict";
import test from "node:test";

import { resolveLearningVideoManifest } from "./learnVideos.js";

test("explicit graffiti video mappings do not include the shared playlist variant", () => {
  const manifest = resolveLearningVideoManifest({
    id: "sdpp_graffiti",
    area: "SDPP",
    type: "graffiti"
  });

  assert.equal(manifest?.primaryVideoId, "-EeF9qmuB9E");
  assert.equal(manifest?.primaryLabel, "SDPP - Graffiti Route");
  assert.deepEqual(manifest?.variants, []);
});

test("graffiti playlist fallback still resolves an area-specific video when no explicit mapping exists", () => {
  const manifest = resolveLearningVideoManifest({
    id: "unknown_sdpp_graffiti",
    area: "SDPP",
    type: "graffiti"
  });

  assert.equal(manifest?.primaryVideoId, "-EeF9qmuB9E");
  assert.equal(manifest?.primaryLabel, "SDPP Bingo Graffiti Route");
  assert.deepEqual(manifest?.variants, [
    {
      playlistId: "PLrqAmeXg8tekWV7QHQb5T3c8TbYxwb-ot",
      label: "Crabbi's Route",
      videoId: "-EeF9qmuB9E"
    }
  ]);
});
