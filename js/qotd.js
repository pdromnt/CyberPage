(function () {
  'use strict';

  const API_URL = 'https://dummyjson.com/quotes/random/10';
  const CACHE_KEY = 'qotdQueue';
  const BATCH_SIZE = 10;
  const REFILL_AT = 3;
  const FALLBACK_QUOTE = {
    id: 'offline-fallback',
    quote: 'No quote received. Silence is also data.',
    author: 'CyberPage'
  };
  const widget = document.querySelector('#qotd-widget');
  const output = document.querySelector('#qotd-text');
  let state = { quotes: [], index: 0, dateKey: '' };
  let advancing = false;
  let lastFetchAttempt = 0;
  let initialized = false;

  async function init() {
    const saved = await chrome.storage.local.get({ [CACHE_KEY]: null });
    state = normalizeState(saved[CACHE_KEY]);
    const today = localDateKey();

    if (!state.quotes.length) {
      const quotes = await fetchQuoteBatch().catch(() => []);
      state = {
        quotes: quotes.length ? quotes : [FALLBACK_QUOTE],
        index: 0,
        dateKey: today
      };
      await saveState();
    } else {
      await advanceToDate(today);
    }

    render();
    if (remainingQuotes() <= REFILL_AT) await refillQueue();
  }

  async function advanceToDate(dateKey = localDateKey()) {
    if (advancing || state.dateKey === dateKey) return;
    advancing = true;
    try {
      if (state.index + 1 >= state.quotes.length) await refillQueue();
      if (state.index + 1 < state.quotes.length) state.index += 1;
      state.dateKey = dateKey;
      await saveState();
      render();
      if (remainingQuotes() <= REFILL_AT) await refillQueue();
    } finally {
      advancing = false;
    }
  }

  function normalizeState(value) {
    if (!value || typeof value !== 'object') return { quotes: [], index: 0, dateKey: '' };
    const quotes = normalizeQuotes(value.quotes);
    return {
      quotes,
      index: Math.min(Math.max(0, Number(value.index) || 0), Math.max(0, quotes.length - 1)),
      dateKey: typeof value.dateKey === 'string' ? value.dateKey : ''
    };
  }

  function normalizeQuotes(value) {
    if (!Array.isArray(value)) return [];
    return value.map(item => ({
      id: typeof item?.id === 'number' || typeof item?.id === 'string' ? item.id : '',
      quote: typeof item?.quote === 'string' ? item.quote.trim().slice(0, 400) : '',
      author: typeof item?.author === 'string' ? item.author.trim().slice(0, 100) : 'Unknown'
    })).filter(item => item.quote);
  }

  async function fetchQuoteBatch() {
    lastFetchAttempt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(API_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`Quote API returned ${response.status}`);
      const quotes = normalizeQuotes(await response.json());
      if (!quotes.length) throw new Error('Quote API returned no usable quotes');
      return quotes.slice(0, BATCH_SIZE);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function refillQueue() {
    if (Date.now() - lastFetchAttempt < 30000) return;
    const currentQueue = state.quotes.slice(state.index);
    const knownIds = new Set(currentQueue.map(quote => String(quote.id)));
    const incoming = await fetchQuoteBatch().catch(() => []);
    const unique = incoming.filter(quote => !knownIds.has(String(quote.id)));
    if (!unique.length) return;
    state.quotes = [...currentQueue, ...unique];
    state.index = 0;
    await saveState();
    render();
  }

  function remainingQuotes() {
    return Math.max(0, state.quotes.length - state.index);
  }

  function render() {
    const current = state.quotes[state.index] || FALLBACK_QUOTE;
    const text = `“${current.quote}” — ${current.author}`;
    output.textContent = text;
    output.title = text;
  }

  function saveState() {
    return chrome.storage.local.set({ [CACHE_KEY]: state });
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function setVisibility(show) {
    widget.hidden = !show;
    if (!show || initialized) return;
    initialized = true;
    init().catch(() => {
      state = { quotes: [FALLBACK_QUOTE], index: 0, dateKey: localDateKey() };
      render();
    });
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.qotd) {
      setVisibility(changes.qotd.newValue?.show !== false);
    }
    if (namespace === 'local' && changes[CACHE_KEY]?.newValue) {
      state = normalizeState(changes[CACHE_KEY].newValue);
      render();
    }
  });

  setInterval(() => {
    if (initialized && !widget.hidden) advanceToDate().catch(() => {});
  }, 60000);

  chrome.storage.sync.get({ qotd: { show: true } }).then(result => {
    setVisibility(result.qotd?.show !== false);
  });
})();
