import test from "node:test";
import assert from "node:assert/strict";

import { resolveMultinodeAutomarkAction } from "./automarkDispatch.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../session/sessionTypes.js";

test("travel phase area_changed routes to travel action only", () => {
  const action = resolveMultinodeAutomarkAction({
    event: { type: "area_changed", levelId: 65538 },
    sessionType: PRACTICE_SESSION_TYPE,
    phase: "travel"
  });

  assert.equal(action.type, "practice-travel");
});

test("tape phase tape_collected routes to tape action only", () => {
  const action = resolveMultinodeAutomarkAction({
    event: { type: "tape_collected", tapeId: 2 },
    sessionType: PRACTICE_SESSION_TYPE,
    phase: "tape"
  });

  assert.equal(action.type, "practice-tape");
  assert.notEqual(action.type, "practice-objective");
});

test("challenge phase collectible routes to objective completion action", () => {
  const action = resolveMultinodeAutomarkAction({
    event: { type: "soul_collected", soulId: 5 },
    sessionType: PRACTICE_SESSION_TYPE,
    phase: "challenge"
  });

  assert.equal(action.type, "practice-objective");
});

test("tape event during tape phase does not route to objective completion", () => {
  const action = resolveMultinodeAutomarkAction({
    event: { type: "tape_collected", tapeId: 2 },
    sessionType: PRACTICE_SESSION_TYPE,
    phase: "tape"
  });

  assert.equal(action.type, "practice-tape");
  assert.notEqual(action.type, "practice-objective");
});

test("route match routes to one visible slot clear action", () => {
  const action = resolveMultinodeAutomarkAction({
    event: { type: "soul_collected", soulId: 5 },
    sessionType: ROUTE_SESSION_TYPE,
    routeSlotIndex: 3
  });

  assert.deepEqual(
    {
      type: action.type,
      routeSlotIndex: action.routeSlotIndex
    },
    {
      type: "route-slot",
      routeSlotIndex: 3
    }
  );
});

test("wrong practice event routes to no action", () => {
  const action = resolveMultinodeAutomarkAction({
    event: { type: "soul_collected", soulId: 5 },
    sessionType: PRACTICE_SESSION_TYPE,
    phase: "travel"
  });

  assert.equal(action.type, "none");
});

test("route match without a visible slot index routes to no action", () => {
  const action = resolveMultinodeAutomarkAction({
    event: { type: "soul_collected", soulId: 5 },
    sessionType: ROUTE_SESSION_TYPE
  });

  assert.equal(action.type, "none");
});
