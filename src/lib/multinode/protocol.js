function toInt(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return value | 0;
}

function dwToBytes(dw) {
  const value = toInt(dw);
  return [
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff
  ];
}

export function dwsToString(dw1, dw2, dw3) {
  const bytes = [...dwToBytes(dw1), ...dwToBytes(dw2), ...dwToBytes(dw3)];
  return String.fromCharCode(...bytes.filter((byte) => byte !== 0));
}

function normalizePacket(packetLike) {
  if (!packetLike) {
    return null;
  }

  if (typeof packetLike === "string") {
    try {
      return JSON.parse(packetLike);
    } catch {
      return null;
    }
  }

  if (typeof packetLike === "object") {
    return packetLike;
  }

  return null;
}

export function parseMultinodePacket(packetLike) {
  const packet = normalizePacket(packetLike);
  if (!packet) {
    return null;
  }

  const cat = toInt(packet.cat);
  const sub = toInt(packet.sub);

  switch (`${cat}:${sub}`) {
    case "0:2":
      return {
        type: "player_count_changed",
        count: toInt(packet.b)
      };
    case "0:4":
      return {
        type: "player_registered",
        playerIndex: toInt(packet.b),
        playerName: dwsToString(packet.dw1, packet.dw2, packet.dw3)
      };
    case "0:6":
      return {
        type: "kill_combo"
      };
    case "2:0":
      return {
        type: "tag_sprayed",
        levelId: toInt(packet.dw1),
        graffitiId: toInt(packet.dw2),
        tagId: toInt(packet.dw3),
        playerIndex: toInt(packet.src)
      };
    case "2:1":
      return {
        type: "soul_collected",
        soulId: toInt(packet.dw1) + 1,
        playerIndex: toInt(packet.src)
      };
    case "2:2":
      return {
        type: "tape_collected",
        tapeId: toInt(packet.dw1)
      };
    case "2:3":
      return {
        type: "soul_unlocked",
        soulId: toInt(packet.dw1) + 1,
        areaId: toInt(packet.dw2),
        index: toInt(packet.dw3)
      };
    case "2:4":
      return {
        type: "character_unlocked",
        characterId: toInt(packet.dw1),
        playerIndex: toInt(packet.src)
      };
    case "3:0":
      return {
        type: "area_changed",
        levelId: toInt(packet.dw1),
        playerIndex: toInt(packet.src)
      };
    default:
      return null;
  }
}
