(function () {
  'use strict';

  // ── Weather settings ────────────────────────────────────

  function loadWeatherSettings() {
    chrome.storage.sync.get({ weather: {} }, function (result) {
      const cfg = result.weather || {};
      document.getElementById('display-weather').checked = !!cfg.show;
      document.getElementById('openweather-key').value = cfg.apiKey || '';
      document.getElementById('weather-location').value = cfg.location || '';

      if (cfg.units === 'imperial') {
        document.getElementById('fahrenheit').checked = true;
      } else {
        document.getElementById('celsius').checked = true;
      }
    });
  }

  function saveWeatherSettings() {
    const show = document.getElementById('display-weather').checked;
    const apiKey = document.getElementById('openweather-key').value.trim();
    const location = document.getElementById('weather-location').value.trim();
    const units = document.getElementById('fahrenheit').checked ? 'imperial' : 'metric';

    chrome.storage.sync.get({ weather: {} }, function (result) {
      const cfg = result.weather || {};
      cfg.show = show;
      cfg.apiKey = apiKey;
      cfg.location = location;
      cfg.units = units;
      chrome.storage.sync.set({ weather: cfg });
    });
  }

  // ── RSS feeds ───────────────────────────────────────────

  function loadRssFeeds() {
    chrome.storage.sync.get({ rssFeeds: [] }, function (result) {
      const feeds = result.rssFeeds || [];
      renderRssFeedList(feeds);
    });
  }

  function renderRssFeedList(feeds) {
    const container = document.getElementById('rss-feeds-list');
    if (!feeds.length) {
      container.innerHTML = '<p class="hint">No feeds configured. Click "Add Feed" below.</p>';
      return;
    }

    container.innerHTML = feeds.map((feed, i) => `
      <div class="rss-feed-item" data-index="${i}">
        <input type="text" class="label-input" value="${escapeAttr(feed.label || '')}" placeholder="Label" data-field="label" data-index="${i}">
        <input type="text" class="url-input" value="${escapeAttr(feed.url || '')}" placeholder="https://example.com/feed.xml" data-field="url" data-index="${i}">
        <button type="button" class="remove-btn" data-index="${i}">×</button>
      </div>
    `).join('');

    // Add handlers
    container.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const idx = parseInt(this.dataset.index);
        removeRssFeed(idx);
      });
    });
  }

  function removeRssFeed(index) {
    chrome.storage.sync.get({ rssFeeds: [] }, function (result) {
      const feeds = result.rssFeeds || [];
      feeds.splice(index, 1);
      chrome.storage.sync.set({ rssFeeds: feeds }, function () {
        renderRssFeedList(feeds);
      });
    });
  }

  function addRssFeed() {
    chrome.storage.sync.get({ rssFeeds: [] }, function (result) {
      const feeds = result.rssFeeds || [];
      feeds.push({ url: '', label: '' });
      chrome.storage.sync.set({ rssFeeds: feeds }, function () {
        renderRssFeedList(feeds);
      });
    });
  }

  function collectRssFeeds() {
    const items = document.querySelectorAll('.rss-feed-item');
    const feeds = [];
    items.forEach(item => {
      const labelInput = item.querySelector('.label-input');
      const urlInput = item.querySelector('.url-input');
      if (labelInput && urlInput) {
        feeds.push({
          label: labelInput.value.trim(),
          url: urlInput.value.trim()
        });
      }
    });
    chrome.storage.sync.set({ rssFeeds: feeds });
  }

  // ── Quick links ──────────────────────────────────────────

  function loadQuickLinks() {
    fetch('data/sites.json')
      .then(response => response.json())
      .then(sites => {
        chrome.storage.sync.get({ selectedSites: [] }, function (result) {
          const selected = result.selectedSites || [];
          const container = document.querySelector('.quick-links-container');
          container.innerHTML = '';

          sites.forEach(site => {
            const sel = selected.find(s => s.name === site.id);
            const checked = sel ? sel.selected : true;

            const div = document.createElement('div');
            div.className = 'site';
            div.innerHTML = `
              <label>
                <input type="checkbox" data-site="${site.id}" ${checked ? 'checked' : ''}>
                ${site.name || site.id}
              </label>
            `;
            container.appendChild(div);
          });
        });
      });
  }

  function saveQuickLinks() {
    const checkboxes = document.querySelectorAll('.quick-links-container input[data-site]');
    const selectedSites = [];
    checkboxes.forEach(cb => {
      selectedSites.push({
        name: cb.dataset.site,
        selected: cb.checked
      });
    });
    chrome.storage.sync.set({ selectedSites });
  }

  // ── Bookmarks ────────────────────────────────────────────

  function loadBookmarks() {
    chrome.storage.sync.get({ bookmarks: [] }, function (result) {
      const bookmarks = result.bookmarks || [];
      renderBookmarksList(bookmarks);
    });
  }

  function renderBookmarksList(bookmarks) {
    const container = document.getElementById('bookmarks-list');
    container.innerHTML = '';

    bookmarks.forEach((cat, catIdx) => {
      const li = document.createElement('li');
      li.className = 'bookmark-option-category';
      li.innerHTML = `
        <ul>
          <li>
            <input type="text" class="category-name" value="${escapeAttr(cat.category || '')}" placeholder="Category name" data-cat="${catIdx}">
            <button type="button" class="remove-btn remove-category" data-cat="${catIdx}">×</button>
          </li>
          ${(cat.links || []).map((link, linkIdx) => `
            <li>
              <input type="text" class="link-title" value="${escapeAttr(link.title || '')}" placeholder="Title" data-cat="${catIdx}" data-link="${linkIdx}">
              <input type="text" class="link-url" value="${escapeAttr(link.url || '')}" placeholder="https://..." data-cat="${catIdx}" data-link="${linkIdx}">
              <button type="button" class="remove-btn remove-link" data-cat="${catIdx}" data-link="${linkIdx}">×</button>
            </li>
          `).join('')}
          <li><button type="button" class="add-link" data-cat="${catIdx}">+ Add Link</button></li>
        </ul>
      `;
      container.appendChild(li);
    });

    // Add category button
    document.getElementById('add-category').onclick = addCategory;

    // Category remove handlers
    container.querySelectorAll('.remove-category').forEach(btn => {
      btn.addEventListener('click', function () {
        const catIdx = parseInt(this.dataset.cat);
        chrome.storage.sync.get({ bookmarks: [] }, function (result) {
          const bookmarks = result.bookmarks || [];
          bookmarks.splice(catIdx, 1);
          chrome.storage.sync.set({ bookmarks }, function () {
            renderBookmarksList(bookmarks);
          });
        });
      });
    });

    // Link remove handlers
    container.querySelectorAll('.remove-link').forEach(btn => {
      btn.addEventListener('click', function () {
        const catIdx = parseInt(this.dataset.cat);
        const linkIdx = parseInt(this.dataset.link);
        chrome.storage.sync.get({ bookmarks: [] }, function (result) {
          const bookmarks = result.bookmarks || [];
          if (bookmarks[catIdx] && bookmarks[catIdx].links) {
            bookmarks[catIdx].links.splice(linkIdx, 1);
            chrome.storage.sync.set({ bookmarks }, function () {
              renderBookmarksList(bookmarks);
            });
          }
        });
      });
    });

    // Add link handlers
    container.querySelectorAll('.add-link').forEach(btn => {
      btn.addEventListener('click', function () {
        const catIdx = parseInt(this.dataset.cat);
        chrome.storage.sync.get({ bookmarks: [] }, function (result) {
          const bookmarks = result.bookmarks || [];
          if (bookmarks[catIdx]) {
            bookmarks[catIdx].links = bookmarks[catIdx].links || [];
            bookmarks[catIdx].links.push({ title: '', url: '' });
            chrome.storage.sync.set({ bookmarks }, function () {
              renderBookmarksList(bookmarks);
            });
          }
        });
      });
    });
  }

  function addCategory() {
    chrome.storage.sync.get({ bookmarks: [] }, function (result) {
      if (result.bookmarks.length >= 5) {
        setStatus('Max 5 categories', 'error');
        return;
      }
      const bookmarks = result.bookmarks || [];
      bookmarks.push({ category: '', links: [] });
      chrome.storage.sync.set({ bookmarks }, function () {
        renderBookmarksList(bookmarks);
      });
    });
  }

  function collectBookmarks() {
    chrome.storage.sync.get({ bookmarks: [] }, function (result) {
      const bookmarks = result.bookmarks || [];

      // Collect category names
      document.querySelectorAll('.category-name').forEach(input => {
        const catIdx = parseInt(input.dataset.cat);
        if (bookmarks[catIdx]) {
          bookmarks[catIdx].category = input.value.trim();
        }
      });

      // Collect link titles
      document.querySelectorAll('.link-title').forEach(input => {
        const catIdx = parseInt(input.dataset.cat);
        const linkIdx = parseInt(input.dataset.link);
        if (bookmarks[catIdx] && bookmarks[catIdx].links && bookmarks[catIdx].links[linkIdx]) {
          bookmarks[catIdx].links[linkIdx].title = input.value.trim();
        }
      });

      // Collect link URLs
      document.querySelectorAll('.link-url').forEach(input => {
        const catIdx = parseInt(input.dataset.cat);
        const linkIdx = parseInt(input.dataset.link);
        if (bookmarks[catIdx] && bookmarks[catIdx].links && bookmarks[catIdx].links[linkIdx]) {
          bookmarks[catIdx].links[linkIdx].url = input.value.trim();
        }
      });

      chrome.storage.sync.set({ bookmarks });
    });
  }

  // ── Export / Import ──────────────────────────────────────

  function exportSettings() {
    chrome.storage.sync.get(null, function (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cyberpage-settings.json';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Exported', 'saved');
    });
  }

  function importSettings(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        chrome.storage.sync.set(data, function () {
          setStatus('Imported successfully. Reload to see changes.', 'saved');
          // Reload all fields
          loadWeatherSettings();
          loadRssFeeds();
          loadQuickLinks();
          loadBookmarks();
        });
      } catch (err) {
        setStatus('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  }

  // ── Status ───────────────────────────────────────────────

  function setStatus(msg, type) {
    const status = document.getElementById('status');
    status.textContent = msg;
    status.className = type || '';
    if (type === 'saved') {
      setTimeout(() => { status.textContent = ''; status.className = ''; }, 3000);
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Language ─────────────────────────────────────────────

  async function populateLanguages() {
    const langSelect = document.getElementById('language');
    if (!langSelect) return;

    try {
      const response = await fetch('i18n/languages.json');
      const languages = await response.json();
      langSelect.innerHTML = '';
      languages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.name;
        langSelect.appendChild(option);
      });

      // Restore saved language
      chrome.storage.sync.get({ language: 'en' }, function (result) {
        langSelect.value = result.language || 'en';
      });

      // Restore saved date format
      chrome.storage.sync.get({ dateFormat: 'locale' }, function (result) {
        const df = document.getElementById('date-format');
        if (df) df.value = result.dateFormat || 'locale';
      });
    } catch (e) {
      console.error('Failed to load languages:', e);
    }
  }

  function saveLanguage() {
    const langSelect = document.getElementById('language');
    if (!langSelect) return;
    chrome.storage.sync.set({ language: langSelect.value });
  }

  function saveDateFormat() {
    const df = document.getElementById('date-format');
    if (df) chrome.storage.sync.set({ dateFormat: df.value });
  }

  // ── Save all ─────────────────────────────────────────────

  function saveAll() {
    saveLanguage();
    saveDateFormat();
    saveWeatherSettings();
    collectRssFeeds();
    saveQuickLinks();
    collectBookmarks();
    setStatus('Saved', 'saved');
  }

  // ── Init ─────────────────────────────────────────────────

  document.getElementById('add-rss-feed').addEventListener('click', addRssFeed);
  document.getElementById('save').addEventListener('click', saveAll);
  document.getElementById('export-all').addEventListener('click', exportSettings);
  document.getElementById('import-all-file').addEventListener('change', function () {
    if (this.files && this.files[0]) {
      importSettings(this.files[0]);
    }
  });

  // Load everything
  populateLanguages();
  loadWeatherSettings();
  loadRssFeeds();
  loadQuickLinks();
  loadBookmarks();
})();
