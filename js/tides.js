(function () {
  const tidesSection = document.querySelector('#tides-section');
  const tidesLoading = document.querySelector('#tides-loading');
  const tideNow = document.querySelector('#tide-now');
  const tideTrend = document.querySelector('#tide-trend');
  const tidesDetail = document.querySelector('#tides-section .tides-detail');
  const tideTable = document.querySelector('#tide-table');
  let currentStationId = null;
  let currentConfig = null;
  let fetchSequence = 0;

  async function fetchTides() {
    const sequence = ++fetchSequence;
    const [syncResult, localResult] = await Promise.all([
      chrome.storage.sync.get({ tides: {} }),
      chrome.storage.local.get({ tidecheckApiKey: '' })
    ]);
    const saved = syncResult.tides || {};
    const cfg = { ...saved, apiKey: localResult.tidecheckApiKey || saved.apiKey || '' };

    if (saved.apiKey && !localResult.tidecheckApiKey) {
      await chrome.storage.local.set({ tidecheckApiKey: saved.apiKey });
      const clean = { ...saved };
      delete clean.apiKey;
      await chrome.storage.sync.set({ tides: clean });
    }

    currentConfig = cfg;
    currentStationId = null;
    if (!cfg.show) {
      tidesSection.classList.remove('active');
      tidesLoading.classList.add('hidden');
      return;
    }
    tidesSection.classList.remove('active');
    tidesLoading.classList.remove('hidden');
    tidesLoading.textContent = '▹ SYNCING TIDES...';

    if (!cfg.apiKey) {
      tidesLoading.textContent = '▹ TIDECHECK KEY REQUIRED';
      return;
    }

    let stationId = normalizeStationId(cfg.stationId);
    if (!stationId) {
      const coords = await getCoords();
      if (sequence !== fetchSequence) return;
      if (!coords) {
        tidesLoading.textContent = '▹ LOCATION OR STATION REQUIRED';
        return;
      }
      stationId = await resolveStation(coords, cfg.apiKey);
      if (sequence !== fetchSequence) return;
      if (!stationId) {
        tidesLoading.textContent = '▹ STATION LOOKUP FAILED';
        return;
      }
    }

    currentStationId = stationId;
    await loadStationTides(stationId, cfg.apiKey, sequence);
  }

  function getCoords() {
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000 }
      );
    });
  }

  async function resolveStation(coords, apiKey) {
    const coordKey = `tides_station_${coords.lat.toFixed(2)}_${coords.lon.toFixed(2)}`;
    const cacheResult = await chrome.storage.local.get([coordKey]);
    const cached = cacheResult[coordKey];
    if (cached && Date.now() - cached.timestamp < 86400000) {
      const cachedId = normalizeStationId(cached.stationId);
      if (cachedId) return cachedId;
    }

    try {
      const { response, data } = await fetchJson(
        `https://tidecheck.com/api/stations/nearest?lat=${coords.lat}&lng=${coords.lon}`,
        { headers: { 'X-API-Key': apiKey } }
      );
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const stationId = normalizeStationId(Array.isArray(data) ? data[0]?.id : data?.station?.id || data?.id);
      if (!stationId) throw new Error('No station returned');
      await chrome.storage.local.set({ [coordKey]: { stationId, timestamp: Date.now() } });
      return stationId;
    } catch (error) {
      console.error('Tide station lookup failed:', error);
      return null;
    }
  }

  function hasFutureExtremes(data) {
    return (Array.isArray(data?.extremes) ? data.extremes : [])
      .some(extreme => validDate(extreme.time) > new Date());
  }

  async function loadStationTides(stationId, apiKey, sequence) {
    const cacheKey = `tides_data_${stationId}`;
    const cooldownKey = `tides_cooldown_${stationId}`;
    const cacheResult = await chrome.storage.local.get([cacheKey, cooldownKey]);
    const cache = cacheResult[cacheKey];
    const cooldown = cacheResult[cooldownKey];
    const now = Date.now();

    if (cache) {
      const hasFuture = hasFutureExtremes(cache.data);
      if ((hasFuture && now - cache.timestamp < 43200000)
          || (!hasFuture && cooldown && now - cooldown.timestamp < 21600000)) {
        if (sequence === fetchSequence) renderTides(cache.data);
        return;
      }
    }

    try {
      const { response, data } = await fetchJson(
        `https://tidecheck.com/api/station/${encodeURIComponent(stationId)}/tides?datum=LAT&days=2`,
        { headers: { 'X-API-Key': apiKey } }
      );
      if (!response.ok || !Array.isArray(data.extremes)) {
        throw new Error(data?.error || 'HTTP ' + response.status);
      }
      await chrome.storage.local.set({ [cacheKey]: { data, timestamp: now } });
      if (hasFutureExtremes(data)) {
        await chrome.storage.local.remove(cooldownKey);
      } else {
        await chrome.storage.local.set({ [cooldownKey]: { timestamp: now } });
      }
      if (sequence === fetchSequence) renderTides(data);
    } catch (error) {
      console.error('Tide fetch failed:', error);
      if (sequence !== fetchSequence) return;
      if (cache) renderTides(cache.data);
      else tidesLoading.textContent = '▹ TIDE DATA UNAVAILABLE';
    }
  }

  function renderTides(data) {
    const extremes = (Array.isArray(data.extremes) ? data.extremes : [])
      .filter(extreme => validDate(extreme.time) && Number.isFinite(Number(extreme.height)));
    const timeSeries = (Array.isArray(data.timeSeries) ? data.timeSeries : [])
      .filter(point => validDate(point.time) && Number.isFinite(Number(point.height)))
      .sort((a, b) => validDate(a.time) - validDate(b.time));
    const now = new Date();
    let currentHeight = null;
    let trend = null;

    if (timeSeries.length >= 2) {
      let closest = null;
      let closestDiff = Infinity;
      for (const point of timeSeries) {
        const diff = Math.abs(validDate(point.time) - now);
        if (diff < closestDiff) {
          closest = point;
          closestDiff = diff;
        }
      }
      if (closest && closestDiff <= 30 * 60 * 1000) currentHeight = Number(closest.height);

      for (let index = 0; index < timeSeries.length - 1; index++) {
        const first = validDate(timeSeries[index].time);
        const second = validDate(timeSeries[index + 1].time);
        if (first <= now && now <= second) {
          trend = Number(timeSeries[index + 1].height) > Number(timeSeries[index].height)
            ? 'RISING' : 'FALLING';
          break;
        }
      }
    }

    tideNow.textContent = currentHeight === null ? '--' : currentHeight.toFixed(2) + 'm';
    tideTrend.textContent = trend || '--';
    tideTrend.style.color = trend === 'RISING'
      ? 'var(--accent)' : trend === 'FALLING' ? 'var(--red)' : 'var(--text-dim)';
    tidesDetail.style.display = 'none';
    tideTable.replaceChildren();

    const future = extremes.filter(extreme => validDate(extreme.time) >= now);
    if (!future.length) {
      appendNoDataRow();
    } else {
      future.forEach(extreme => {
        const row = document.createElement('div');
        row.className = 'tide-row';
        row.append(
          tideCell('tide-type', String(extreme.type || '?').toUpperCase()),
          tideCell('tide-time', formatTideTime(extreme, data.station?.timezone)),
          tideCell('tide-h', Number(extreme.height).toFixed(2) + 'm')
        );
        tideTable.appendChild(row);
      });
    }

    tidesLoading.classList.add('hidden');
    tidesSection.classList.add('active');
  }

  function tideCell(className, text) {
    const cell = document.createElement('span');
    cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function appendNoDataRow() {
    const row = document.createElement('div');
    row.className = 'tide-row';
    row.appendChild(tideCell('no-data', 'NO UPCOMING TIDES'));
    tideTable.appendChild(row);
  }

  function formatTideTime(extreme, timezone) {
    const localMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(extreme.localTime || '');
    if (localMatch) return `${localMatch[3]}/${localMatch[2]} ${localMatch[4]}:${localMatch[5]}`;
    const date = validDate(extreme.time);
    if (!date) return '--';
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || undefined, day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    const get = type => parts.find(part => part.type === type)?.value || '--';
    return `${get('day')}/${get('month')} ${get('hour')}:${get('minute')}`;
  }

  function normalizeStationId(value) {
    const stationId = typeof value === 'string' ? value.trim() : '';
    return stationId && stationId.length <= 200 ? stationId : null;
  }

  function validDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return { response, data: await response.json() };
    } finally {
      clearTimeout(timeout);
    }
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if ((namespace === 'sync' && changes.tides)
        || (namespace === 'local' && changes.tidecheckApiKey)) {
      fetchTides();
    }
  });

  setInterval(() => {
    if (currentStationId && currentConfig?.show && currentConfig.apiKey) {
      loadStationTides(currentStationId, currentConfig.apiKey, fetchSequence);
    }
  }, 60 * 60 * 1000);

  fetchTides();
})();
