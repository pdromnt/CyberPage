(function () {
  const quickLinksEl = document.querySelector('#quick-links');

  // Map of known site IDs to emoji/text icons (no external icon fonts needed)
  const ICONS = {
    'github': '◆',
    'gmail': '✉',
    'youtube': '▶',
    'reddit': '◆',
    'twitter': '◆',
    'facebook': '◆',
    'linkedin': '◆',
    'twitch': '◆',
    'spotify': '◆',
    'netflix': '◆',
    'amazon': '◆',
    'wikipedia': '◆',
    'stackoverflow': '◆',
    'hackernews': '◆',
    'producthunt': '◆',
    'medium': '◆',
    'discord': '◆',
    'slack': '◆',
    'notion': '◆',
    'figma': '◆',
    'chatgpt': '◆',
    'claude': '◆',
  };

  loadQuickLinks();

  function loadQuickLinks() {
    chrome.storage.sync.get({ selectedSites: [] }, function (items) {
      fetch('data/sites.json')
        .then(response => response.json())
        .then(siteInfo => {
          quickLinksEl.innerHTML = '';

          const selected = items.selectedSites
            .filter(site => site.selected);

          if (!selected.length) {
            // Show default set of common links
            const defaults = ['github', 'gmail', 'youtube', 'reddit'];
            defaults.forEach(id => {
              const info = siteInfo.find(s => s.id === id);
              if (info) {
                const link = makeLink(info);
                quickLinksEl.appendChild(link);
              }
            });
            return;
          }

          selected.forEach(function (site) {
            const info = siteInfo.find(s => s.id === site.name);
            if (info) {
              const link = makeLink(info);
              quickLinksEl.appendChild(link);
            }
          });
        });
    });
  }

  function makeLink(siteInfo) {
    const a = document.createElement('a');
    a.className = 'quick-link';
    a.href = siteInfo.url;
    a.target = '_blank';
    a.rel = 'noopener';

    const icon = document.createElement('span');
    icon.className = 'quick-link-icon';
    icon.textContent = ICONS[siteInfo.id] || '◆';

    const label = document.createElement('span');
    label.textContent = siteInfo.name || siteInfo.id;

    a.appendChild(icon);
    a.appendChild(label);
    return a;
  }
})();
