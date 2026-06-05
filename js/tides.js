console.log('[tides] script loaded');
(function () {
  const tidesSection = document.querySelector('#tides-section');
  const tidesLoading = document.querySelector('#tides-loading');
  const tideNow = document.querySelector('#tide-now');
  const tideTrend = document.querySelector('#tide-trend');
  const tideNextHigh = document.querySelector('#tide-next-high');
  const tideNextLow = document.querySelector('#tide-next-low');
  const tideTable = document.querySelector('#tide-table');

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

      tidesLoading.classList.remove('hidden');
      tidesLoading.textContent = '▹ SYNCING TIDES...';

      let stationId = cfg.stationId || null;
      let coords = null;

      // Resolve location: use configured station, or geolocation
      if (!stationId) {
        coords = await getCoords(cfg);
        // If somehow still null (shouldn't happen with fallback), use Recife
        if (!coords) coords = { lat: -8.05, lon: -34.88 };

        // Check cache for nearest station
        const coordKey = `tides_station_${coords.lat.toFixed(2)}_${coords.lon.toFixed(2)}`;
        chrome.storage.local.get([coordKey], async function (cacheResult) {
          const cached = cacheResult[coordKey];
          if (cached && (Date.now() - cached.timestamp < 86400000)) {
            stationId = cached.stationId;
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
            chrome.storage.local.set({
              [coordKey]: { stationId, timestamp: Date.now() }
            });
            doFetchTides(stationId, cfg, coords);
          } catch (e) {
            tidesLoading.textContent = '▹ STATION LOOKUP FAILED';
          }
        });
      } else {
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

  function doFetchTides(stationId, cfg, coords) {
    const cacheKey = `tides_data_${stationId}`;
    chrome.storage.local.get([cacheKey], function (cacheResult) {
      const cache = cacheResult[cacheKey];
      const now = Date.now();

      // Tides are astronomical predictions — cache 12h
      if (cache && (now - cache.timestamp < 43200000)) {
        renderTides(cache.data, stationId);
        return;
      }

      fetch(`https://tidecheck.com/api/station/${stationId}/tides?datum=LAT&days=1`, {
        headers: { 'X-API-Key': cfg.apiKey }
      })
        .then(r => r.json())
        .then(data => {
          chrome.storage.local.set({
            [cacheKey]: { data, timestamp: now }
          });
          renderTides(data, stationId);
        })
        .catch(err => {
          console.error('Tide fetch error:', err);
          tidesLoading.textContent = '▹ NETWORK ERROR';
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

    // Next high / low
    let nextHigh = null, nextLow = null;
    for (const ex of extremes) {
      if (new Date(ex.time) > now) {
        if (!nextHigh && ex.type === 'high') nextHigh = ex;
        if (!nextLow && ex.type === 'low') nextLow = ex;
        if (nextHigh && nextLow) break;
      }
    }

    if (nextHigh) {
      const t = new Date(nextHigh.time);
      tideNextHigh.textContent = formatHHMM(t) + '  ' + nextHigh.height.toFixed(2) + 'm';
    } else {
      tideNextHigh.textContent = '--';
    }

    if (nextLow) {
      const t = new Date(nextLow.time);
      tideNextLow.textContent = formatHHMM(t) + '  ' + nextLow.height.toFixed(2) + 'm';
    } else {
      tideNextLow.textContent = '--';
    }

    // Today's table
    const today = now.toISOString().slice(0, 10);
    const todayEx = extremes.filter(e => (e.localDate || e.time?.slice(0, 10)) === today);

    let tableHtml = '';
    if (todayEx.length) {
      for (const ex of todayEx) {
        const t = new Date(ex.time);
        const etype = (ex.type || '?').toUpperCase();
        const near = Math.abs(t - now) < 3600000 ? ' ◀' : '';
        tableHtml += `<div class="tide-row">
          <span class="tide-type">${etype}</span>
          <span class="tide-time">${formatHHMM(t)}</span>
          <span class="tide-h">${ex.height.toFixed(2)}m</span>
          ${near ? '<span class="tide-now">◀</span>' : ''}
        </div>`;
      }
    } else {
      tableHtml = '<div class="tide-row"><span class="no-data">NO DATA</span></div>';
    }
    tideTable.innerHTML = tableHtml;

    tidesLoading.classList.add('hidden');
    tidesSection.classList.add('active');
  }

  function formatHHMM(d) {
    return String(d.getHours()).padStart(2, '0') + ':' +
           String(d.getMinutes()).padStart(2, '0');
  }

  // React to settings changes
  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'sync' && changes.tides) {
      fetchTides();
    }
  });

  fetchTides();
})();
