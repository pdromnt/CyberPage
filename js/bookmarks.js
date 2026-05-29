(function () {
  const overlay = document.createElement('div');
  overlay.className = 'bookmarks-overlay';
  overlay.innerHTML = `
    <div class="bookmarks-bg"></div>
    <div class="bookmarks-close">[ESC] CLOSE</div>
    <div class="bookmarks-content" id="bookmarks-content"></div>
  `;
  document.body.appendChild(overlay);

  const contentEl = overlay.querySelector('#bookmarks-content');
  const closeBtn = overlay.querySelector('.bookmarks-close');
  const bgEl = overlay.querySelector('.bookmarks-bg');

  let isOpen = false;

  // Open/close handlers
  document.addEventListener('keydown', function (event) {
    if (event.key === 'b' && event.ctrlKey && !isOpen) {
      event.preventDefault();
      openBookmarks();
    } else if (event.key === 'Escape' && isOpen) {
      closeBookmarks();
    }
  });

  closeBtn.addEventListener('click', closeBookmarks);
  bgEl.addEventListener('click', closeBookmarks);

  function openBookmarks() {
    overlay.classList.add('open');
    isOpen = true;
    loadBookmarks();
  }

  function closeBookmarks() {
    overlay.classList.remove('open');
    isOpen = false;
  }

  function loadBookmarks() {
    chrome.storage.sync.get({ bookmarks: [] }, function (items) {
      contentEl.innerHTML = '';

      if (!items.bookmarks || items.bookmarks.length === 0) {
        contentEl.innerHTML = `
          <div class="bookmarks-empty">
            <div class="title">NO BOOKMARKS</div>
            <p>Add categories and links in <a href="settings.html" style="color:var(--accent)">SETTINGS</a></p>
          </div>`;
        return;
      }

      items.bookmarks.forEach(function (bookmark) {
        const catDiv = document.createElement('div');
        catDiv.className = 'bookmark-category';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'bookmark-category-name';
        nameDiv.textContent = bookmark.category;

        catDiv.appendChild(nameDiv);

        if (bookmark.links) {
          bookmark.links.forEach(function (link) {
            const a = document.createElement('a');
            a.className = 'bookmark-link';
            a.href = link.url;
            a.textContent = link.title;
            catDiv.appendChild(a);
          });
        }

        contentEl.appendChild(catDiv);
      });
    });
  }
})();
