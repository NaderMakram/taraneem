const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function outboxPath(userDataPath) {
  return path.join(userDataPath, "analytics", "outbox.json");
}

function read(userDataPath) {
  const filePath = outboxPath(userDataPath);
  if (!fs.existsSync(filePath)) {
    return { pending: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(data.pending)) {
      return { pending: [] };
    }
    return data;
  } catch (e) {
    console.error("[analytics] Failed to read outbox", e);
    return { pending: [] };
  }
}

function write(userDataPath, data) {
  const dir = path.dirname(outboxPath(userDataPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = outboxPath(userDataPath) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, outboxPath(userDataPath));
}

function enqueue(userDataPath, item) {
  const data = read(userDataPath);
  data.pending.push({
    queue_id: crypto.randomUUID(),
    table: item.table,
    op: item.op,
    payload: item.payload,
    synced: false,
    created_at: new Date().toISOString(),
  });
  write(userDataPath, data);
}

function getPending(userDataPath) {
  return read(userDataPath).pending.filter((item) => !item.synced);
}

function markSynced(userDataPath, queueIds) {
  const data = read(userDataPath);
  const idSet = new Set(queueIds);
  data.pending = data.pending.map((item) =>
    idSet.has(item.queue_id) ? { ...item, synced: true } : item
  );
  // Compact synced items older than 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  data.pending = data.pending.filter((item) => {
    if (!item.synced) return true;
    return new Date(item.created_at).getTime() > cutoff;
  });
  write(userDataPath, data);
}

module.exports = { enqueue, getPending, markSynced, read };
