(function () {
  const notepad = document.querySelector('#notepad');
  let saveTimer = null;

  // Load saved notes
  chrome.storage.local.get(['notes'], function (result) {
    if (result.notes) {
      notepad.value = result.notes;
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
