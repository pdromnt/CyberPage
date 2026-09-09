(function () {
  const rssPanel = document.querySelector('#rss-panel');
  const DEFAULT_FEEDS = [];
  const FETCH_TIMEOUT_MS = 12000;
  const MAX_FEED_BYTES = 2 * 1024 * 1024;
  let loadSequence = 0;

  async function ensureFeedUARule(feeds) {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'ensureFeedUA', feeds });
      return result && result.ok;
    } catch (_) {
      return false;
    }
  }

  async function loadFeeds() {
    const sequence = ++loadSequence;
    const result = await chrome.storage.sync.get({ rssFeeds: DEFAULT_FEEDS });
    const feeds = (Array.isArray(result.rssFeeds) ? result.rssFeeds : [])
      .filter(feed => feed && toSafeHttpUrl(feed.url));

    if (!feeds.length) {
      rssPanel.innerHTML = '<div class="no-data">▹ NO FEEDS CONFIGURED</div>';
      return;
    }

    rssPanel.innerHTML = '<div class="no-data">▹ FETCHING FEEDS...</div>';
    await ensureFeedUARule(feeds);
    const results = await Promise.allSettled(feeds.map(fetchAndParse));
    if (sequence === loadSequence) renderFeeds(feeds, results);
  }

  async function fetchAndParse(feed) {
    const feedUrl = toSafeHttpUrl(feed.url);
    if (!feedUrl) return { error: 'INVALID URL' };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(feedUrl, { cache: 'no-cache', signal: controller.signal });
      if (!response.ok) return { error: `HTTP ${response.status}` };

      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > MAX_FEED_BYTES) return { error: 'FEED TOO LARGE' };

      const text = await response.text();
      if (text.length > MAX_FEED_BYTES) return { error: 'FEED TOO LARGE' };

      const doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.querySelector('parsererror')) return { error: 'PARSE ERROR' };

      let items = doc.querySelectorAll('item');
      if (!items.length) items = doc.querySelectorAll('entry');

      const parsed = [];
      const maxItems = Math.min(20, Math.max(1, Number(feed.maxItems) || 6));
      items.forEach((item, index) => {
        if (index >= maxItems) return;
        const title = item.querySelector('title')?.textContent?.trim() || 'Untitled';
        const linkNode = item.querySelector('link');
        const rawLink = linkNode?.textContent?.trim() || linkNode?.getAttribute('href') || '';
        const link = toSafeHttpUrl(rawLink, feedUrl);
        const date = item.querySelector('pubDate')?.textContent
          || item.querySelector('published')?.textContent
          || item.querySelector('updated')?.textContent
          || '';
        parsed.push({ title, link, date });
      });

      return { items: parsed };
    } catch (error) {
      return { error: error && error.name === 'AbortError' ? 'TIMED OUT' : 'FETCH FAILED' };
    } finally {
      clearTimeout(timeout);
    }
  }

  function renderFeeds(feeds, results) {
    rssPanel.replaceChildren();
    results.forEach((result, index) => {
      const feed = feeds[index];
      if (!feed) return;

      const block = document.createElement('div');
      block.className = 'feed-block';
      const label = document.createElement('div');
      label.className = 'feed-label';
      label.textContent = `▹ ${feed.label || 'FEED'}`;
      block.appendChild(label);

      if (result.status === 'rejected' || result.value?.error) {
        appendMessage(block, result.value?.error || 'FETCH ERROR');
      } else if (result.value?.items?.length) {
        result.value.items.forEach(item => block.appendChild(makeFeedItem(item)));
      } else {
        appendMessage(block, 'NO ITEMS');
      }
      rssPanel.appendChild(block);
    });
  }

  function makeFeedItem(item) {
    const element = document.createElement(item.link ? 'a' : 'div');
    element.className = 'feed-item';
    if (item.link) {
      element.href = item.link;
      element.target = '_blank';
      element.rel = 'noopener';
    }

    const time = document.createElement('span');
    time.className = 'fi-time';
    time.textContent = formatFeedDate(item.date);
    const title = document.createElement('span');
    title.className = 'fi-title';
    title.textContent = item.title;
    title.title = item.title;
    element.append(time, title);
    return element;
  }

  function appendMessage(parent, message) {
    const element = document.createElement('div');
    element.className = 'no-data';
    element.textContent = message;
    parent.appendChild(element);
  }

  function formatFeedDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function toSafeHttpUrl(value, base) {
    try {
      const url = new URL(String(value), base);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.rssFeeds) loadFeeds();
  });

  loadFeeds();
})();
