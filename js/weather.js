(function () {
  const weatherWidget = document.querySelector('#weather-widget');
  const weatherLoading = document.querySelector('#weather-loading');
  const iconEl = document.querySelector('#weather-icon');
  const tempEl = document.querySelector('#weather-temp');
  const condEl = document.querySelector('#weather-cond');
  const humEl = document.querySelector('#weather-hum');
  const windEl = document.querySelector('#weather-wind');
  const locEl = document.querySelector('#weather-loc');

  // Weather condition → Magi-friendly text icon
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

  function resolveLocation() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get({ weather: {} }, function (result) {
        const cfg = result.weather;

        // User-entered location
        if (cfg.location) {
          // Try geocode via OpenWeatherMap direct (city name)
          const apiKey = cfg.apiKey;
          if (!apiKey) { resolve(null); return; }

          fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cfg.location)}&limit=1&appid=${apiKey}`)
            .then(r => r.json())
            .then(data => {
              if (data && data.length > 0) {
                resolve({ lat: data[0].lat, lon: data[0].lon, name: cfg.location });
              } else {
                resolve(null);
              }
            })
            .catch(() => resolve(null));
        } else {
          // Use browser geolocation
          if (!navigator.geolocation) { resolve(null); return; }
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: null }),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 10000 }
          );
        }
      });
    });
  }

  function fetchWeather() {
    chrome.storage.sync.get({ weather: {} }, async function (result) {
      const cfg = result.weather;
      if (!cfg.show) { weatherLoading.classList.add('hidden'); return; }

      const apiKey = cfg.apiKey;
      if (!apiKey) {
        weatherLoading.textContent = '▹ API KEY REQUIRED';
        weatherLoading.classList.remove('hidden');
        return;
      }

      weatherLoading.classList.remove('hidden');
      weatherLoading.textContent = '▹ SYNCING...';

      const loc = await resolveLocation();
      if (!loc) {
        weatherLoading.textContent = '▹ LOCATION UNKNOWN';
        return;
      }

      const units = cfg.units || 'metric';
      const lang = (typeof i18n !== 'undefined' && i18n.currentLanguage) ? i18n.currentLanguage : 'en';

      // Check cache
      const cacheKey = `weather_${loc.lat.toFixed(2)}_${loc.lon.toFixed(2)}_${units}`;
      chrome.storage.local.get([cacheKey], function (cacheResult) {
        const cache = cacheResult[cacheKey];
        const now = Date.now();

        if (cache && (now - cache.timestamp < 600000)) {
          // Use cached data
          renderWeather(cache.data, loc.name, units);
          return;
        }

        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${loc.lat}&lon=${loc.lon}&units=${units}&lang=${lang}&appid=${apiKey}`)
          .then(r => r.json())
          .then(data => {
            if (data.cod !== 200) {
              weatherLoading.textContent = `▹ ERROR: ${data.message || 'UNKNOWN'}`;
              return;
            }

            // Cache it
            chrome.storage.local.set({
              [cacheKey]: { data, timestamp: now }
            });

            renderWeather(data, loc.name, units);
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

  // Listen for storage changes (settings updates)
  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'sync' && changes.weather) {
      fetchWeather();
    }
  });

  fetchWeather();
})();
