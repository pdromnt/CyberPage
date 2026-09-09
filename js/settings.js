(function () {
  'use strict';

  const MAX_FEEDS = 20;
  const MAX_CATEGORIES = 5;
  const MAX_LINKS = 10;
  let rssFeeds = [];
  let bookmarks = [];
  let availableSites = [];
  let supportedLanguages = ['en'];

  async function loadAll() {
    await populateLanguages();
    const [syncData, localData, sites] = await Promise.all([
      chrome.storage.sync.get({
        language: 'en',
        dateFormat: 'locale',
        todo: { show: true },
        weather: {},
        tides: {},
        rssFeeds: [],
        selectedSites: [],
        bookmarks: []
      }),
      chrome.storage.local.get({ tidecheckApiKey: '' }),
      fetch('data/sites.json').then(response => {
        if (!response.ok) throw new Error('Could not load sites');
        return response.json();
      })
    ]);

    document.getElementById('language').value = syncData.language || 'en';
    document.getElementById('date-format').value = syncData.dateFormat || 'locale';
    document.getElementById('display-todo').checked = syncData.todo?.show !== false;
    loadWeatherSettings(syncData.weather);
    await loadTidesSettings(syncData.tides, localData.tidecheckApiKey);
    if (syncData.weather?.apiKey) {
      const cleanWeather = { ...syncData.weather };
      delete cleanWeather.apiKey;
      await chrome.storage.sync.set({ weather: cleanWeather });
    }

    rssFeeds = normalizeFeeds(syncData.rssFeeds, false);
    bookmarks = normalizeBookmarks(syncData.bookmarks, false);
    availableSites = Array.isArray(sites) ? sites : [];
    renderRssFeedList();
    renderQuickLinks(syncData.selectedSites);
    renderBookmarksList();
  }

  function loadWeatherSettings(cfg = {}) {
    document.getElementById('display-weather').checked = !!cfg.show;
    document.getElementById('weather-location').value = stringValue(cfg.location);
    document.getElementById(cfg.units === 'imperial' ? 'fahrenheit' : 'celsius').checked = true;
  }

  async function loadTidesSettings(cfg = {}, localApiKey = '') {
    const legacyApiKey = stringValue(cfg.apiKey);
    const apiKey = localApiKey || legacyApiKey;
    document.getElementById('display-tides').checked = !!cfg.show;
    document.getElementById('tidecheck-key').value = apiKey;
    document.getElementById('tides-station').value = stringValue(cfg.stationId);

    if (legacyApiKey) {
      const clean = { ...cfg };
      delete clean.apiKey;
      await Promise.all([
        chrome.storage.local.set({ tidecheckApiKey: apiKey }),
        chrome.storage.sync.set({ tides: clean })
      ]);
    }
  }

  function renderRssFeedList() {
    const container = document.getElementById('rss-feeds-list');
    container.replaceChildren();
    if (!rssFeeds.length) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'No feeds configured. Click "Add Feed" below.';
      container.appendChild(hint);
      return;
    }

    rssFeeds.forEach((feed, index) => {
      const item = document.createElement('div');
      item.className = 'rss-feed-item';
      item.dataset.index = index;
      item.append(
        makeInput('label-input', feed.label, 'Label', 'label', index),
        makeInput('url-input', feed.url, 'https://example.com/feed.xml', 'url', index),
        makeIconButton('lni-trash-can', 'Remove feed', 'remove-btn', { index })
      );
      container.appendChild(item);
    });

    container.querySelectorAll('.remove-btn').forEach(button => {
      button.addEventListener('click', () => {
        rssFeeds = readRssForm();
        rssFeeds.splice(Number(button.dataset.index), 1);
        renderRssFeedList();
      });
    });
  }

  function addRssFeed() {
    rssFeeds = readRssForm();
    if (rssFeeds.length >= MAX_FEEDS) {
      setStatus('Max 20 feeds', 'error');
      return;
    }
    rssFeeds.push({ label: '', url: '' });
    renderRssFeedList();
    document.querySelector('.rss-feed-item:last-child .label-input')?.focus();
  }

  function readRssForm() {
    return [...document.querySelectorAll('.rss-feed-item')].map(item => ({
      label: item.querySelector('.label-input').value.trim(),
      url: item.querySelector('.url-input').value.trim()
    }));
  }

  function renderQuickLinks(selectedSites = readQuickLinks()) {
    const selected = new Map((Array.isArray(selectedSites) ? selectedSites : [])
      .map(site => [site?.name, !!site?.selected]));
    const container = document.querySelector('.quick-links-container');
    container.replaceChildren();

    availableSites.forEach(site => {
      const wrapper = document.createElement('div');
      wrapper.className = 'site';
      const label = document.createElement('label');
      const icon = document.createElement('span');
      icon.className = 'lni ' + stringValue(site.icon);
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.site = site.id;
      checkbox.checked = selected.get(site.id) || false;
      label.append(icon, checkbox, document.createTextNode(site.name || site.id));
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  }

  function readQuickLinks() {
    return [...document.querySelectorAll('.quick-links-container input[data-site]')].map(checkbox => ({
      name: checkbox.dataset.site,
      selected: checkbox.checked
    }));
  }

  function renderBookmarksList() {
    const container = document.getElementById('bookmarks-list');
    container.replaceChildren();

    bookmarks.forEach((category, categoryIndex) => {
      const categoryItem = document.createElement('li');
      categoryItem.className = 'bookmark-option-category';
      const list = document.createElement('ul');
      const header = document.createElement('li');
      header.append(
        makeInput('category-name', category.category, 'Category name', 'cat', categoryIndex),
        makeIconButton('lni-trash-can', 'Remove category', 'remove-btn remove-category', { cat: categoryIndex })
      );
      list.appendChild(header);

      category.links.forEach((link, linkIndex) => {
        const row = document.createElement('li');
        row.append(
          makeBookmarkInput('link-title', link.title, 'Title', categoryIndex, linkIndex),
          makeBookmarkInput('link-url', link.url, 'https://...', categoryIndex, linkIndex),
          makeIconButton('lni-trash-can', 'Remove bookmark', 'remove-btn remove-link', { cat: categoryIndex, link: linkIndex })
        );
        list.appendChild(row);
      });

      const addRow = document.createElement('li');
      addRow.appendChild(makeButton('+ Add Link', 'add-link', { cat: categoryIndex }));
      list.appendChild(addRow);
      categoryItem.appendChild(list);
      container.appendChild(categoryItem);
    });

    container.querySelectorAll('.remove-category').forEach(button => {
      button.addEventListener('click', () => {
        bookmarks = readBookmarksForm();
        bookmarks.splice(Number(button.dataset.cat), 1);
        renderBookmarksList();
      });
    });
    container.querySelectorAll('.remove-link').forEach(button => {
      button.addEventListener('click', () => {
        bookmarks = readBookmarksForm();
        bookmarks[Number(button.dataset.cat)]?.links.splice(Number(button.dataset.link), 1);
        renderBookmarksList();
      });
    });
    container.querySelectorAll('.add-link').forEach(button => {
      button.addEventListener('click', () => {
        bookmarks = readBookmarksForm();
        const category = bookmarks[Number(button.dataset.cat)];
        if (!category) return;
        if (category.links.length >= MAX_LINKS) {
          setStatus('Max 10 links per category', 'error');
          return;
        }
        category.links.push({ title: '', url: '' });
        renderBookmarksList();
      });
    });
  }

  function addCategory() {
    bookmarks = readBookmarksForm();
    if (bookmarks.length >= MAX_CATEGORIES) {
      setStatus('Max 5 categories', 'error');
      return;
    }
    bookmarks.push({ category: '', links: [] });
    renderBookmarksList();
  }

  function readBookmarksForm() {
    return [...document.querySelectorAll('.bookmark-option-category')].map(category => ({
      category: category.querySelector('.category-name').value.trim(),
      links: [...category.querySelectorAll('.link-title')].map(titleInput => {
        const linkIndex = titleInput.dataset.link;
        return {
          title: titleInput.value.trim(),
          url: category.querySelector(`.link-url[data-link="${linkIndex}"]`).value.trim()
        };
      })
    }));
  }

  async function saveAll() {
    try {
      const feeds = validateFeeds(readRssForm());
      const savedBookmarks = validateBookmarks(readBookmarksForm());
      const language = document.getElementById('language').value;
      const dateFormat = document.getElementById('date-format').value;
      const todo = { show: document.getElementById('display-todo').checked };
      const weather = {
        show: document.getElementById('display-weather').checked,
        location: document.getElementById('weather-location').value.trim(),
        units: document.getElementById('fahrenheit').checked ? 'imperial' : 'metric'
      };
      const tides = {
        show: document.getElementById('display-tides').checked,
        stationId: document.getElementById('tides-station').value.trim()
      };
      const tidecheckApiKey = document.getElementById('tidecheck-key').value.trim();

      await Promise.all([
        chrome.storage.sync.set({
          language,
          dateFormat,
          todo,
          weather,
          tides,
          rssFeeds: feeds,
          selectedSites: readQuickLinks(),
          bookmarks: savedBookmarks
        }),
        chrome.storage.local.set({ tidecheckApiKey })
      ]);
      rssFeeds = feeds;
      bookmarks = savedBookmarks;
      window.location.href = 'index.html';
    } catch (error) {
      setStatus(error.message || 'Save failed', 'error');
    }
  }

  async function exportSettings() {
    try {
      const data = await chrome.storage.sync.get(null);
      if (data.tides) {
        data.tides = { ...data.tides };
        delete data.tides.apiKey;
      }
      if (data.weather) {
        data.weather = { ...data.weather };
        delete data.weather.apiKey;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'cyberpage-settings.json';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus('Exported (API keys excluded)', 'saved');
    } catch (_) {
      setStatus('Export failed', 'error');
    }
  }

  function importSettings(file) {
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const imported = JSON.parse(event.target.result);
        const data = normalizeImport(imported);
        const legacyApiKey = stringValue(imported?.tides?.apiKey);
        await chrome.storage.sync.set(data);
        if (legacyApiKey) await chrome.storage.local.set({ tidecheckApiKey: legacyApiKey });
        await loadAll();
        setStatus('Imported successfully', 'saved');
      } catch (error) {
        setStatus(error.message || 'Invalid JSON file', 'error');
      }
    };
    reader.onerror = () => setStatus('Could not read file', 'error');
    reader.readAsText(file);
  }

  function normalizeImport(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid settings file');
    const data = {};
    if (supportedLanguages.includes(value.language)) data.language = value.language;
    if (['locale', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(value.dateFormat)) {
      data.dateFormat = value.dateFormat;
    }
    if (value.todo && typeof value.todo === 'object') {
      data.todo = { show: value.todo.show !== false };
    }
    if (value.weather && typeof value.weather === 'object') {
      data.weather = {
        show: !!value.weather.show,
        location: stringValue(value.weather.location),
        units: value.weather.units === 'imperial' ? 'imperial' : 'metric'
      };
    }
    if (value.tides && typeof value.tides === 'object') {
      data.tides = {
        show: !!value.tides.show,
        stationId: stringValue(value.tides.stationId)
      };
    }
    if ('rssFeeds' in value) data.rssFeeds = validateFeeds(normalizeFeeds(value.rssFeeds, true));
    if ('bookmarks' in value) data.bookmarks = validateBookmarks(normalizeBookmarks(value.bookmarks, true));
    if (Array.isArray(value.selectedSites)) {
      data.selectedSites = value.selectedSites.slice(0, availableSites.length || 100).map(site => ({
        name: stringValue(site?.name),
        selected: !!site?.selected
      })).filter(site => site.name);
    }
    if (!Object.keys(data).length) throw new Error('No recognized CyberPage settings');
    return data;
  }

  function normalizeFeeds(value, strict) {
    if (!Array.isArray(value)) {
      if (strict) throw new Error('Invalid RSS feed list');
      return [];
    }
    return value.slice(0, MAX_FEEDS).map(feed => ({
      label: stringValue(feed?.label),
      url: stringValue(feed?.url)
    }));
  }

  function validateFeeds(value) {
    return normalizeFeeds(value, true).filter(feed => feed.label || feed.url).map(feed => {
      if (!toSafeHttpUrl(feed.url)) throw new Error('RSS feeds must use http:// or https://');
      return feed;
    });
  }

  function normalizeBookmarks(value, strict) {
    if (!Array.isArray(value)) {
      if (strict) throw new Error('Invalid bookmark list');
      return [];
    }
    return value.slice(0, MAX_CATEGORIES).map(category => ({
      category: stringValue(category?.category),
      links: (Array.isArray(category?.links) ? category.links : []).slice(0, MAX_LINKS).map(link => ({
        title: stringValue(link?.title),
        url: stringValue(link?.url)
      }))
    }));
  }

  function validateBookmarks(value) {
    return normalizeBookmarks(value, true).map(category => ({
      category: category.category,
      links: category.links.filter(link => link.title || link.url).map(link => {
        if (!toSafeHttpUrl(link.url)) throw new Error('Bookmarks must use http:// or https://');
        return link;
      })
    }));
  }

  async function populateLanguages() {
    const response = await fetch('i18n/languages.json');
    if (!response.ok) throw new Error('Could not load languages');
    const languages = await response.json();
    supportedLanguages = languages.map(language => language.code);
    const select = document.getElementById('language');
    select.replaceChildren();
    languages.forEach(language => {
      const option = document.createElement('option');
      option.value = language.code;
      option.textContent = language.name;
      select.appendChild(option);
    });
  }

  function makeInput(className, value, placeholder, dataName, dataValue) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = className;
    input.value = value;
    input.placeholder = placeholder;
    input.dataset[dataName] = dataValue;
    return input;
  }

  function makeBookmarkInput(className, value, placeholder, categoryIndex, linkIndex) {
    const input = makeInput(className, value, placeholder, 'cat', categoryIndex);
    input.dataset.link = linkIndex;
    return input;
  }

  function makeButton(text, className, data = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    Object.assign(button.dataset, data);
    return button;
  }

  function makeIconButton(iconClass, label, className, data = {}) {
    const button = makeButton('', className, data);
    button.setAttribute('aria-label', label);
    button.title = label;
    const icon = document.createElement('span');
    icon.className = `lni ${iconClass}`;
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);
    return button;
  }

  function toSafeHttpUrl(value) {
    try {
      const url = new URL(String(value));
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  function stringValue(value) {
    return typeof value === 'string' ? value : '';
  }

  function setStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = type || '';
    if (type === 'saved') {
      setTimeout(() => {
        status.textContent = '';
        status.className = '';
      }, 3000);
    }
  }

  document.getElementById('add-rss-feed').addEventListener('click', addRssFeed);
  document.getElementById('add-category').addEventListener('click', addCategory);
  document.getElementById('save').addEventListener('click', saveAll);
  document.getElementById('export-all').addEventListener('click', exportSettings);
  document.getElementById('import-all-file').addEventListener('change', function () {
    if (this.files?.[0]) importSettings(this.files[0]);
  });

  loadAll().catch(error => {
    console.error('Settings load failed:', error);
    setStatus('Could not load settings', 'error');
  });
})();
