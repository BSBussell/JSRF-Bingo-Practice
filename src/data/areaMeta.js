export const areaMeta = {
  Garage: { district: "Garage", depth: -1, transitHub: true },
  Dogen: { district: "ShibuyaCho", depth: 0 },
  Shibuya: { district: "ShibuyaCho", depth: 0 },
  Chuo: { district: "ShibuyaCho", depth: 1 },
  Hikage: { district: "ShibuyaCho", depth: 1 },

  RDH: { district: "Kogane", depth: 0 },
  Sewers: { district: "Kogane", depth: 1 },
  BP: { district: "Kogane", depth: 2 },
  Kibo: { district: "Kogane", depth: 2 },
  FRZ: { district: "Kogane", depth: 2 },

  _99th: { district: "Benten", depth: 0 },
  SDPP: { district: "Benten", depth: 1 },
  HWY0: { district: "Benten", depth: 2 },
  Dino: { district: "Benten", depth: 2 }
};

export const areaOrder = [
  "Garage",
  "Dogen",
  "Shibuya",
  "Chuo",
  "Hikage",
  "RDH",
  "Sewers",
  "BP",
  "Kibo",
  "FRZ",
  "_99th",
  "SDPP",
  "HWY0",
  "Dino"
];

export const objectiveAreaOrder = areaOrder.filter((area) => !areaMeta[area]?.transitHub);

export const areaLabels = {
  Garage: "Garage",
  Dogen: "Dogen",
  Shibuya: "Shibuya",
  Chuo: "Chuo",
  Hikage: "Hikage",
  RDH: "RDH",
  Sewers: "Sewers",
  BP: "Btm pt.",
  Kibo: "Kibo",
  FRZ: "FRZ",
  _99th: "99th",
  SDPP: "SDPP",
  HWY0: "HWY0",
  Dino: "Sky Dino"
};

export const districtOrder = ["ShibuyaCho", "Kogane", "Benten"];

export const districtLabels = {
  ShibuyaCho: "Shibuya-Cho",
  Kogane: "Kogane",
  Benten: "Benten"
};

export const areasByDistrict = districtOrder.map((district) => ({
  district,
  label: districtLabels[district] ?? district,
  areas: objectiveAreaOrder.filter((area) => areaMeta[area]?.district === district)
}));

export function getAreaLabel(area) {
  return areaLabels[area] ?? area;
}
