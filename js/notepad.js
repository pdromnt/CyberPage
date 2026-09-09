(function () {
  const widget = document.querySelector('#notes-widget');
  const notepad = document.querySelector('#notepad');
  let saveTimer = null;

  Promise.all([
    chrome.storage.sync.get({ notes: { show: true } }),
    chrome.storage.local.get(['notes'])
  ]).then(function ([settings, result]) {
    widget.hidden = settings.notes?.show === false;
    if (result.notes) {
      notepad.value = result.notes;
    }
  });

  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'sync' && changes.notes) {
      widget.hidden = changes.notes.newValue?.show === false;
    }
  });

  // Save on input (debounced 500ms)
  notepad.addEventListener('input', function () {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      chrome.storage.local.set({ notes: notepad.value });
    }, 500);
  });

  // Save on blur immediately
  notepad.addEventListener('blur', function () {
    chrome.storage.local.set({ notes: notepad.value });
  });
})();
