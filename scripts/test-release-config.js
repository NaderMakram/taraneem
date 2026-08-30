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
  const configText = fs.readFileSync(path.join(projectRoot, "electron-builder.json5"), "utf8");
  const config = JSON5.parse(configText);
  const schema = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "node_modules", "app-builder-lib", "scheme.json"), "utf8")
  );
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  invariant(validate(config), `electron-builder config is invalid: ${ajv.errorsText(validate.errors)}`);
  invariant(
    config.win.artifactName === "${productName}-Windows-${version}-Setup.${ext}",
    "The Windows artifact name is a compatibility contract and must not change"
  );
  invariant(config.win.publish.includes("github"), "Windows update metadata requires the GitHub publisher");
  invariant(config.win.target[0].target === "nsis", "Windows auto-update requires the NSIS target");
  invariant(
    config.mac.artifactName === "${productName}-macOS-${version}-${arch}.${ext}",
    "Unexpected macOS artifact name"
  );
  invariant(config.mac.target.includes("dmg"), "macOS downloads require a DMG");
  invariant(config.mac.target.includes("zip"), "macOS auto-update requires a ZIP");
  invariant(config.mac.publish.includes("github"), "macOS update metadata requires the GitHub publisher");
  invariant(config.mac.hardenedRuntime === true, "macOS notarization requires hardened runtime");
  invariant(config.mac.notarize === true, "macOS release builds must be notarized");
}

function testUpdaterPlatformChannels() {
  invariant(new Provider({ platform: "win32" }).getDefaultChannelName() === "latest", "Windows must keep latest.yml");
  invariant(new Provider({ platform: "darwin" }).getDefaultChannelName() === "latest-mac", "macOS must use latest-mac.yml");
}

function testWorkflow() {
  const workflowText = fs.readFileSync(path.join(projectRoot, ".github", "workflows", "main.yml"), "utf8");
  yaml.load(workflowText, { schema: yaml.JSON_SCHEMA });

  invariant(workflowText.includes("runs-on: windows-latest"), "Release workflow is missing the Windows build");
  invariant(workflowText.includes("runs-on: macos-latest"), "Release workflow is missing the macOS build");
  invariant(
    workflowText.includes("Taraneem-Windows-${{ github.ref_name }}-Setup.exe"),
    "Release workflow changed the Windows download name"
  );
  invariant(workflowText.includes("latest.yml"), "Release workflow does not upload the Windows feed");
  invariant(workflowText.includes("latest-mac.yml"), "Release workflow does not upload the macOS feed");
  invariant(workflowText.includes("draft: true"), "Release must remain hidden until all assets are uploaded");
  invariant(
    workflowText.includes('gh release edit "$GITHUB_REF_NAME" --draft=false --latest'),
    "Release workflow does not publish the completed draft"
  );
}

function testRuntimeUpdater() {
  const source = fs.readFileSync(path.join(projectRoot, "src", "index.js"), "utf8");
  invariant(source.includes('require("electron-updater")'), "Runtime updater package is not loaded");
  invariant(source.includes("autoUpdater.checkForUpdates()"), "App no longer checks for updates");
  invariant(source.includes("autoUpdater.quitAndInstall()"), "App can no longer install a downloaded update");
}

function testArtifactVerification() {
  const version = "9.8.7";
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "taraneem-release-test-"));

  try {
    const windowsDirectory = path.join(root, "windows");
    fs.mkdirSync(windowsDirectory);
    const windowsInstaller = `Taraneem-Windows-${version}-Setup.exe`;
    const windowsFile = writeFixture(windowsDirectory, windowsInstaller, "windows-installer");
    fs.writeFileSync(path.join(windowsDirectory, `${windowsInstaller}.blockmap`), "blockmap");
    fs.writeFileSync(
      path.join(windowsDirectory, "latest.yml"),
      yaml.dump({ version, files: [windowsFile], path: windowsInstaller, sha512: windowsFile.sha512 })
    );
    verifyReleaseArtifacts({ platform: "windows", version, directory: windowsDirectory });

    const macDirectory = path.join(root, "macos");
    fs.mkdirSync(macDirectory);
    const macBase = `Taraneem-macOS-${version}-universal`;
    const zipFile = writeFixture(macDirectory, `${macBase}.zip`, "mac-updater");
    const dmgFile = writeFixture(macDirectory, `${macBase}.dmg`, "mac-installer");
    fs.writeFileSync(
      path.join(macDirectory, "latest-mac.yml"),
      yaml.dump({ version, files: [zipFile, dmgFile], path: zipFile.url, sha512: zipFile.sha512 })
    );
    verifyReleaseArtifacts({ platform: "macos", version, directory: macDirectory });

    fs.writeFileSync(path.join(macDirectory, zipFile.url), "tampered-update");
    let rejectedTamperedUpdate = false;
    try {
      verifyReleaseArtifacts({ platform: "macos", version, directory: macDirectory });
    } catch (error) {
      rejectedTamperedUpdate = true;
    }
    invariant(
      rejectedTamperedUpdate,
      "Artifact verification did not reject a macOS update with a mismatched hash"
    );

    fs.writeFileSync(
      path.join(windowsDirectory, "latest.yml"),
      yaml.dump({ version, files: [{ ...windowsFile, url: "renamed.exe" }], path: "renamed.exe" })
    );
    let rejectedRename = false;
    try {
      verifyReleaseArtifacts({ platform: "windows", version, directory: windowsDirectory });
    } catch (error) {
      rejectedRename = true;
    }
    invariant(rejectedRename, "Artifact verification did not reject a renamed Windows installer");
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
