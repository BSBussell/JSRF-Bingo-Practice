import assert from "node:assert/strict";
import test from "node:test";

import {
  compareVersions,
  normalizePlatform,
  selectBestReleaseAsset
} from "./releases.js";

function createAsset(name, size = 100) {
  return {
    name,
    browserDownloadUrl: `https://example.com/${name}`,
    size
  };
}

test("compareVersions treats v-prefixed and plain versions as equivalent", () => {
  assert.equal(compareVersions("v1.2.3", "1.2.3"), 0);
});

test("compareVersions follows numeric semver ordering", () => {
  assert.ok(compareVersions("1.10.0", "1.2.9") > 0);
  assert.ok(compareVersions("1.2.0", "1.2") === 0);
});

test("compareVersions treats stable releases as newer than prereleases", () => {
  assert.ok(compareVersions("1.2.3", "1.2.3-beta.1") > 0);
});

test("selectBestReleaseAsset prefers exe over msi on Windows", () => {
  const asset = selectBestReleaseAsset(
    [createAsset("trainer-setup.msi"), createAsset("trainer-setup.exe")],
    normalizePlatform({ os: "windows" })
  );

  assert.equal(asset?.name, "trainer-setup.exe");
});

test("selectBestReleaseAsset prefers matching Mac arm64 dmg assets", () => {
  const asset = selectBestReleaseAsset(
    [
      createAsset("trainer-x64.dmg"),
      createAsset("trainer-aarch64.dmg"),
      createAsset("trainer-universal.dmg")
    ],
    normalizePlatform({ os: "macos", arch: "arm64" })
  );

  assert.equal(asset?.name, "trainer-aarch64.dmg");
});

test("selectBestReleaseAsset falls back to universal first when Mac web arch is unknown", () => {
  const asset = selectBestReleaseAsset(
    [createAsset("trainer-x64.dmg"), createAsset("trainer-universal.dmg")],
    normalizePlatform({ os: "macos", arch: "unknown" })
  );

  assert.equal(asset?.name, "trainer-universal.dmg");
});

test("selectBestReleaseAsset prefers AppImage over deb and rpm on Linux", () => {
  const asset = selectBestReleaseAsset(
    [
      createAsset("trainer.rpm"),
      createAsset("trainer.deb"),
      createAsset("trainer.AppImage")
    ],
    normalizePlatform({ os: "linux" })
  );

  assert.equal(asset?.name, "trainer.AppImage");
});

test("selectBestReleaseAsset ignores detached signatures", () => {
  const asset = selectBestReleaseAsset(
    [createAsset("trainer.AppImage.sig"), createAsset("trainer.AppImage")],
    normalizePlatform({ os: "linux" })
  );

  assert.equal(asset?.name, "trainer.AppImage");
});
