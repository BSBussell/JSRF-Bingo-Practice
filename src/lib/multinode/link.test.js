import test from "node:test";
import assert from "node:assert/strict";

import { parseMultinodePeerId } from "./link.js";

test("parseMultinodePeerId reads ?connect= from full URL", () => {
  assert.equal(
    parseMultinodePeerId(
      "https://jsrfmulti.surge.sh/bingo/?connect=ac8d9422-20c7-4a1e-88a3-58aa0e3e6959"
    ),
    "ac8d9422-20c7-4a1e-88a3-58aa0e3e6959"
  );
});

test("parseMultinodePeerId reads connect from query-only input", () => {
  assert.equal(
    parseMultinodePeerId("connect=abc-123"),
    "abc-123"
  );
});
