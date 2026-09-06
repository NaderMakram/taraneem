(() => {
  const scene = document.getElementById("scene");
  const text = document.getElementById("text");
  const reference = document.getElementById("reference");
  const params = new URLSearchParams(location.search);
  document.body.dataset.layer = ["all", "text", "reference"].includes(params.get("layer")) ? params.get("layer") : "all";
  document.body.dataset.preview = params.get("preview") === "1" ? "true" : "false";
  let lastRevision = -1;
  let lastEpoch = null;
  let disconnectTimer;
  const px = value => `${value}px`;
  const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(",");
  function scale() {
    const width = Number.parseFloat(getComputedStyle(scene).width) || 1920;
    const height = Number.parseFloat(getComputedStyle(scene).height) || 1080;
    scene.style.transform = `scale(${Math.min(innerWidth / width, innerHeight / height)})`;
  }
  function clear() { text.textContent = ""; reference.textContent = ""; document.body.dataset.empty = "true"; }
  function render(snapshot) {
    if (!snapshot || !Number.isSafeInteger(snapshot.revision) || typeof snapshot.epoch !== "string") return;
    if (snapshot.epoch === lastEpoch && snapshot.revision < lastRevision) return;
    if (snapshot.epoch !== lastEpoch) { lastEpoch = snapshot.epoch; lastRevision = -1; }
    lastRevision = snapshot.revision;
    clearTimeout(disconnectTimer); disconnectTimer = null;
    const s = snapshot.settings;
    const type = snapshot.content?.kind === "bible" || snapshot.content?.kind === "heading" ? s.bible : s.song;
    const ref = s.reference;
    const fontNames = { times: "TaraneemTimes", traditional: "TaraneemTraditional", plex: "TaraneemPlex", din: "TaraneemDin", adobe: "TaraneemAdobe" };
    const inlineReference = ref.show && ref.position === "inline";
    const textWidth = inlineReference ? s.textArea.width - ref.width - s.appearance.padding : s.textArea.width;
    const refX = inlineReference ? s.textArea.x + textWidth + s.appearance.padding : ref.x;
    const refY = inlineReference ? s.textArea.y : ref.y;
    const refHeight = inlineReference ? s.textArea.height : ref.height;
    const variables = {
      "--canvas-w": px(s.canvas.width), "--canvas-h": px(s.canvas.height),
      "--text-x": px(s.textArea.x), "--text-y": px(s.textArea.y), "--text-w": px(textWidth), "--text-h": px(s.textArea.height),
      "--padding": px(s.appearance.padding), "--radius": px(s.appearance.radius),
      "--banner-rgb": rgb(s.appearance.bannerColor), "--banner-alpha": String(s.appearance.bannerOpacity),
      "--text-color": s.appearance.textColor, "--text-align": type.align, "--font-size": px(snapshot.content?.fontSize || type.fontSize), "--font-weight": String(type.fontWeight), "--font-family": fontNames[type.font] || fontNames.times,
      "--ref-x": px(refX), "--ref-y": px(refY), "--ref-w": px(ref.width), "--ref-h": px(refHeight),
      "--ref-size": px(ref.fontSize), "--ref-color": ref.color, "--ref-align": ref.align, "--ref-justify": ref.align === "center" ? "center" : "flex-start",
    };
    for (const [name, value] of Object.entries(variables)) scene.style.setProperty(name, value);
    document.body.dataset.preset = s.appearance.preset;
    document.body.dataset.shadow = String(s.appearance.shadow);
    document.body.dataset.reference = String(ref.show && Boolean(snapshot.reference));
    document.body.dataset.hidden = String(!snapshot.visible || !snapshot.mode);
    const lines = snapshot.content?.lines || [];
    text.textContent = lines.join("\n");
    reference.textContent = snapshot.reference || "";
    document.body.dataset.empty = String(lines.length === 0);
    scale();
  }
  const events = new EventSource(`/events${location.search}`);
  events.addEventListener("snapshot", event => { try { render(JSON.parse(event.data)); } catch (_error) { clear(); } });
  events.onerror = () => { if (!disconnectTimer) disconnectTimer = setTimeout(clear, 3000); };
  addEventListener("resize", scale);
  scale(); clear();
})();
