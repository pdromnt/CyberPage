(function () {
  const quickLinksEl = document.querySelector('#quick-links');
  const MAX_VISIBLE = 5;

  loadQuickLinks();

  function loadQuickLinks() {
    chrome.storage.sync.get({ selectedSites: [] }, function (items) {
      fetch('data/sites.json')
        .then(response => response.json())
        .then(siteInfo => {
          quickLinksEl.innerHTML = '';

          const selected = items.selectedSites
            .filter(site => site.selected);

          if (!selected.length) return;

          // Build links
          const links = selected.map(function (site) {
            const info = siteInfo.find(s => s.id === site.name);
            return info ? makeLink(info) : null;
          }).filter(Boolean);

          // Show first MAX_VISIBLE, rest in "more" menu
          const visible = links.slice(0, MAX_VISIBLE);
          const hidden = links.slice(MAX_VISIBLE);

          visible.forEach(link => quickLinksEl.appendChild(link));

          if (hidden.length > 0) {
            const moreBtn = document.createElement('button');
            moreBtn.className = 'quick-link more-btn';
            moreBtn.textContent = 'MORE ▾';
            moreBtn.addEventListener('click', function (e) {
              e.preventDefault();
              toggleMore(moreBtn, hidden);
            });
            quickLinksEl.appendChild(moreBtn);
          }
        });
    });
  }

  function toggleMore(btn, hiddenLinks) {
    let dropdown = btn.nextElementSibling;
    if (dropdown && dropdown.classList.contains('more-dropdown')) {
      dropdown.remove();
      btn.textContent = 'MORE ▾';
      return;
    }

    dropdown = document.createElement('div');
    dropdown.className = 'more-dropdown';
    dropdown.style.cssText = 'position:absolute;bottom:100%;left:0;margin-bottom:4px;background:var(--panel-bg);border:1px solid var(--border);padding:4px 0;min-width:140px;z-index:10;';

    hiddenLinks.forEach(link => {
      const clone = link.cloneNode(true);
      clone.style.cssText = 'display:block;padding:6px 14px;text-decoration:none;color:var(--text);font-size:12px;letter-spacing:1px;white-space:nowrap;';
      clone.addEventListener('mouseenter', function () { this.style.background = 'color-mix(in srgb, var(--accent) 8%, transparent)'; this.style.color = 'var(--accent)'; });
      clone.addEventListener('mouseleave', function () { this.style.background = ''; this.style.color = ''; });
      dropdown.appendChild(clone);
    });

    btn.parentNode.style.position = 'relative';
    btn.parentNode.appendChild(dropdown);
    btn.textContent = 'MORE ▴';

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function closeDropdown(e) {
        if (!dropdown.contains(e.target) && e.target !== btn) {
          dropdown.remove();
          btn.textContent = 'MORE ▾';
          document.removeEventListener('click', closeDropdown);
        }
      });
    }, 0);
  }

  function makeLink(siteInfo) {
    const a = document.createElement('a');
    a.className = 'quick-link';
    a.href = siteInfo.url;
    a.target = '_blank';
    a.rel = 'noopener';

    const icon = document.createElement('span');
    icon.className = 'quick-link-icon lni ' + (siteInfo.icon || '');

    const label = document.createElement('span');
    label.textContent = siteInfo.name || siteInfo.id;

    a.appendChild(icon);
    a.appendChild(label);
    return a;
  }
})();
