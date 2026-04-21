import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PUBLIC_MAP_DARK_STYLE_URL,
  DEFAULT_PUBLIC_MAP_LIGHT_STYLE_URL,
  getMapStyleUrl,
} from "./map";

test("map style defaults provide distinct light and dark basemaps", () => {
  assert.equal(getMapStyleUrl("light"), DEFAULT_PUBLIC_MAP_LIGHT_STYLE_URL);
  assert.equal(getMapStyleUrl("dark"), DEFAULT_PUBLIC_MAP_DARK_STYLE_URL);
  assert.notEqual(getMapStyleUrl("light"), getMapStyleUrl("dark"));
});
