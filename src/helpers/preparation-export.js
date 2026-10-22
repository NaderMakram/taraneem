export function initializePreparationExport() {
  const button = document.getElementById('export-preparation');
  const aspectRatio = document.getElementById('export-aspect-ratio');
  const status = document.getElementById('export-status');
  myCustomAPI.onExportProgress(({ current, total }) => {
    status.textContent = `جارٍ التصدير… ${current} / ${total}`;
  });
  button.addEventListener('click', async () => {
    button.disabled = true;
    aspectRatio.disabled = true;
    status.textContent = '';
    try {
      const waiting = JSON.parse(localStorage.getItem('waiting_list') || '[]');
      if (!Array.isArray(waiting) || !waiting.some((item) => item?.custom_ref?.includes('song'))) {
        status.textContent = 'أضف ترنيمة إلى قائمة التحضير أولاً';
        return;
      }
      status.textContent = 'اختر مكان حفظ الملف';
      const result = await myCustomAPI.exportPreparation({
        waiting, aspectRatio: aspectRatio.value,
        fontSize: Number(document.getElementById('fontSize').textContent),
      });
      status.textContent = result.canceled ? '' : `تم تصدير ${result.slideCount} شريحة`;
    } catch (error) {
      console.error('Preparation export failed', error);
      status.textContent = 'تعذر التصدير. تحقق من مكان الحفظ وحاول مرة أخرى';
    } finally {
      button.disabled = false;
      aspectRatio.disabled = false;
    }
  });
}
