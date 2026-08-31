const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Ajv = require("ajv");
const JSON5 = require("json5");
const yaml = require("js-yaml");
const { Provider } = require("electron-updater/out/providers/Provider");
const { verifyReleaseArtifacts } = require("./verify-release-artifacts");

const projectRoot = path.resolve(__dirname, "..");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hash(contents) {
  return crypto.createHash("sha512").update(contents).digest("base64");
}

function writeFixture(directory, fileName, contents) {
  fs.writeFileSync(path.join(directory, fileName), contents);
  return {
    url: fileName,
    sha512: hash(contents),
    size: Buffer.byteLength(contents),
  };
}

function testBuilderConfiguration() {
  const configText = fs.readFileSync(
    path.join(projectRoot, "electron-builder.json5"),
    "utf8"
  );
  const config = JSON5.parse(configText);
  const schema = JSON.parse(
    fs.readFileSync(
      path.join(projectRoot, "node_modules", "app-builder-lib", "scheme.json"),
      "utf8"
    )
  );
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  invariant(
    validate(config),
    "electron-builder config is invalid: " + ajv.errorsText(validate.errors)
  );
  invariant(
    config.win.artifactName ===
      "${productName}-Windows-${version}-Setup.${ext}",
    "The Windows artifact name is a compatibility contract and must not change"
  );
  invariant(
    config.win.publish.includes("github"),
    "Windows update metadata requires the GitHub publisher"
  );
  invariant(
    config.win.target[0].target === "nsis",
    "Windows auto-update requires the NSIS target"
  );
  invariant(
    config.mac.artifactName ===
      "${productName}-macOS-${version}-${arch}.${ext}",
    "Unexpected macOS artifact name"
  );
  invariant(
    Array.isArray(config.mac.target) &&
      config.mac.target.length === 1 &&
      config.mac.target[0] === "dmg",
    "macOS manual distribution must build only the DMG"
  );
  invariant(config.mac.identity === null, "macOS paid signing must be disabled");
  invariant(
    config.mac.hardenedRuntime === false,
    "Unsigned macOS builds must not enable hardened runtime"
  );
  invariant(!("notarize" in config.mac), "macOS notarization must not be required");
  invariant(!("publish" in config.mac), "macOS must not generate an auto-update feed");
}

function testUpdaterPlatformChannels() {
  invariant(
    new Provider({ platform: "win32" }).getDefaultChannelName() === "latest",
    "Windows must keep latest.yml"
  );
}

function testWorkflow() {
  const workflowText = fs.readFileSync(
    path.join(projectRoot, ".github", "workflows", "main.yml"),
    "utf8"
  );
  const workflow = yaml.load(workflowText, { schema: yaml.JSON_SCHEMA });
  const jobs = workflow.jobs || {};

  invariant(jobs["build-windows"], "Release workflow is missing the Windows build");
  invariant(jobs["build-macos"], "Release workflow is missing the macOS build");
  invariant(
    workflowText.includes("Taraneem-Windows-${{ github.ref_name }}-Setup.exe"),
    "Release workflow changed the Windows download name"
  );
  invariant(
    workflowText.includes("latest.yml"),
    "Release workflow does not upload the Windows feed"
  );
  invariant(
    !workflowText.includes("latest-mac.yml"),
    "macOS must not publish unsupported automatic-update metadata"
  );
  invariant(
    !workflowText.includes("MAC_CSC_LINK") &&
      !workflowText.includes("APPLE_API_KEY") &&
      !workflowText.includes("APPLE_API_ISSUER"),
    "Unsigned macOS builds must not require Apple signing secrets"
  );
  invariant(
    workflowText.includes('CSC_IDENTITY_AUTO_DISCOVERY: "false"'),
    "macOS signing must be explicitly disabled"
  );
  invariant(
    jobs["publish-windows"].needs === "build-windows",
    "Windows publication must depend only on the Windows build"
  );
  const macPublishNeeds = jobs["publish-macos"].needs;
  invariant(
    Array.isArray(macPublishNeeds) &&
      macPublishNeeds.includes("build-macos") &&
      macPublishNeeds.includes("publish-windows"),
    "macOS must attach its DMG after the independent Windows release"
  );
}

function testRuntimeUpdater() {
  const source = fs.readFileSync(
    path.join(projectRoot, "src", "index.js"),
    "utf8"
  );

  invariant(
    source.includes('require("electron-updater")'),
    "Runtime updater package is not loaded"
  );
  invariant(
    /if\s*\(process\.platform === "win32"\)\s*\{\s*autoUpdater\.checkForUpdates\(\);/s.test(
      source
    ),
    "Windows no longer starts its established automatic update check"
  );
  invariant(
    /if\s*\(process\.platform === "win32"\)\s*\{[\s\S]*?autoUpdater\.quitAndInstall\(\);/s.test(
      source
    ),
    "Windows can no longer install a downloaded update"
  );
  invariant(
    source.includes('require("./update/manualUpdate")') &&
      source.includes('process.platform === "darwin"') &&
      source.includes("checkMacUpdateAvailability()"),
    "macOS manual update checking is not wired into the app"
  );
}

function testArtifactVerification() {
  const version = "9.8.7";
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "taraneem-release-test-"));

  try {
    const windowsDirectory = path.join(root, "windows");
    fs.mkdirSync(windowsDirectory);
    const windowsInstaller = "Taraneem-Windows-" + version + "-Setup.exe";
    const windowsFile = writeFixture(
      windowsDirectory,
      windowsInstaller,
      "windows-installer"
    );
    fs.writeFileSync(
      path.join(windowsDirectory, windowsInstaller + ".blockmap"),
      "blockmap"
    );
    fs.writeFileSync(
      path.join(windowsDirectory, "latest.yml"),
      yaml.dump({
        version,
        files: [windowsFile],
        path: windowsInstaller,
        sha512: windowsFile.sha512,
      })
    );
    verifyReleaseArtifacts({
      platform: "windows",
      version,
      directory: windowsDirectory,
    });

    const macDirectory = path.join(root, "macos");
    fs.mkdirSync(macDirectory);
    const macInstaller = "Taraneem-macOS-" + version + "-universal.dmg";
    fs.writeFileSync(path.join(macDirectory, macInstaller), "mac-installer");
    verifyReleaseArtifacts({
      platform: "macos",
      version,
      directory: macDirectory,
    });

    fs.writeFileSync(path.join(macDirectory, macInstaller), "");
    let rejectedEmptyMacInstaller = false;
    try {
      verifyReleaseArtifacts({
        platform: "macos",
        version,
        directory: macDirectory,
      });
    } catch (error) {
      rejectedEmptyMacInstaller = true;
    }
    invariant(
      rejectedEmptyMacInstaller,
      "Artifact verification accepted an empty macOS installer"
    );

    fs.writeFileSync(
      path.join(windowsDirectory, "latest.yml"),
      yaml.dump({
        version,
        files: [{ ...windowsFile, url: "renamed.exe" }],
        path: "renamed.exe",
      })
    );
    let rejectedRename = false;
    try {
      verifyReleaseArtifacts({
        platform: "windows",
        version,
        directory: windowsDirectory,
      });
    } catch (error) {
      rejectedRename = true;
    }
    invariant(
      rejectedRename,
      "Artifact verification did not reject a renamed Windows installer"
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

testBuilderConfiguration();
testUpdaterPlatformChannels();
testWorkflow();
testRuntimeUpdater();
testArtifactVerification();
console.log("Release configuration and updater compatibility tests passed.");