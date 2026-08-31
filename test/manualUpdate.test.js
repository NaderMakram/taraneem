const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  RELEASES_PAGE_URL,
  checkForMacUpdate,
  compareVersions,
  createMacUpdateStatus,
  normalizeVersion,
  selectMacDownloadUrl,
} = require("../src/update/manualUpdate");

test("compares numeric release tags without lexicographic mistakes", () => {
  assert.equal(compareVersions("3.10.0", "3.9.9"), 1);
  assert.equal(compareVersions("v3.5.3", "3.5.3.0"), 0);
  assert.equal(compareVersions("3.5.2", "3.5.3"), -1);
  assert.equal(normalizeVersion("v12.4"), "12.4");
  assert.equal(normalizeVersion("release-3.5.3"), null);
});

test("reports a newer macOS release and selects its universal DMG", () => {
  const status = createMacUpdateStatus("3.5.3", {
    tag_name: "3.6.0",
    html_url: "https://github.com/NaderMakram/taraneem/releases/tag/3.6.0",
    assets: [
      {
        name: "Taraneem-macOS-3.6.0-x64.dmg",
        browser_download_url: "https://example.test/x64.dmg",
      },
      {
        name: "Taraneem-macOS-3.6.0-Universal.dmg",
        browser_download_url: "https://example.test/universal.dmg",
      },
    ],
  });

  assert.deepEqual(status, {
    state: "available",
    currentVersion: "3.5.3",
    latestVersion: "3.6.0",
    downloadUrl: "https://example.test/universal.dmg",
  });
});

test("does not offer a download for the current or an older release", () => {
  for (const tagName of ["3.5.3", "3.5.2"]) {
    const status = createMacUpdateStatus("3.5.3", {
      tag_name: tagName,
      assets: [],
    });
    assert.equal(status.state, "up-to-date");
    assert.equal(status.downloadUrl, null);
  }
});

test("falls back to the release page when the DMG is still being uploaded", () => {
  const releaseUrl =
    "https://github.com/NaderMakram/taraneem/releases/tag/3.6.0";
  assert.equal(selectMacDownloadUrl({ html_url: releaseUrl, assets: [] }), releaseUrl);
  assert.equal(selectMacDownloadUrl({ assets: [] }), RELEASES_PAGE_URL);
});

test("the asynchronous check uses the injected release source", async () => {
  const status = await checkForMacUpdate("3.5.3", {
    getLatestRelease: async () => ({
      tag_name: "3.5.4",
      assets: [
        {
          name: "Taraneem-macOS-3.5.4-Universal.dmg",
          browser_download_url: "https://example.test/taraneem.dmg",
        },
      ],
    }),
  });

  assert.equal(status.state, "available");
  assert.equal(status.latestVersion, "3.5.4");
});

test("rejects release tags that cannot be safely compared", () => {
  assert.throws(() =>
    createMacUpdateStatus("3.5.3", { tag_name: "not-a-version" })
  );
});
