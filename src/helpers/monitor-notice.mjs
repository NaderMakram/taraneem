export async function initializeMonitorNotice(api = window.myCustomAPI, root = document) {
  const notice = root.getElementById('single-monitor-notice');
  const close = root.getElementById('dismiss-monitor-notice');
  let singleMonitor = null;
  let dismissed = false;
  let updates = 0;
  const update = (state) => {
    if (typeof state?.singleMonitor !== 'boolean') return;
    updates++;
    if (singleMonitor !== state.singleMonitor) dismissed = false;
    singleMonitor = state.singleMonitor;
    notice.hidden = !singleMonitor || dismissed;
    notice.classList.toggle('show', !notice.hidden);
  };
  close.addEventListener('click', () => {
    dismissed = true;
    notice.hidden = true;
    notice.classList.remove('show');
  });
  // Subscribe first; do not let a slow initial read overwrite a newer event.
  api.onDisplayState(update);
  try {
    const initial = await api.getDisplayState();
    if (!updates) update(initial);
  } catch (error) {
    console.error('Could not read display state', error);
  }
}
