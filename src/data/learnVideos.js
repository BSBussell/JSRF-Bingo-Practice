// 🫩

function entry(primaryVideoId, primaryLabel, variants = [], notes) {
  return {
    primaryVideoId,
    primaryLabel,
    variants,
    ...(notes ? { notes } : {})
  };
}

function variant(videoId, label) {
  return { videoId, label };
}

function playlistVariant(playlistId, label, videoId = null) {
  return {
    playlistId,
    label,
    ...(videoId ? { videoId } : {})
  };
}

const graffitiPlaylist = playlistVariant(
  "PLrqAmeXg8tekWV7QHQb5T3c8TbYxwb-ot",
  "Crabbi's Route"
);

const areaSearchTerms = {
  Dogen: ["dogen", "dogenzaka"],
  Shibuya: ["shibuya"],
  Chuo: ["chuo"],
  Hikage: ["hikage"],
  RDH: ["rdh", "rokkaku dai heights"],
  Sewers: ["sewers", "sewer", "sewage facility", "underground sewage facility"],
  BP: ["bottom point", "btm pt", "bp"],
  Kibo: ["kibo", "kibogaoka"],
  FRZ: ["frz", "fortified residential zone"],
  _99th: ["99th", "99th street"],
  SDPP: ["sdpp", "skyscraper district", "pharaoh park"],
  HWY0: ["hwy0", "hw0", "highway zero"],
  Dino: ["sky dino", "dino"]
};

const playlistCatalog = [
  {
    playlistId: graffitiPlaylist.playlistId,
    label: graffitiPlaylist.label,
    videos: [
      { videoId: "jTs81NmqAZY", title: "FRZ Bingo Graffiti Route | JG route - maze - blue device areas" },
      { videoId: "0_-S4sDePck", title: "Shibuya Bingo Graffiti Route" },
      { videoId: "i3S0R1KJeL0", title: "RDH Bingo Graffiti Route" },
      { videoId: "HZnV78p4z0s", title: "Hikage Bingo Graffiti Route" },
      { videoId: "wuPrqNDGIDA", title: "Sky Dino Bingo Graffiti Route" },
      { videoId: "KM7Wvb8TXD8", title: "Kibo Bingo Graffiti Route" },
      { videoId: "-EeF9qmuB9E", title: "SDPP Bingo Graffiti Route" },
      { videoId: "X7Zt7X0eS3g", title: "Chuo Bingo Graffiti Route" },
      { videoId: "A7xT85Q2qlo", title: "BP Bingo Graffiti Route" },
      { videoId: "Iz0eBbWVBWg", title: "Hw0 Bingo Graffiti Route" },
      { videoId: "u9I9bYdmBvs", title: "99th Street Bingo Graffiti Route" }
    ]
  }
];

function normalizeSearchText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildObjectiveKeywords(objective) {
  if (objective.type === "graffiti") {
    return ["graffiti", "route"];
  }

  return [];
}

function resolvePlaylistVideo(objective) {
  const areaTerms = areaSearchTerms[objective.area] ?? [];
  const keywords = buildObjectiveKeywords(objective);

  if (areaTerms.length === 0 || keywords.length === 0) {
    return null;
  }

  let bestMatch = null;

  for (const playlist of playlistCatalog) {
    for (const video of playlist.videos) {
      const title = normalizeSearchText(video.title);
      const matchedAreaTerm = areaTerms.find((term) =>
        title.includes(normalizeSearchText(term))
      );

      if (!matchedAreaTerm) {
        continue;
      }

      const matchedKeywords = keywords.filter((keyword) => title.includes(keyword));
      if (matchedKeywords.length === 0) {
        continue;
      }

      const score = matchedKeywords.length * 10 + matchedAreaTerm.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          score,
          manifest: entry(video.videoId, video.title, [
            playlistVariant(playlist.playlistId, playlist.label, video.videoId)
          ])
        };
      }
    }
  }

  return bestMatch?.manifest ?? null;
}

export const tapeVideosByArea = {
  Dogen: entry("10_haRdEiMQ", "Dogenzaka - Tape"),
  Shibuya: entry("f7-GfBu1NyE", "Shibuya - Tape"),
  Chuo: entry("9V2hUpCW4qc", "Chuo - Tape (from game start)"),
  Hikage: entry("oJxyMfIj1hE", "Hikage - Tape"),
  RDH: entry("qxFSOMaM7b0", "RDH - Tape"),
  FRZ: entry("mi8uoKkNJ4U", "FRZ - Tape"),
  Kibo: entry("J6H_JukieAk", "Kibogaoka - Tape"),
  _99th: entry("z6yvg87Daj0", "99th Street - Tape"),
  SDPP: entry("d8XoeQ36dUU", "SDPP - Tape"),
  HWY0: entry("M6Hj-PVQfs0", "Highway Zero - Tape"),
  Dino: entry("N8dbV888NNo", "Sky Dino - Tape")
};

export const learningVideosByObjective = {
  dogen_005: entry(
    "9mKRVjCJZI4",
    "Dogenzaka - Isolated Platform (standard)",
    [variant("k7MPN8ynz1Q", "Dogenzaka - Isolated Platform (faster pick-up, slower exit)")]
  ),
  dogen_034: entry(
    "uZwXzAH7zhA",
    "Dogenzaka - Right of Street",
    [variant("XoU7-zcfalY", "Dogenzaka - Right of Street into shibuya")]
  ),
  dogen_061: entry("jIiXwCbzEIM", "Dogenzaka - Past Statue"),
  dogen_092: entry("9Q46Z6wqgPo", "Dogenzaka - Grind x10"),
  dogen_117: entry("IeU2j0bOgss", "Dogenzaka - Air x3"),
  dogen_006: entry("u_Bj4QjVm4o", "Dogenzaka - Tricks x20"),
  dogen_035: entry("KoHafSNvZzc", "Dogenzaka - 50k Points"),
  dogen_062: entry("t6RUsWb-7-8", "Dogenzaka - Special"),
  dogen_graffiti: entry("FtzmNK2Tig4", "Dogenzaka - Graffiti Route"),

  shibuya_007: entry(
    "Hs3SfUBxa8g",
    "Shibuya - Top of bus (bus jump version)",
    [
      variant("KTMSSQWsXVM", "Shibuya - Top of bus (hard version)"),
      variant("7YIrTGH-GBk", "Shibuya - Easy jump for cubby and top of bus")
    ]
  ),
  shibuya_093: entry(
    "PMsup2HAqU0",
    "Shibuya - Cubby",
    [variant("7YIrTGH-GBk", "Shibuya - Easy jump for cubby and top of bus")]
  ),
  shibuya_119: entry(
    "25-gtQRzMqo",
    "Shibuya - Platform (easy version)",
    [variant("8RHlcMRDGMs", "Shibuya - Platform (hard version)")]
  ),
  shibuya_036: entry(
    "V9by7NpnWEc",
    "Shibuya - Grind x10",
    [variant("oQdWNqFe50I", "Shibuya - Grind x10 (boosted variant)")]
  ),
  shibuya_063: entry("RoKL7n-JCjk", "Shibuya - Air x3"),
  shibuya_094: entry("-0kKnI07KPY", "Shibuya - 25 Tricks"),
  shibuya_121: entry(
    "lEaAXERJKMM",
    "Shibuya - 100k Points",
    [variant("4Fo1M3wlhfI", "Shibuya - 100k Points (boosted variant)")]
  ),
  shibuya_008: entry(
    "BRUcI5A9MNE",
    "Shibuya - Special (13 Platforms)",
    [variant("Znq5t6SzJwQ", "Shibuya - Special (boosted variant)")]
  ),
  shibuya_graffiti: entry("gu4VwQW3744", "Shibuya - Graffiti Route"),

  chuo_037: entry("RXAkh0a9eoA", "Chuo - Canals"),
  chuo_064: entry("Fs8dUnlUhC8", "Chuo - Cubby"),
  chuo_095: entry("xdEvqjVn4jg", "Chuo - South of Hayashi"),
  chuo_122: entry("U0597XfsLO4", "Chuo - Grind x10"),
  chuo_009: entry("rJ57-yy5P_0", "Chuo - Air x4"),
  chuo_038: entry("MUZTMqbRrA0", "Chuo - Tricks x30"),
  chuo_065: entry("lV0EhH2NsyE", "Chuo - Points 60k"),
  chuo_096: entry("ikbNJDK2VCk", "Chuo - Special"),
  chuo_graffiti: entry("73wyJq6Veqg", "Chuo Street - Graffiti Route"),

  hikage_045: entry("kKWArXi9Wr0", "Hikage - Cubby"),
  hikage_073: entry("zw3iE6Do6Ik", "Hikage - Crane"),
  hikage_103: entry("hj4ikEPXFXc", "Hikage - Center Floating"),
  hikage_131: entry("qVZ0lzBoJXk", "Hikage - Grind x20"),
  hikage_018: entry("a0cscV0gFXQ", "Hikage - Air x4"),
  hikage_046: entry("7HIRVehcw2k", "Hikage - Tricks x55"),
  hikage_074: entry("OLe1DKnb_To", "Hikage - 300k Points"),
  hikage_104: entry("8nBC_-OiNJQ", "Hikage - Special"),

  rdh_010: entry(
    "ruFzt-jTL8A",
    "RDH - Top of Station (fastest)",
    [
      variant("wUg5q-Je50U", "RDH - Top of Station (boostless)"),
      variant("zEkbSCPSFA8", "RDH - Top of Station (easier)")
    ]
  ),
  rdh_039: entry(
    "IAuok30QTDU",
    "RDH - Platform above Cops 2",
    [variant("Jp2QpC4y7Ds", "RDH - Platform above cops 2 (slower, to use if other souls are on the way)")]
  ),
  rdh_123: entry("NL3wtsyqicM", "RDH - Sauna"),
  rdh_067: entry("SDJU1Hzgm0c", "RDH - Grind x10"),
  rdh_097: entry("JW-wyB92rMk", "RDH - Air x4"),
  rdh_124: entry("mtrpTOJGtMw", "RDH - Tricks x35"),
  rdh_011: entry("bPI5txg08A0", "RDH - 40k Points"),
  rdh_040: entry(
    "Z7-RvFZnFOA",
    "RDH - Special",
    [variant("fiCAgHplqNk", "RDH - Special (boosted version)")]
  ),
  rdh_unlock_rhyth: entry("SxoOSJPlleY", "RDH - Rhyth Unlock"),

  "99th_068": entry("ytwSCeHH1XE", "99th Street - Center of Dark"),
  "99th_098": entry("QhBmAitb4kI", "99th Street -  Light Wallride"),
  "99th_126": entry("5GLTdZbDujc", "99th Street - Dark Wallride"),
  "99th_012": entry(
    "5zWmUvw17T0",
    "99th Street - Grind x15",
    [variant("EhJwY6t1Lhc", "99th Street - Grind x15 Exit")]
  ),
  "99th_041": entry("gjoL70FC0Zg", "99th Street - Air x4"),
  "99th_069": entry("Lae8bP0M0bc", "99th Street - Tricks x40"),
  "99th_099": entry("Jrs5x7RgCbU", "99th Street - 100k Points"),
  "99th_127": entry("a9OLu34AvoU", "99th Street - Special"),
  "99th_graffiti": entry("u9I9bYdmBvs", "99th Street - Graffiti Route"),

  sewers_013: entry("f5PiY9Vstl4", "Sewers - Entrance"),
  sewers_042: entry("g2y0zDD5SPk", "Sewers - Center Structure"),
  sewers_070: entry(
    "HEY8iS7CueQ",
    "Sewers - Floor 1 to 2",
    [
      variant("PRHpJNwqOr4", "Sewers - Floor 1 to 2 (halfpipe jump)"),
      variant("afu586begKA", "Sewers - Floor 1 to 2 (easy mode)")
    ]
  ),
  sewers_100: entry(
    "C-X0oFBF_dI",
    "Sewers - Grind x10",
    [variant("_jdOLPXvLMo", "Sewers - Grind x10 (alternative)")]
  ),
  sewers_128: entry("hem1myZkFFU", "Sewers - Air x4"),
  sewers_015: entry("Mz1Ru5ocg08", "Sewers - Tricks x45"),
  sewers_043: entry("-VbRsEgV794", "Sewers - Points 100k"),
  sewers_071: entry("Kk3K7j4smMc", "Sewers - Special"),

  bp_016: entry("bS58OTU2JZo", "Bottom Point - Catwalk PJ Room 3"),
  bp_101: entry("vTtwDlCFNpY", "Bottom Point - Catwalk Near Cube"),
  bp_129: entry("KBwOXvsfR0Y", "Bottom Point - Halfpipe"),
  bp_044: entry(
    "QVfF--mDnW8",
    "Bottom Point - Grind x10",
    [variant("OvVryErBt50", "Bottom Point - Grind x10 (easier jump)")]
  ),
  bp_072: entry("6_ntyUCoNLY", "Bottom Point - Air x4"),
  bp_102: entry("4BJQgtRMRvo", "Bottom Point - Tricks x50"),
  bp_130: entry("5Us_C_FTkQ4", "Bottom Point - 50k Points"),
  bp_017: entry("IJGMKZicF3o", "Bottom Point - Special"),
  bp_unlock_cube: entry(
    "fuZiPl7D6zY",
    "Bottom Point - Cube Race",
    [variant("MecVUXsYXKI", "Bottom Point - Tricks Unlock Backup")],
    "Primary match is the Cube unlock route."
  ),

  frz_083: entry(
    "iUB-Knjasuc",
    "FRZ - Clip Soul",
    [variant("G8iY5fePeKA", "FRZ - Clip Soul (actual clip version)")]
  ),
  frz_111: entry("JLFh5rWMPlQ", "FRZ - Down Tube"),
  frz_139: entry("h5D59xWa-Mw", "FRZ - End of first maze"),
  frz_028: entry("K_H8CDyTTkc", "FRZ - Grind x10"),
  frz_056: entry(
    "BwxmwHkv0xE",
    "FRZ - Air x8",
    [variant("EhUr88haGM4", "FRZ - Air x8 (harder, faster, stronger)")]
  ),
  frz_084: entry("ZQFFLP3xhjc", "FRZ - Tricks x100"),
  frz_112: entry("rhsk5r9U-Ys", "FRZ - 50k Points"),
  frz_140: entry("DWbQDINqOc4", "FRZ - Special"),

  kibo_019: entry(
    "xTC7y3iSRYQ",
    "Kibogaoka - Water Tower",
    [variant("O0ngvdhp38c", "Kibogaoka - Kigobaka")]
  ),
  kibo_047: entry("HFtSNVOYYks", "Kibogaoka - Lower Platform"),
  kibo_132: entry("SaFmyTVP54A", "Kibogaoka - Upper Platform"),
  kibo_076: entry("W9ejAMQGB5g", "Kibogaoka - Grind x20"),
  kibo_105: entry("E4M-ZhFaVq0", "Kibogaoka - Air x4"),
  kibo_133: entry(
    "XBnIt7-norM",
    "Kibogaoka - Tricks x65",
    [
      variant("NmXJCAvtdK0", "Kibogaoka - Tricks + Points + Tape Unlock"),
      variant("MnDn8yVqALk", "Kibo Jump to Tricks or Points")
    ]
  ),
  kibo_021: entry(
    "pi2n38dol-4",
    "Kibogaoka - 250k Points",
    [
      variant("NmXJCAvtdK0", "Kibogaoka - Tricks + Points + Tape Unlock"),
      variant("MnDn8yVqALk", "Kibo Jump to Tricks or Points")
    ]
  ),
  kibo_049: entry(
    "X_k9LnOkMTk",
    "Kibogaoka - Special",
    [variant("-_yUh-sx61k", "Kibogaoka - Special (alternative)")]
  ),
  kibo_unlock_boogie: entry("ozODNoI5d6A", "Kibogaoka - Boogie"),

  sdpp_077: entry("_p5tCdsqoeY", "SDPP - Top of Observatory"),
  sdpp_106: entry(
    "l2aGKPcDyRA",
    "SDPP - Pink Halfpipes",
    [variant("gUUPqE_c4d8", "SDPP - Pink Halfpipes (out of map version)")]
  ),
  sdpp_134: entry("ileMluK_Uoo", "SDPP - Entrance Pillar"),
  sdpp_022: entry("1LSk_hJLFaw", "SDPP - Grind x20"),
  sdpp_050: entry("Qoc9Tbw0v-I", "SDPP - Air x4"),
  sdpp_079: entry("-mkVe2NBc98", "SDPP - Tricks x65"),
  sdpp_107: entry("dyEJVRF_QMk", "SDPP - 110k Points"),
  sdpp_135: entry("QS4zd_zHYw4", "SDPP - Special"),
  "99th_unlock_jazz": entry("oEiWfbgAMmw", "99th Street - Jazz"),

  hwy0_023: entry("pRdU4sewLcE", "Highway Zero - Directly Under Entrance"),
  hwy0_051: entry("C1cxjDaHcko", "Highway Zero - Left Alley"),
  hwy0_080: entry("SqBbYdweEb0", "Highway Zero - Trash Pit"),
  hwy0_108: entry("glOlpjZI6x0", "Highway Zero - Grind x15"),
  hwy0_136: entry(
    "DWg87OD8SLE",
    "Highway Zero -  Air x5",
    [variant("bFwpQzp6ZpQ", "Highway Zero -  Air x5 (backup)")]
  ),
  hwy0_024: entry(
    "QbByxbx5Ouo",
    "Highway Zero - Tricks x70",
    [variant("U-JFy_9ZM8s", "Highway Zero - Tricks + Tape unlock")]
  ),
  hwy0_052: entry("HcD5BfpkLCc", "Highway Zero - 90k Points"),
  hwy0_081: entry("GvNp1vCbDuo", "Highway Zero - Special"),
  hwy0_unlock_soda: entry("3mW82kFoJRI", "Highway Zero - Soda"),

  dino_026: entry("lTBdEJ0g5rc", "Sky Dino - Top of T-Rex"),
  dino_054: entry("5w9OETILuyQ", "Sky Dino - Under Brontosaurus"),
  dino_109: entry(
    "7c9HHy-uRyQ",
    "Sky Dino - Starting Spiral",
    [variant("nI6MQ3URQXA", "Sky Dino - Starting Spiral (alternative)")]
  ),
  dino_137: entry("iLDcM061IiI", "Sky Dino - Under First Swing"),
  dino_082: entry("NSpyhmwRfME", "Sky Dino - Grind x50"),
  dino_110: entry("4IqxrtbbcZY", "Sky Dino - Air x6"),
  dino_138: entry(
    "9Eg3nqtInbs",
    "Sky Dino - Tricks x100 (sad version)",
    [variant("47tYLhAQav8", "Sky Dino - Tricks + Points + Tape unlock")]
  ),
  dino_027: entry(
    "jpAqMTrApts",
    "Sky Dino - 10k Points",
    [
      variant("NXqM3aYH0KE", "Sky Dino - 10k Points (alternative death warp)"),
      variant("47tYLhAQav8", "Sky Dino - Tricks + Points + Tape unlock")
    ]
  ),
  dino_055: entry("fayKWRAv7VY", "Sky Dino - Special"),
  dino_graffiti: entry("KKco2ni8ZEU", "Sky Dino - Graffiti Route"),

  frz_graffiti: entry("jTs81NmqAZY", "FRZ - Graffiti Route"),
  hikage_graffiti: entry("HZnV78p4z0s", "Hikage - Graffiti Route"),
  kibo_graffiti: entry("KM7Wvb8TXD8", "Kibogaoka - Graffiti Route"),
  sdpp_graffiti: entry("-EeF9qmuB9E", "SDPP - Graffiti Route"),
  hwy0_graffiti: entry("Iz0eBbWVBWg", "Highway Zero - Graffiti Route"),
  bp_graffiti: entry("A7xT85Q2qlo", "Bottom Point - Graffiti Route"),
  rdh_graffiti: entry("i3S0R1KJeL0", "RDH - Graffiti Route"),
  sewers_graffiti: entry("lG9NGpofsBc", "Sewers - Graffiti Route")
};

export function resolveLearningVideoManifest(objective) {
  if (!objective) {
    return null;
  }

  return learningVideosByObjective[objective.id] ?? resolvePlaylistVideo(objective);
}
