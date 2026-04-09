export const PRACTICE_SESSION_TYPE = "practice";
export const ROUTE_SESSION_TYPE = "route";

export const SESSION_TYPES = Object.freeze([
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
]);

export function normalizeSessionType(value) {
  return value === ROUTE_SESSION_TYPE ? ROUTE_SESSION_TYPE : PRACTICE_SESSION_TYPE;
}

export function isRouteSessionType(value) {
  return normalizeSessionType(value) === ROUTE_SESSION_TYPE;
}
