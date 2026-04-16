export function travelWeight(fromArea, toArea, areaMeta) {
  if (fromArea === toArea) return 1.0;

  const a = areaMeta[fromArea];
  const b = areaMeta[toArea];

  if (!a || !b) return 0.1;

  if (a.district === b.district) {
    const depthDiff = Math.abs(a.depth - b.depth);
    if (depthDiff === 0) return 0.72;
    if (depthDiff === 1) return 0.24;
    return 0.06;
  }

  const exitPenalty = a.depth === 0 ? 0.03 : a.depth === 1 ? 0.015 : 0.006;
  const entryPenalty = b.depth === 0 ? 1 : 0.2;

  return exitPenalty * entryPenalty;
}
