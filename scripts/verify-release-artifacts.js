const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { findFile } = require("electron-updater/out/providers/Provider");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha512(filePath) {
  return crypto
    .createHash("sha512")
    .update(fs.readFileSync(filePath))
    .digest("base64");
}

function readMetadata(directory, metadataName) {
  const metadataPath = path.join(directory, metadataName);
  invariant(fs.existsSync(metadataPath), `Missing ${metadataName}`);

  const metadata = yaml.load(fs.readFileSync(metadataPath, "utf8"));
  invariant(metadata && typeof metadata === "object", `${metadataName} is invalid`);
  invariant(Array.isArray(metadata.files), `${metadataName} must contain a files list`);
  invariant(metadata.files.length > 0, `${metadataName} has no downloadable files`);
  return metadata;
}

function verifyListedFiles(directory, metadata) {
  for (const file of metadata.files) {
    invariant(file && typeof file.url === "string", "Update file URL is missing");
    invariant(!path.isAbsolute(file.url), `Update URL must be relative: ${file.url}`);
    invariant(path.basename(file.url) === file.url, `Update URL must be a file name: ${file.url}`);
    invariant(typeof file.sha512 === "string" && file.sha512.length > 0, `Missing SHA-512 for ${file.url}`);

    const artifactPath = path.join(directory, file.url);
    invariant(fs.existsSync(artifactPath), `Metadata references missing artifact ${file.url}`);

    const stats = fs.statSync(artifactPath);
    if (file.size !== undefined) {
      invariant(file.size === stats.size, `Incorrect size for ${file.url}`);
    }
    invariant(file.sha512 === sha512(artifactPath), `Incorrect SHA-512 for ${file.url}`);
  }
}

function verifyReleaseArtifacts({ platform, version, directory }) {
  invariant(/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version), `Invalid release version: ${version}`);

  const resolvedDirectory = path.resolve(directory);
  invariant(fs.existsSync(resolvedDirectory), `Release directory does not exist: ${resolvedDirectory}`);

  if (platform === "windows") {
    const installerName = `Taraneem-Windows-${version}-Setup.exe`;
    const metadata = readMetadata(resolvedDirectory, "latest.yml");

    invariant(metadata.version === version, `latest.yml version must be ${version}`);
    invariant(fs.existsSync(path.join(resolvedDirectory, installerName)), `Missing ${installerName}`);
    invariant(
      fs.existsSync(path.join(resolvedDirectory, `${installerName}.blockmap`)),
      `Missing ${installerName}.blockmap`
    );
    invariant(metadata.path === installerName, "latest.yml changed the legacy Windows installer path");
    invariant(
      metadata.files.some((file) => file.url === installerName),
      "latest.yml does not reference the established Windows installer name"
    );
    invariant(
      metadata.files.every((file) => !file.url.includes("macOS")),
      "latest.yml must remain Windows-only"
    );

    verifyListedFiles(resolvedDirectory, metadata);
    return { metadata: "latest.yml", installer: installerName };
  }

  if (platform === "macos") {
    const artifactBase = `Taraneem-macOS-${version}-universal`;
    const dmgName = `${artifactBase}.dmg`;
    const zipName = `${artifactBase}.zip`;
    const metadata = readMetadata(resolvedDirectory, "latest-mac.yml");

    invariant(metadata.version === version, `latest-mac.yml version must be ${version}`);
    invariant(fs.existsSync(path.join(resolvedDirectory, dmgName)), `Missing ${dmgName}`);
    invariant(fs.existsSync(path.join(resolvedDirectory, zipName)), `Missing ${zipName}`);
    invariant(metadata.path === zipName, "latest-mac.yml legacy path must point to the updater ZIP");
    invariant(
      metadata.files.some((file) => file.url === dmgName),
      "latest-mac.yml does not reference the DMG"
    );

    const resolvedFiles = metadata.files.map((file) => ({
      url: new URL(file.url, "https://example.invalid/download/"),
      info: file,
    }));
    const updaterFile = findFile(resolvedFiles, "zip", ["pkg", "dmg"]);
    invariant(updaterFile && path.basename(updaterFile.url.pathname) === zipName, "macOS updater would not select the ZIP");
    invariant(
      metadata.files.every((file) => !file.url.endsWith(".exe")),
      "latest-mac.yml must remain macOS-only"
    );

    verifyListedFiles(resolvedDirectory, metadata);
    return { metadata: "latest-mac.yml", installer: dmgName, updater: zipName };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    invariant(key && key.startsWith("--") && value, `Invalid argument near ${key || "the end"}`);
    options[key.slice(2)] = value;
  }
  return options;
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = verifyReleaseArtifacts({
      platform: options.platform,
      version: options.version,
      directory: options.dir,
    });
    console.log(`Verified ${options.platform} release artifacts: ${JSON.stringify(result)}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { verifyReleaseArtifacts };
