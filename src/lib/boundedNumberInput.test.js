import assert from "node:assert/strict";
import test from "node:test";

import { resolveBoundedNumberCommit } from "./boundedNumberInput.js";

test("resolveBoundedNumberCommit allows draft overflow but clamps on commit", () => {
  assert.equal(
    resolveBoundedNumberCommit({
      draftValue: "40",
      committedValue: 4,
      min: 1,
      max: 10,
      normalizeValue: Math.round
    }),
    10
  );
});

test("resolveBoundedNumberCommit allows draft underflow but clamps on commit", () => {
  assert.equal(
    resolveBoundedNumberCommit({
      draftValue: "-3",
      committedValue: 4,
      min: 1,
      max: 10,
      normalizeValue: Math.round
    }),
    1
  );
});

test("resolveBoundedNumberCommit reverts empty or invalid drafts to the committed value", () => {
  assert.equal(
    resolveBoundedNumberCommit({
      draftValue: "",
      committedValue: 7,
      min: 1,
      max: 10
    }),
    7
  );

  assert.equal(
    resolveBoundedNumberCommit({
      draftValue: "abc",
      committedValue: 7,
      min: 1,
      max: 10
    }),
    7
  );
});

test("resolveBoundedNumberCommit preserves float parsing until normalization", () => {
  assert.equal(
    resolveBoundedNumberCommit({
      draftValue: "2.6",
      committedValue: 1,
      min: 0,
      max: 5,
      normalizeValue: Math.round
    }),
    3
  );
});
