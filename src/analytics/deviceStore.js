const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function analyticsDir(userDataPath) {
  return path.join(userDataPath, "analytics");
}

function devicePath(userDataPath) {
  return path.join(analyticsDir(userDataPath), "device.json");
}

function load(userDataPath) {
  const dir = analyticsDir(userDataPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = devicePath(userDataPath);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
      console.error("[analytics] Failed to read device.json", e);
    }
  }

  const now = new Date().toISOString();
  const device = {
    device_id: crypto.randomUUID(),
    first_seen_at: now,
    country_code: null,
    region_name: null,
    city: null,
    geo_source: null,
    geo_updated_at: null,
  };
  save(userDataPath, device);
  return device;
}

function save(userDataPath, device) {
  const dir = analyticsDir(userDataPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(devicePath(userDataPath), JSON.stringify(device, null, 2), "utf-8");
}

function updateGeo(userDataPath, geo) {
  const device = load(userDataPath);
  const updated = {
    ...device,
    country_code: geo.country_code ?? device.country_code,
    region_name: geo.region_name ?? device.region_name,
    city: geo.city ?? device.city,
    geo_source: geo.geo_source ?? device.geo_source,
    geo_updated_at: geo.geo_updated_at ?? new Date().toISOString(),
  };
  save(userDataPath, updated);
  return updated;
}

function shouldRefreshGeo(device) {
  if (!device.geo_updated_at) return true;
  const ageMs = Date.now() - new Date(device.geo_updated_at).getTime();
  return ageMs > 24 * 60 * 60 * 1000;
}

module.exports = { load, save, updateGeo, shouldRefreshGeo };
