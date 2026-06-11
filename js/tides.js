console.log('[tides] script loaded');
(function () {
  const tidesSection = document.querySelector('#tides-section');
  const tidesLoading = document.querySelector('#tides-loading');
  const tideNow = document.querySelector('#tide-now');
  const tideTrend = document.querySelector('#tide-trend');
  const tidesDetail = document.querySelector('#tides-section .tides-detail');
  const tideTable = document.querySelector('#tide-table');

  let _stationId = null;
  let _cfg = null;
  let _coords = null;

  function fetchTides() {
    chrome.storage.sync.get({ tides: {} }, async function (result) {
      const cfg = result.tides || {};
      console.log('[tides] settings:', JSON.stringify(cfg));
      if (!cfg.show) {
        tidesLoading.classList.add('hidden');
        tidesSection.classList.remove('active');
        return;
      }

      if (!cfg.apiKey) {
        tidesLoading.textContent = '▹ TIDECHECK KEY REQUIRED';
        tidesLoading.classList.remove('hidden');
        return;
      }

      _cfg = cfg;
      console.log('[tides] fetchTides — show:', cfg.show, 'hasKey:', !!cfg.apiKey, 'cfgStation:', cfg.stationId || '(none)');
      let coords = null;

      // Resolve location: use configured station, or geolocation
      if (!stationId) {
        coords = await getCoords(cfg);
        // If somehow still null (shouldn't happen with fallback), use Recife
        if (!coords) coords = { lat: -8.05, lon: -34.88 };
        _coords = coords;

        // Check cache for nearest station
        const coordKey = `tides_station_${coords.lat.toFixed(2)}_${coords.lon.toFixed(2)}`;
        chrome.storage.local.get([coordKey], async function (cacheResult) {
          const cached = cacheResult[coordKey];
          if (cached && (Date.now() - cached.timestamp < 86400000)) {
            stationId = cached.stationId;
            _stationId = stationId;
            doFetchTides(stationId, cfg, coords);
            return;
          }

          // Find nearest station
          try {
            const resp = await fetch(
              `https://tidecheck.com/api/stations/nearest?lat=${coords.lat}&lng=${coords.lon}`,
              { headers: { 'X-API-Key': cfg.apiKey } }
            );
            const data = await resp.json();
            const first = Array.isArray(data) ? data[0] : (data.station || data);
            stationId = first?.id;
            _stationId = stationId;
            chrome.storage.local.set({
              [coordKey]: { stationId, timestamp: Date.now() }
            });
            doFetchTides(stationId, cfg, coords);
          } catch (e) {
            tidesLoading.textContent = '▹ STATION LOOKUP FAILED';
          }
        });
      } else {
        _stationId = stationId;
        doFetchTides(stationId, cfg, null);
      }
    });
  }

  function getCoords(cfg) {
    return new Promise((resolve) => {
      // If geolocation fails or is denied, fall back to Recife
      if (!navigator.geolocation) {
        resolve({ lat: -8.05, lon: -34.88 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve({ lat: -8.05, lon: -34.88 }),
        { enableHighAccuracy: false, timeout: 8000 }
      );
    });
  }

  function hasFutureExtremes(data) {
    const extremes = data.extremes || [];
    const now = new Date();
    for (const ex of extremes) {
      if (new Date(ex.time) > now) return true;
    }
    return false;
  }

  function doFetchTides(stationId, cfg, coords) {
    const cacheKey = `tides_data_${stationId}`;
    const cooldownKey = `tides_cooldown_${stationId}`;
    console.log('[tides] doFetchTides called — station:', stationId);
    chrome.storage.local.get([cacheKey, cooldownKey], function (cacheResult) {
      const cache = cacheResult[cacheKey];
      const cooldown = cacheResult[cooldownKey];
      const now = Date.now();

      if (cache) {
        const ageH = Math.round((now - cache.timestamp) / 3600000 * 10) / 10;
        const extremesCount = (cache.data.extremes || []).length;
        const hasFuture = hasFutureExtremes(cache.data);
        console.log('[tides] cache exists — age:', ageH + 'h, extremes:', extremesCount, 'hasFuture:', hasFuture);
      } else {
        console.log('[tides] no cache found');
      }

      // Simple age-based TTL: serve cache if within 12h
      if (cache && (now - cache.timestamp < 43200000)) {
        const ageH = Math.round((now - cache.timestamp) / 3600000 * 10) / 10;
        console.log('[tides] cache HIT (age ' + ageH + 'h < 12h) — serving cached data');
        renderTides(cache.data, stationId);
        return;
      }

      // Cache expired (>12h) or missing — fetch fresh
      if (cache) {
        const ageH = Math.round((now - cache.timestamp) / 3600000 * 10) / 10;
        console.log('[tides] cache EXPIRED (age ' + ageH + 'h >= 12h) — fetching fresh');
      } else {
        console.log('[tides] no cache — fetching fresh');
      }
      fetch(`https://tidecheck.com/api/station/${stationId}/tides?datum=LAT&days=2`, {
        headers: { 'X-API-Key': cfg.apiKey }
      })
        .then(r => {
          console.log('[tides] fetch response status:', r.status);
          return r.json().then(data => ({ status: r.status, data }));
        })
        .then(({ status, data }) => {
          if (status !== 200) {
            console.error('[tides] API returned non-200:', status, JSON.stringify(data).slice(0, 200));
            if (cache) { console.log('[tides] serving stale cache as fallback'); renderTides(cache.data, stationId); }
            else { tidesLoading.textContent = '▹ API ERROR ' + status; }
            return;
          }
          console.log('[tides] fetch OK — extremes:', (data.extremes || []).length, 'hasFuture:', hasFutureExtremes(data));
          chrome.storage.local.set({
            [cacheKey]: { data, timestamp: now }
          });

          // If no future extremes, set 6h cooldown before retrying
          if (!hasFutureExtremes(data)) {
            console.log('[tides] no future extremes in response — setting 6h cooldown');
            chrome.storage.local.set({
              [cooldownKey]: { timestamp: now }
            });
          } else {
            // Fresh future data — clear any stale cooldown
            chrome.storage.local.remove(cooldownKey);
          }

          renderTides(data, stationId);
        })
        .catch(err => {
          console.error('[tides] fetch exception:', err.message || err);
          // Serve stale cache on fetch failure if we have one
          if (cache) {
            console.log('[tides] fetch failed, serving stale cache');
            renderTides(cache.data, stationId);
          } else {
            tidesLoading.textContent = '▹ NETWORK ERROR';
          }
        });
    });
  }

  function renderTides(data, stationId) {
    const extremes = data.extremes || [];
    const timeSeries = data.timeSeries || [];
    const now = new Date();

    if (!extremes.length) {
      tidesLoading.textContent = '▹ NO TIDE DATA';
      return;
    }

    // Current state
    let currentHeight = null;
    let trend = null;

    if (timeSeries.length >= 2) {
      const sorted = [...timeSeries].sort((a, b) => a.time.localeCompare(b.time));
      let best = null, bestDiff = Infinity;
      for (const h of sorted) {
        const diff = Math.abs(new Date(h.time) - now);
        if (diff < bestDiff) { bestDiff = diff; best = h; }
      }
      if (best) currentHeight = best.height;

      for (let i = 0; i < sorted.length - 1; i++) {
        const t1 = new Date(sorted[i].time);
        const t2 = new Date(sorted[i + 1].time);
        if (t1 <= now && now <= t2) {
          trend = sorted[i + 1].height > sorted[i].height ? 'RISING' : 'FALLING';
          break;
        }
      }
    }

    // Current display
    if (currentHeight !== null) {
      tideNow.textContent = currentHeight.toFixed(2) + 'm';
    } else {
      // Fallback: use most recent extreme
      let last = null;
      for (const ex of extremes) {
        const t = new Date(ex.time);
        if (t <= now && (!last || t > new Date(last.time))) last = ex;
      }
      tideNow.textContent = last ? last.height.toFixed(2) + 'm' : '--';
    }

    tideTrend.textContent = trend || '--';
    tideTrend.style.color = trend === 'RISING'
      ? 'var(--accent)'
      : trend === 'FALLING'
        ? 'var(--red)'
        : 'var(--text-dim)';

    // Hide the next high/low summary — table covers it
    tidesDetail.style.display = 'none';

    // Table: only present and future tides (drop past)
    const future = extremes.filter(e => new Date(e.time) >= now);

    let tableHtml = '';
    if (future.length) {
      for (const ex of future) {
        const t = new Date(ex.time);
        const etype = (ex.type || '?').toUpperCase();
        tableHtml += `<div class="tide-row">
          <span class="tide-type">${etype}</span>
          <span class="tide-time">${formatTideTime(t)}</span>
          <span class="tide-h">${ex.height.toFixed(2)}m</span>
        </div>`;
      }
    } else {
      tableHtml = '<div class="tide-row"><span class="no-data">NO DATA</span></div>';
    }
    tideTable.innerHTML = tableHtml;

    tidesLoading.classList.add('hidden');
    tidesSection.classList.add('active');
  }

  function formatTideTime(d) {
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + ' ' +
           String(d.getHours()).padStart(2, '0') + ':' +
           String(d.getMinutes()).padStart(2, '0');
  }

  // React to settings changes
  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'sync' && changes.tides) {
      console.log('[tides] settings changed, re-fetching');
      fetchTides();
    }
  });

  // Periodically refresh tides while the tab is open (every 60 min)
  setInterval(function () {
    if (_stationId && _cfg && _cfg.show && _cfg.apiKey) {
      console.log('[tides] periodic refresh triggered (60min interval)');
      doFetchTides(_stationId, _cfg, _coords);
    }
  }, 60 * 60 * 1000);
  console.log('[tides] periodic refresh interval registered (60min)');

  fetchTides();
})();
