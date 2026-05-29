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
  const tickerEl = document.querySelector('#ticker');

  function updateTicker() {
    tickerIdx = (tickerIdx + 1) % TICKER_MESSAGES.length;
    tickerEl.textContent = TICKER_MESSAGES[tickerIdx];
  }
  updateTicker();
  setInterval(updateTicker, 6000);

  function tick() {
    const now = new Date();
    const hour = now.getHours();
    let greeting = 'Good morning';

    if (hour >= 12 && hour < 18) greeting = 'Good afternoon';
    else if (hour >= 18 && hour < 22) greeting = 'Good evening';
    else if (hour >= 22 || hour < 5) greeting = 'Good night';

    // Init i18n if present
    if (typeof i18n !== 'undefined' && i18n.t) {
      try {
        if (hour < 5 || hour >= 22) greeting = i18n.t('greeting_night');
        else if (hour >= 18) greeting = i18n.t('greeting_evening');
        else if (hour >= 12) greeting = i18n.t('greeting_afternoon');
        else greeting = i18n.t('greeting_morning');
      } catch(e) {}
    }

    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateStr = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    timeDisplay.textContent = timeStr;
    dateDisplay.textContent = dateStr;
    greetingDisplay.textContent = greeting;
    topbarClock.textContent = timeStr;
    document.title = 'MAGI :: ' + greeting.toUpperCase();
  }

  setInterval(tick, 1000);
  tick();
})();
