export const ROUTE_REVEAL_MODE_ROLLING = "rolling";
export const ROUTE_REVEAL_MODE_BURST = "burst";

export const ROUTE_REVEAL_MODES = [
  ROUTE_REVEAL_MODE_ROLLING,
  ROUTE_REVEAL_MODE_BURST
];

export const DEFAULT_ROUTE_REVEAL_MODE = ROUTE_REVEAL_MODE_ROLLING;

export const ROUTE_REVEAL_MODE_LABELS = {
  [ROUTE_REVEAL_MODE_ROLLING]: "Rolling",
  [ROUTE_REVEAL_MODE_BURST]: "Burst"
};

export function normalizeRouteRevealMode(value) {
  return ROUTE_REVEAL_MODES.includes(value)
    ? value
    : DEFAULT_ROUTE_REVEAL_MODE;
}

export function getRouteRevealModeLabel(value) {
  const normalizedValue = normalizeRouteRevealMode(value);
  return ROUTE_REVEAL_MODE_LABELS[normalizedValue];
}
