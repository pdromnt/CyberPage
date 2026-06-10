(function () {
  const weatherWidget = document.querySelector('#weather-widget');
  const weatherLoading = document.querySelector('#weather-loading');
  const iconEl = document.querySelector('#weather-icon');
  const tempEl = document.querySelector('#weather-temp');
  const condEl = document.querySelector('#weather-cond');
  const humEl = document.querySelector('#weather-hum');
  const windEl = document.querySelector('#weather-wind');
  const locEl = document.querySelector('#weather-loc');

  // Moon elements
  const moonSection = document.querySelector('#moon-section');
  const moonIconEl = document.querySelector('#moon-icon');
  const moonPhaseEl = document.querySelector('#moon-phase');
  const moonIllumEl = document.querySelector('#moon-illum');
  const moonRiseEl = document.querySelector('#moon-rise');
  const moonSetEl = document.querySelector('#moon-set');
  const moonStatusEl = document.querySelector('#moon-status');

  const ICON_MAP = {
    '01d': '☀', '01n': '☾',
    '02d': '⛅', '02n': '⛅',
    '03d': '☁', '03n': '☁',
    '04d': '☁', '04n': '☁',
    '09d': '🌧', '09n': '🌧',
    '10d': '🌦', '10n': '🌧',
    '11d': '⛈', '11n': '⛈',
    '13d': '❄', '13n': '❄',
    '50d': '🌫', '50n': '🌫',
  };

  const MOON_PHASE_ICONS = {
    'New Moon': '🌑',
    'Waxing Crescent': '🌒',
    'First Quarter': '🌓',
    'Waxing Gibbous': '🌔',
    'Full Moon': '🌕',
    'Waning Gibbous': '🌖',
    'Last Quarter': '🌗',
    'Waning Crescent': '🌘',
  };

  function tryGeocode(queries, idx, apiKey, resolve) {
    if (idx >= queries.length) {
      resolve({ error: 'GEO_NOT_FOUND: ' + queries[0] });
      return;
    }

    const q = queries[idx];
    fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${apiKey}`)
      .then(r => r.json().then(data => ({ status: r.status, data })))
      .then((response) => {
        if (response.status !== 200) {
          tryGeocode(queries, idx + 1, apiKey, resolve);
        } else if (response.data && response.data.length > 0) {
          resolve({ lat: response.data[0].lat, lon: response.data[0].lon, name: queries[0] });
        } else {
          tryGeocode(queries, idx + 1, apiKey, resolve);
        }
      })
      .catch(() => tryGeocode(queries, idx + 1, apiKey, resolve));
  }

  function resolveLocation(cfg) {
    return new Promise((resolve) => {
      if (cfg.location) {
        const apiKey = cfg.apiKey;
        if (!apiKey) { resolve({ error: 'NO_API_KEY' }); return; }

        // Build fallback queries: "Recife, PE" → try "Recife", then "Recife,BR"
        const raw = cfg.location.trim();
        const queries = [raw];
        const commaIdx = raw.indexOf(',');
        if (commaIdx > 0) {
          queries.push(raw.substring(0, commaIdx).trim());
        }
        if (!raw.match(/,\s*[A-Z]{2}$/)) {
          queries.push((commaIdx > 0 ? raw.substring(0, commaIdx).trim() : raw) + ',BR');
        }

        tryGeocode(queries, 0, apiKey, resolve);
      } else {
        if (!navigator.geolocation) { resolve({ error: 'NO_GEOLOCATION' }); return; }
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: null }),
          err => resolve({ error: 'GEO_DENIED' }),
          { enableHighAccuracy: false, timeout: 10000 }
        );
      }
    });
  }

  function fetchWeather() {
    chrome.storage.sync.get({ weather: {} }, async function (result) {
      const cfg = result.weather;
      if (!cfg.show) {
        weatherLoading.classList.add('hidden');
        moonSection.classList.remove('active');
        return;
      }

      if (!cfg.apiKey) {
        weatherLoading.textContent = '▹ API KEY REQUIRED';
        weatherLoading.classList.remove('hidden');
        return;
      }

      weatherLoading.classList.remove('hidden');
      weatherLoading.textContent = '▹ SYNCING...';

      // Check/cache resolved location (24h TTL)
      const locCacheKey = cfg.location
        ? `weather_loc_${cfg.location.trim().toLowerCase()}`
        : 'weather_loc_geo';

      const loc = await new Promise((resolve) => {
        chrome.storage.local.get([locCacheKey], function (cacheResult) {
          const cached = cacheResult[locCacheKey];
          if (cached && (Date.now() - cached.timestamp < 86400000)) {
            resolve({ lat: cached.lat, lon: cached.lon, name: cached.name });
            return;
          }
          // No cache — geocode/geolocate
          resolveLocation(cfg).then(resolve);
        });
      });

      if (loc.error) {
        weatherLoading.textContent = '▹ ' + loc.error;
        return;
      }

      // Cache the location result
      if (!loc.error) {
        chrome.storage.local.set({
          [locCacheKey]: { lat: loc.lat, lon: loc.lon, name: loc.name, timestamp: Date.now() }
        });
      }

      const units = cfg.units || 'metric';
      const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'en';

      const cacheKey = `weather_${loc.lat.toFixed(2)}_${loc.lon.toFixed(2)}_${units}`;
      chrome.storage.local.get([cacheKey], function (cacheResult) {
        const cache = cacheResult[cacheKey];
        const now = Date.now();

        if (cache && (now - cache.timestamp < 600000)) {
          renderWeather(cache.data, loc.name, units);
          fetchMoon(loc.lat, loc.lon, loc.name);
          return;
        }

        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${loc.lat}&lon=${loc.lon}&units=${units}&lang=${lang}&appid=${cfg.apiKey}`)
          .then(r => r.json().then(data => ({ status: r.status, data })))
          .then((response) => {
            if (response.data.cod !== 200) {
              weatherLoading.textContent = '▹ API: ' + (response.data.message || response.status);
              return;
            }

            chrome.storage.local.set({
              [cacheKey]: { data: response.data, timestamp: now }
            });

            renderWeather(response.data, loc.name, units);
            fetchMoon(loc.lat, loc.lon, loc.name);
          })
          .catch(err => {
            console.error('Weather fetch error:', err);
            weatherLoading.textContent = '▹ NETWORK ERROR';
          });
      });
    });
  }

  function renderWeather(data, locationName, units) {
    const iconCode = data.weather[0].icon;
    const icon = ICON_MAP[iconCode] || '◆';

    iconEl.textContent = icon;
    tempEl.innerHTML = Math.round(data.main.temp) + '&deg;' + (units === 'metric' ? 'C' : 'F');
    condEl.textContent = data.weather[0].description;
    humEl.textContent = data.main.humidity + '%';
    windEl.textContent = (data.wind.speed || 0) + (units === 'metric' ? ' m/s' : ' mph');

    if (locationName) {
      locEl.textContent = locationName;
    } else if (data.name) {
      const country = data.sys.country || '';
      locEl.textContent = country ? data.name + ', ' + country : data.name;
    }

    weatherLoading.classList.add('hidden');
    weatherWidget.classList.add('active');
  }

  // ── Moon phase ──────────────────────────────────────
  function fetchMoon(lat, lon, locationName) {
    const cacheKey = `moon_${lat.toFixed(2)}_${lon.toFixed(2)}`;
    chrome.storage.local.get([cacheKey], function (cacheResult) {
      const cache = cacheResult[cacheKey];
      const now = Date.now();

      if (cache && (now - cache.timestamp < 7200000)) {
        renderMoon(cache.data);
        return;
      }

      // Get browser's local timezone offset (minutes east of UTC = -getTimezoneOffset)
      const tzOffset = -new Date().getTimezoneOffset() / 60;
      const tzStr = tzOffset.toFixed(1);

      // Format today's date in YYYY-MM-DD
      const today = new Date();
      const dateStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');

      const url = 'https://aa.usno.navy.mil/api/rstt/oneday?date=' + dateStr +
        '&coords=' + lat.toFixed(4) + ',' + lon.toFixed(4) +
        '&tz=' + tzStr;

      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (!data || !data.properties || !data.properties.data) {
            console.warn('Moon API: unexpected response', data);
            return;
          }

          const d = data.properties.data;
          const rise = findMoonEvent(d.moondata, 'Rise');
          const set = findMoonEvent(d.moondata, 'Set');
          const moonData = {
            phase: d.curphase || 'Unknown',
            illum: d.fracillum || '--',
            rise: rise,
            set: set,
          };

          // If rise is missing (moon rose before today), try yesterday's data
          if (rise === '--') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.getFullYear() + '-' +
              String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
              String(yesterday.getDate()).padStart(2, '0');
            const yesterdayCacheKey = `moon_${lat.toFixed(2)}_${lon.toFixed(2)}_${yesterdayStr}`;

            chrome.storage.local.get([yesterdayCacheKey], function (ycache) {
              const yesterdayRise = ycache[yesterdayCacheKey];
              if (yesterdayRise && yesterdayRise.rise) {
                moonData.rise = yesterdayRise.rise;
                chrome.storage.local.set({
                  [cacheKey]: { data: moonData, timestamp: now }
                });
                renderMoon(moonData);
              } else {
                // Fetch yesterday's data for the rise time
                const yesterdayUrl = 'https://aa.usno.navy.mil/api/rstt/oneday?date=' + yesterdayStr +
                  '&coords=' + lat.toFixed(4) + ',' + lon.toFixed(4) +
                  '&tz=' + tzStr;
                fetch(yesterdayUrl)
                  .then(r => r.json())
                  .then(yData => {
                    const yd = yData.properties?.data;
                    const yRise = findMoonEvent(yd?.moondata, 'Rise');
                    moonData.rise = yRise;
                    // Cache yesterday's rise for future use
                    chrome.storage.local.set({
                      [yesterdayCacheKey]: { rise: yRise, timestamp: now },
                      [cacheKey]: { data: moonData, timestamp: now }
                    });
                    renderMoon(moonData);
                  })
                  .catch(() => {
                    // Fallback: save with whatever we have
                    chrome.storage.local.set({
                      [cacheKey]: { data: moonData, timestamp: now }
                    });
                    renderMoon(moonData);
                  });
              }
            });
          } else {
            chrome.storage.local.set({
              [cacheKey]: { data: moonData, timestamp: now }
            });
            renderMoon(moonData);
          }
        })
        .catch(err => {
          console.error('Moon fetch error:', err);
        });
    });
  }

  function findMoonEvent(moondata, phen) {
    if (!moondata) return '--';
    const event = moondata.find(e => e.phen === phen);
    return event ? event.time : '--';
  }

  function parseTimeToMinutes(timeStr) {
    if (!timeStr || timeStr === '--' || timeStr === '....' || timeStr === 'null') return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function isMoonVisible(riseTime, setTime) {
    const riseMin = parseTimeToMinutes(riseTime);
    const setMin = parseTimeToMinutes(setTime);

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    // Both available: standard logic
    if (riseMin !== null && setMin !== null) {
      if (riseMin < setMin) {
        return (nowMin >= riseMin && nowMin < setMin) ? 'VISIBLE ↑' : 'BELOW HORIZON';
      } else {
        return (nowMin >= riseMin || nowMin < setMin) ? 'VISIBLE ↑' : 'BELOW HORIZON';
      }
    }

    // Moon rose before today (no rise event) — use set time alone
    if (riseMin === null && setMin !== null) {
      return nowMin < setMin ? 'VISIBLE ↑' : 'BELOW HORIZON';
    }

    // Moon sets after midnight (no set event today) — use rise time alone
    if (riseMin !== null && setMin === null) {
      return nowMin >= riseMin ? 'VISIBLE ↑' : 'BELOW HORIZON';
    }

    return 'UNKNOWN';
  }

  function renderMoon(data) {
    const icon = MOON_PHASE_ICONS[data.phase] || '🌙';
    const visible = isMoonVisible(data.rise, data.set);

    moonIconEl.textContent = icon;
    moonPhaseEl.textContent = data.phase;
    moonIllumEl.textContent = data.illum;
    moonRiseEl.textContent = data.rise;
    moonSetEl.textContent = data.set;
    moonStatusEl.textContent = visible;

    // Color the status based on visibility
    if (visible.includes('VISIBLE')) {
      moonStatusEl.style.color = 'var(--accent)';
    } else if (visible === 'BELOW HORIZON') {
      moonStatusEl.style.color = 'var(--text-dim)';
    } else {
      moonStatusEl.style.color = 'var(--red)';
    }

    moonSection.classList.add('active');
  }

  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'sync' && changes.weather) {
      fetchWeather();
    }
  });

  fetchWeather();
})();
