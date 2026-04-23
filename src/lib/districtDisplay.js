import { areaMeta } from "../data/areaMeta.js";

const DISTRICT_TONE_CLASS_NAMES = {
  ShibuyaCho: "is-shibuya",
  Kogane: "is-kogane",
  Benten: "is-benten"
};

export function districtToneClassName(district) {
  return DISTRICT_TONE_CLASS_NAMES[district] ?? "";
}

export function areaDistrictToneClassName(area) {
  return districtToneClassName(areaMeta[area]?.district);
}
