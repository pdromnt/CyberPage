(function () {
  const rssPanel = document.querySelector('#rss-panel');

  // Default RSS feed config — user overrides via settings
  const DEFAULT_FEEDS = [];

  async function ensureFeedUARule() {
    try {
      await chrome.runtime.sendMessage({ type: 'ensureFeedUA' });
    } catch (_) {
      // service worker not registered yet — extension probably needs reload
    }
  }

  async function loadFeeds() {
    await ensureFeedUARule();

    const result = await new Promise(resolve =>
      chrome.storage.sync.get({ rssFeeds: DEFAULT_FEEDS }, resolve)
    );
    const feeds = result.rssFeeds || [];

    if (!feeds.length) {
      rssPanel.innerHTML = '<div class="no-data">▹ NO FEEDS CONFIGURED</div>';
      return;
    }

    // Show loading
    rssPanel.innerHTML = '<div class="no-data">▹ FETCHING FEEDS...</div>';

    // Fetch each feed
    const results = await Promise.allSettled(feeds.map(f => fetchAndParse(f)));
    renderFeeds(feeds, results);
  }

  async function fetchAndParse(feed) {
    try {
      const response = await fetch(feed.url, { cache: 'no-cache' });
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'application/xml');

      // Check for parse errors
      const errorNode = doc.querySelector('parsererror');
      if (errorNode) {
        return { error: 'PARSE ERROR', label: feed.label };
      }

      // RSS 2.0
      let items = doc.querySelectorAll('item');
      // Atom
      if (!items.length) items = doc.querySelectorAll('entry');

      const parsed = [];
      const maxItems = feed.maxItems || 6;

      items.forEach((item, i) => {
        if (i >= maxItems) return;

        const title = item.querySelector('title')?.textContent?.trim() || 'Untitled';
        let link = '';
        if (item.querySelector('link')) {
          link = item.querySelector('link')?.textContent?.trim() || item.querySelector('link')?.getAttribute('href') || '';
        }
        const dateStr = item.querySelector('pubDate')?.textContent
          || item.querySelector('published')?.textContent
          || item.querySelector('updated')?.textContent
          || '';

        parsed.push({ title, link, date: dateStr });
      });

      return { items: parsed, label: feed.label };
    } catch (e) {
      return { error: 'FETCH FAILED', label: feed.label };
    }
  }

  function renderFeeds(feeds, results) {
    if (!results.length) {
      rssPanel.innerHTML = '<div class="no-data">▹ NO FEEDS</div>';
      return;
    }

    let html = '';

    results.forEach((result, i) => {
      const feed = feeds[i];
      if (!feed) return;

      html += `<div class="feed-block">`;
      html += `<div class="feed-label">▹ ${escapeHtml(feed.label)}</div>`;

      if (result.status === 'rejected' || result.value?.error) {
        const err = result.value?.error || 'FETCH ERROR';
        html += `<div class="no-data">${escapeHtml(err)}</div>`;
      } else if (result.value?.items?.length) {
        result.value.items.forEach(item => {
          const dateStr = item.date
            ? new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
            : '—';
          html += `
            <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener" class="feed-item">
              <span class="fi-time">${escapeHtml(dateStr)}</span>
              <span class="fi-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
            </a>`;
        });
      } else {
        html += '<div class="no-data">NO ITEMS</div>';
      }

      html += `</div>`;
    });

    rssPanel.innerHTML = html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Listen for storage changes (settings updates)
  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'sync' && changes.rssFeeds) {
      loadFeeds();
    }
  });

  loadFeeds();
})();
