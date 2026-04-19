import assert from "node:assert/strict";
import test from "node:test";

import {
  getListingPublicVisibility,
  getListingPublicVisibilityLabel,
  isPublicDiscoveryListing,
  isPublicDiscoveryStatus,
} from "./visibility";

test("published is the only public discovery status", () => {
  assert.equal(isPublicDiscoveryStatus("published"), true);
  assert.equal(isPublicDiscoveryStatus("draft"), false);
  assert.equal(isPublicDiscoveryStatus("approved"), false);
});

test("listing public visibility is explicit and label-driven", () => {
  assert.equal(getListingPublicVisibility("published"), "public");
  assert.equal(getListingPublicVisibility("unpublished"), "private");
  assert.equal(
    getListingPublicVisibilityLabel("published"),
    "Visible on explore, listing detail, and map discovery."
  );
  assert.equal(
    getListingPublicVisibilityLabel("draft"),
    "Hidden from public discovery until it is published."
  );
});

test("public discovery helper reads listing-shaped objects directly", () => {
  assert.equal(isPublicDiscoveryListing({ listing_status: "published" }), true);
  assert.equal(isPublicDiscoveryListing({ listing_status: "hidden_by_admin" }), false);
});
