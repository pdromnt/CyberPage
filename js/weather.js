(function () {
  const weatherWidget = document.querySelector('#weather-widget');
  const weatherLoading = document.querySelector('#weather-loading');
  const iconEl = document.querySelector('#weather-icon');
  const tempEl = document.querySelector('#weather-temp');
  const condEl = document.querySelector('#weather-cond');
  const humEl = document.querySelector('#weather-hum');
  const windEl = document.querySelector('#weather-wind');
  const locEl = document.querySelector('#weather-loc');

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
        return;
      }

      if (!cfg.apiKey) {
        weatherLoading.textContent = '▹ API KEY REQUIRED';
        weatherLoading.classList.remove('hidden');
        return;
      }

      weatherLoading.classList.remove('hidden');
      weatherLoading.textContent = '▹ SYNCING...';

      const loc = await resolveLocation(cfg);
      if (loc.error) {
        weatherLoading.textContent = '▹ ' + loc.error;
        return;
      }

      const units = cfg.units || 'metric';
      const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'en';

      const cacheKey = `weather_${loc.lat.toFixed(2)}_${loc.lon.toFixed(2)}_${units}`;
      chrome.storage.local.get([cacheKey], function (cacheResult) {
        const cache = cacheResult[cacheKey];
        const now = Date.now();

        if (cache && (now - cache.timestamp < 600000)) {
          renderWeather(cache.data, loc.name, units);
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

  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'sync' && changes.weather) {
      fetchWeather();
    }
  });

  fetchWeather();
})();
