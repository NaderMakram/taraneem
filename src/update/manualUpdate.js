const https = require("node:https");

const LATEST_RELEASE_API_URL =
  "https://api.github.com/repos/NaderMakram/taraneem/releases/latest";
const RELEASES_PAGE_URL =
  "https://github.com/NaderMakram/taraneem/releases/latest";

function parseNumericVersion(value) {
  const match = String(value || "")
    .trim()
    .match(/^v?(\d+(?:\.\d+)*)$/i);

  if (!match) return null;
  return match[1].split(".").map((segment) => Number(segment));
}

function normalizeVersion(value) {
  const parsed = parseNumericVersion(value);
  return parsed ? parsed.join(".") : null;
}

function compareVersions(left, right) {
  const leftParts = parseNumericVersion(left);
  const rightParts = parseNumericVersion(right);

  if (!leftParts || !rightParts) {
    throw new TypeError(`Cannot compare invalid versions: ${left}, ${right}`);
  }

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

function selectMacDownloadUrl(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const dmgAssets = assets.filter(
    (asset) =>
      typeof asset?.name === "string" &&
      asset.name.toLowerCase().endsWith(".dmg") &&
      typeof asset.browser_download_url === "string"
  );
  const preferredAsset =
    dmgAssets.find((asset) => /universal/i.test(asset.name)) || dmgAssets[0];

  if (preferredAsset) return preferredAsset.browser_download_url;
  if (typeof release?.html_url === "string") return release.html_url;
  return RELEASES_PAGE_URL;
}

function createMacUpdateStatus(currentVersion, release) {
  const latestVersion = normalizeVersion(release?.tag_name);
  const normalizedCurrentVersion = normalizeVersion(currentVersion);

  if (!latestVersion || !normalizedCurrentVersion) {
    throw new TypeError("GitHub returned a release with an invalid version tag.");
  }

  const isAvailable = compareVersions(latestVersion, normalizedCurrentVersion) > 0;
  return {
    state: isAvailable ? "available" : "up-to-date",
    currentVersion: normalizedCurrentVersion,
    latestVersion,
    downloadUrl: isAvailable ? selectMacDownloadUrl(release) : null,
  };
}

function fetchLatestRelease({ timeoutMs = 8000, httpsClient = https } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpsClient.get(
      LATEST_RELEASE_API_URL,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Taraneem-macOS-update-check",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 1024 * 1024) {
            request.destroy(new Error("GitHub release response was too large."));
          }
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`GitHub release check failed (${response.statusCode}).`)
            );
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error("GitHub release check returned invalid JSON."));
          }
        });
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("GitHub release check timed out."));
    });
    request.on("error", reject);
  });
}

async function checkForMacUpdate(
  currentVersion,
  { getLatestRelease = fetchLatestRelease } = {}
) {
  const release = await getLatestRelease();
  return createMacUpdateStatus(currentVersion, release);
}

module.exports = {
  LATEST_RELEASE_API_URL,
  RELEASES_PAGE_URL,
  checkForMacUpdate,
  compareVersions,
  createMacUpdateStatus,
  fetchLatestRelease,
  normalizeVersion,
  selectMacDownloadUrl,
};
