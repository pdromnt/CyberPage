(function () {
  const timeDisplay = document.querySelector('#time');
  const dateDisplay = document.querySelector('#date');
  const greetingDisplay = document.querySelector('#greeting');
  const topbarClock = document.querySelector('#topbar-clock');

  const TICKER_MESSAGES = [
    'PATTERN ANALYSIS: NORMAL',
    'ANGEL DETECTION: NEGATIVE',
    'MAGI CONSENSUS: 98.7%',
    'SYNCH RATE: NOMINAL',
    'BIOCOMPUTER STATUS: STABLE',
    'LCL LINK: SECURE',
    'NEURAL HANDSHAKE: CONFIRMED',
    'PLUG DEPTH: 1.0',
    'AT-FIELD: INACTIVE',
    'THREAT LEVEL: ZERO',
  ];

  let tickerIdx = 0;
  let dateFormat = 'locale';
  const tickerEl = document.querySelector('#ticker');

  function updateTicker() {
    tickerIdx = (tickerIdx + 1) % TICKER_MESSAGES.length;
    tickerEl.textContent = TICKER_MESSAGES[tickerIdx];
  }
  updateTicker();
  setInterval(updateTicker, 6000);

  // Load date format preference
  chrome.storage.sync.get({ dateFormat: 'locale' }, function (result) {
    dateFormat = result.dateFormat;
  });

  // React to settings changes
  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'sync' && changes.dateFormat) {
      dateFormat = changes.dateFormat.newValue;
      tick();
    }
  });

  function formatDate(now, format, lang) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');

    if (format === 'DD/MM/YYYY') return d + '/' + m + '/' + y;
    if (format === 'MM/DD/YYYY') return m + '/' + d + '/' + y;
    if (format === 'YYYY-MM-DD') return y + '-' + m + '-' + d;

    return new Intl.DateTimeFormat(lang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
  }

  function tick() {
    const now = new Date();
    const hour = now.getHours();

    let greeting;
    if (hour < 5 || hour >= 22) greeting = i18n.t('greeting_night');
    else if (hour >= 18) greeting = i18n.t('greeting_evening');
    else if (hour >= 12) greeting = i18n.t('greeting_afternoon');
    else greeting = i18n.t('greeting_morning');

    const lang = i18n.currentLanguage || 'en';
    const timeStr = now.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateStr = formatDate(now, dateFormat, lang);

    timeDisplay.textContent = timeStr;
    dateDisplay.textContent = dateStr;
    greetingDisplay.textContent = greeting;
    topbarClock.textContent = timeStr;
    document.title = '..::' + greeting.toUpperCase();
  }

  i18n.init().then(() => {
    tick();
    setInterval(tick, 1000);
  });
})();
