import test from "node:test";
import assert from "node:assert/strict";

import { dwsToString, parseMultinodePacket } from "./protocol.js";

function stringToDws(name) {
  const bytes = new Array(12).fill(0);
  for (let index = 0; index < Math.min(name.length, 12); index += 1) {
    bytes[index] = name.charCodeAt(index);
  }

  const readDw = (startIndex) =>
    (bytes[startIndex] & 0xff) |
    ((bytes[startIndex + 1] & 0xff) << 8) |
    ((bytes[startIndex + 2] & 0xff) << 16) |
    ((bytes[startIndex + 3] & 0xff) << 24);

  return [readDw(0), readDw(4), readDw(8)];
}

test("dwsToString decodes null-terminated bytes packed into three dwords", () => {
  const [dw1, dw2, dw3] = stringToDws("7thAce");
  assert.equal(dwsToString(dw1, dw2, dw3), "7thAce");
});

test("parseMultinodePacket maps 0:2 player_count_changed", () => {
  assert.deepEqual(parseMultinodePacket({ cat: 0, sub: 2, b: 3 }), {
    type: "player_count_changed",
    count: 3
  });
});

test("parseMultinodePacket maps 0:4 player_registered", () => {
  const [dw1, dw2, dw3] = stringToDws("Cube");
  assert.deepEqual(parseMultinodePacket({ cat: 0, sub: 4, b: 1, dw1, dw2, dw3 }), {
    type: "player_registered",
    playerIndex: 1,
    playerName: "Cube"
  });
});

test("parseMultinodePacket maps 0:6 kill_combo", () => {
  assert.deepEqual(parseMultinodePacket({ cat: 0, sub: 6 }), {
    type: "kill_combo"
  });
});

test("parseMultinodePacket maps 2:0 tag_sprayed", () => {
  assert.deepEqual(
    parseMultinodePacket({
      cat: 2,
      sub: 0,
      dw1: 65536,
      dw2: 45,
      dw3: -229377,
      src: 2
    }),
    {
      type: "tag_sprayed",
      levelId: 65536,
      graffitiId: 45,
      tagId: -229377,
      playerIndex: 2
    }
  );
});

test("parseMultinodePacket maps 2:1 soul_collected with +1 soulId offset", () => {
  assert.deepEqual(parseMultinodePacket({ cat: 2, sub: 1, dw1: 0, src: 4 }), {
    type: "soul_collected",
    soulId: 1,
    playerIndex: 4
  });
});

test("parseMultinodePacket maps 2:2 tape_collected", () => {
  assert.deepEqual(parseMultinodePacket({ cat: 2, sub: 2, dw1: 12 }), {
    type: "tape_collected",
    tapeId: 12
  });
});

test("parseMultinodePacket maps 2:3 soul_unlocked with +1 soulId offset", () => {
  assert.deepEqual(parseMultinodePacket({ cat: 2, sub: 3, dw1: 9, dw2: 65539, dw3: 2 }), {
    type: "soul_unlocked",
    soulId: 10,
    areaId: 65539,
    index: 2
  });
});

test("parseMultinodePacket maps 2:4 character_unlocked", () => {
  assert.deepEqual(parseMultinodePacket({ cat: 2, sub: 4, dw1: 10, src: 0 }), {
    type: "character_unlocked",
    characterId: 10,
    playerIndex: 0
  });
});

test("parseMultinodePacket maps 3:0 area_changed", () => {
  assert.deepEqual(parseMultinodePacket({ cat: 3, sub: 0, dw1: 196612, src: 3 }), {
    type: "area_changed",
    levelId: 196612,
    playerIndex: 3
  });
});

test("parseMultinodePacket accepts JSON string packets", () => {
  assert.deepEqual(parseMultinodePacket('{"cat":2,"sub":2,"dw1":5}'), {
    type: "tape_collected",
    tapeId: 5
  });
});

test("parseMultinodePacket returns null for unknown mappings", () => {
  assert.equal(parseMultinodePacket({ cat: 9, sub: 9 }), null);
});
