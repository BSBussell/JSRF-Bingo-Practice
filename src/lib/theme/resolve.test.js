import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_THEME_ID, resolveTheme } from "./index.js";
import { PRESET_THEME_ORDER } from "./presets.js";

test("resolveTheme derives district route colors from the active palette", () => {
  const { cssVariables } = resolveTheme(DEFAULT_THEME_ID);

  assert.match(cssVariables["--route-district-shibuya"], /^rgb\(\d+, \d+, \d+\)$/);
  assert.match(cssVariables["--route-district-kogane"], /^rgb\(\d+, \d+, \d+\)$/);
  assert.match(cssVariables["--route-district-benten"], /^rgb\(\d+, \d+, \d+\)$/);
  assert.notEqual(cssVariables["--route-district-shibuya"], "rgb(0, 255, 0)");
  assert.notEqual(cssVariables["--route-district-kogane"], "rgb(255, 0, 0)");
  assert.notEqual(cssVariables["--route-district-benten"], "rgb(0, 0, 255)");
});

test("preset themes visibly change resolved route district colors", () => {
  const routeDistrictVariables = [
    "--route-district-shibuya",
    "--route-district-kogane",
    "--route-district-benten"
  ];

  for (const variableName of routeDistrictVariables) {
    const values = new Set(
      PRESET_THEME_ORDER.map((themeId) => resolveTheme(themeId).cssVariables[variableName])
    );

    assert.ok(values.size > 1, `${variableName} should vary across presets`);
  }
});
