(function () {
  const searchInput = document.querySelector('.search-input');

  const BANGS = {
    'g': 'https://www.google.com/search?q=',
    'gh': 'https://github.com/search?q=',
    'yt': 'https://www.youtube.com/results?search_query=',
    'ddg': 'https://duckduckgo.com/?q=',
    'w': 'https://en.wikipedia.org/wiki/Special:Search?search=',
    'npm': 'https://www.npmjs.com/search?q=',
  };

  searchInput.addEventListener('keydown', handleKeyDown);

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      doSearch();
    }
  }

  function doSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    // Accept the documented "gh/ query", plus "gh/query", "gh! query"
    // and the legacy "gh query" forms.
    const bangMatch = query.match(/^([a-z]+)(?:[!/]\s*|\s+)(.+)$/i);
    if (bangMatch) {
      const prefix = bangMatch[1].toLowerCase();
      const rest = bangMatch[2];
      const url = BANGS[prefix];
      if (url) {
        window.location.href = url + encodeURIComponent(rest);
        return;
      }
    }

    // Default: Google search
    window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(query);
  }

  // Focus search on load
  searchInput.focus();
})();
