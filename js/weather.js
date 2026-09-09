(function () {
  const weatherWidget = document.querySelector('#weather-widget');
  const weatherLoading = document.querySelector('#weather-loading');
  const iconEl = document.querySelector('#weather-icon');
  const tempEl = document.querySelector('#weather-temp');
  const condEl = document.querySelector('#weather-cond');
  const humEl = document.querySelector('#weather-hum');
  const windEl = document.querySelector('#weather-wind');
  const locEl = document.querySelector('#weather-loc');
  const moonSection = document.querySelector('#moon-section');
  const moonIconEl = document.querySelector('#moon-icon');
  const moonPhaseEl = document.querySelector('#moon-phase');
  const moonIllumEl = document.querySelector('#moon-illum');
  const moonRiseEl = document.querySelector('#moon-rise');
  const moonSetEl = document.querySelector('#moon-set');
  const moonStatusEl = document.querySelector('#moon-status');
  let fetchSequence = 0;

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

  async function resolveLocation(cfg, lang) {
    if (cfg.location && cfg.location.trim()) {
      return geocodeLocation(cfg.location.trim(), lang);
    }
    if (!navigator.geolocation) return { error: 'NO_GEOLOCATION' };

    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: null }),
        () => resolve({ error: 'GEO_DENIED' }),
        { enableHighAccuracy: false, timeout: 10000 }
      );
    });
  }

  async function geocodeLocation(raw, lang) {
    const parts = raw.split(',').map(part => part.trim()).filter(Boolean);
    const name = parts[0];
    const qualifier = parts.at(-1)?.toLowerCase();
    const url = 'https://geocoding-api.open-meteo.com/v1/search?name='
      + encodeURIComponent(name) + '&count=10&format=json&language=' + encodeURIComponent(lang);

    try {
      const { response, data } = await fetchJson(url);
      if (!response.ok) return { error: 'GEO_LOOKUP_FAILED' };
      const results = Array.isArray(data.results) ? data.results : [];
      const match = results.find(result => {
        if (parts.length < 2) return true;
        return [result.country_code, result.country, result.admin1]
          .some(value => String(value || '').toLowerCase() === qualifier);
      }) || results[0];
      if (!match) return { error: 'GEO_NOT_FOUND: ' + raw };
      return {
        lat: match.latitude,
        lon: match.longitude,
        name: [match.name, match.admin1 || match.country_code].filter(Boolean).join(', '),
        timezone: match.timezone
      };
    } catch (_) {
      return { error: 'GEO_LOOKUP_FAILED' };
    }
  }

  async function fetchWeather() {
    const sequence = ++fetchSequence;
    await i18n.init();
    const result = await chrome.storage.sync.get({ weather: {} });
    const cfg = result.weather || {};

    if (!cfg.show) {
      weatherWidget.classList.remove('active');
      weatherLoading.classList.add('hidden');
      moonSection.classList.remove('active');
      return;
    }

    weatherWidget.classList.remove('active');
    moonSection.classList.remove('active');
    weatherLoading.classList.remove('hidden');
    weatherLoading.textContent = '▹ SYNCING...';

    const lang = i18n.currentLanguage || 'en';
    const locCacheKey = cfg.location
      ? `weather_loc_${cfg.location.trim().toLowerCase()}`
      : 'weather_loc_geo';
    const locCache = await chrome.storage.local.get([locCacheKey]);
    let loc = locCache[locCacheKey];

    if (!loc || Date.now() - loc.timestamp >= 86400000) {
      loc = await resolveLocation(cfg, lang);
      if (loc.error) {
        if (sequence === fetchSequence) weatherLoading.textContent = '▹ ' + loc.error;
        return;
      }
      loc.timestamp = Date.now();
      await chrome.storage.local.set({ [locCacheKey]: loc });
    }
    if (sequence !== fetchSequence) return;

    const units = cfg.units === 'imperial' ? 'imperial' : 'metric';
    const cacheKey = `weather_${loc.lat.toFixed(2)}_${loc.lon.toFixed(2)}_${units}_${lang}`;
    const cacheResult = await chrome.storage.local.get([cacheKey]);
    const cache = cacheResult[cacheKey];
    if (cache && Date.now() - cache.timestamp < 600000) {
      renderWeather(cache.data, loc.name, units);
      fetchMoon(loc.lat, loc.lon, cache.data.timezone || loc.timezone, sequence);
      return;
    }

    const params = new URLSearchParams({
      latitude: loc.lat,
      longitude: loc.lon,
      current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
      temperature_unit: units === 'imperial' ? 'fahrenheit' : 'celsius',
      wind_speed_unit: units === 'imperial' ? 'mph' : 'ms',
      timezone: 'auto'
    });

    try {
      const { response, data } = await fetchJson('https://api.open-meteo.com/v1/forecast?' + params);
      if (!response.ok || data.error || !data.current) {
        throw new Error(data.reason || 'unexpected response');
      }
      if (sequence !== fetchSequence) return;
      await chrome.storage.local.set({ [cacheKey]: { data, timestamp: Date.now() } });
      renderWeather(data, loc.name, units);
      fetchMoon(loc.lat, loc.lon, data.timezone || loc.timezone, sequence);
    } catch (error) {
      console.error('Weather fetch error:', error);
      if (sequence === fetchSequence) weatherLoading.textContent = '▹ NETWORK ERROR';
    }
  }

  function renderWeather(data, locationName, units) {
    const current = data.current;
    iconEl.textContent = weatherIcon(current.weather_code, current.is_day);
    tempEl.textContent = Math.round(current.temperature_2m) + '°' + (units === 'metric' ? 'C' : 'F');
    condEl.textContent = i18n.t(weatherDescriptionKey(current.weather_code));
    humEl.textContent = Math.round(current.relative_humidity_2m) + '%';
    windEl.textContent = current.wind_speed_10m + (units === 'metric' ? ' m/s' : ' mph');
    locEl.textContent = locationName || [data.latitude.toFixed(2), data.longitude.toFixed(2)].join(', ');
    weatherLoading.classList.add('hidden');
    weatherWidget.classList.add('active');
  }

  function weatherIcon(code, isDay) {
    if (code === 0) return isDay ? '☀' : '☾';
    if (code <= 2) return '⛅';
    if (code === 3) return '☁';
    if (code === 45 || code === 48) return '🌫';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄';
    if (code >= 95) return '⛈';
    return code >= 51 ? '🌧' : '◆';
  }

  function weatherDescriptionKey(code) {
    if (code === 0) return 'weather_clear';
    if (code === 1) return 'weather_mainly_clear';
    if (code === 2) return 'weather_partly_cloudy';
    if (code === 3) return 'weather_overcast';
    if (code === 45 || code === 48) return 'weather_fog';
    if ([51, 53, 55, 56, 57].includes(code)) return 'weather_drizzle';
    if ([61, 63, 65, 66, 67].includes(code)) return 'weather_rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'weather_snow';
    if ([80, 81, 82].includes(code)) return 'weather_showers';
    if (code >= 95) return 'weather_thunderstorm';
    return 'weather_unknown';
  }

  async function fetchMoon(lat, lon, timezone, sequence) {
    const zone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = dateInZone(new Date(), zone);
    const cacheKey = `moon_${lat.toFixed(2)}_${lon.toFixed(2)}_${today}`;
    const cacheResult = await chrome.storage.local.get([cacheKey]);
    const cache = cacheResult[cacheKey];
    if (cache && Date.now() - cache.timestamp < 7200000) {
      if (sequence === fetchSequence) renderMoon(cache.data);
      return;
    }

    try {
      const moonData = await requestMoonDay(lat, lon, today, zone);
      if (moonData.rise === '--') {
        const yesterday = shiftIsoDate(today, -1);
        const previous = await requestMoonDay(lat, lon, yesterday, zone);
        if (previous.rise !== '--') {
          moonData.rise = previous.rise;
          moonData.riseFromYesterday = true;
        }
      }
      await chrome.storage.local.set({ [cacheKey]: { data: moonData, timestamp: Date.now() } });
      if (sequence === fetchSequence) renderMoon(moonData);
    } catch (error) {
      console.error('Moon fetch error:', error);
    }
  }

  async function requestMoonDay(lat, lon, date, timezone) {
    const offset = timezoneOffsetHours(date, timezone).toFixed(1);
    const url = 'https://aa.usno.navy.mil/api/rstt/oneday?date=' + date
      + '&coords=' + lat.toFixed(4) + ',' + lon.toFixed(4) + '&tz=' + offset;
    const { response, data } = await fetchJson(url);
    if (!response.ok) throw new Error('Moon API HTTP ' + response.status);
    const details = data?.properties?.data;
    if (!details) throw new Error('Moon API returned an unexpected response');
    return {
      phase: details.curphase || 'Unknown',
      illum: details.fracillum || '--',
      rise: findMoonEvent(details.moondata, 'Rise'),
      set: findMoonEvent(details.moondata, 'Set'),
      fetchedDate: date,
      riseFromYesterday: false,
      timezone
    };
  }

  function findMoonEvent(events, phenomenon) {
    const event = Array.isArray(events) ? events.find(item => item.phen === phenomenon) : null;
    return event?.time || '--';
  }

  function renderMoon(data) {
    const visible = isMoonVisible(data.rise, data.set, data.timezone);
    const today = dateInZone(new Date(), data.timezone);
    const setLabel = data.fetchedDate === today ? 'Today' : data.fetchedDate || '';
    const riseLabel = data.riseFromYesterday ? 'Yesterday' : setLabel;
    moonIconEl.textContent = MOON_PHASE_ICONS[data.phase] || '🌙';
    moonPhaseEl.textContent = data.phase;
    moonIllumEl.textContent = data.illum;
    moonRiseEl.textContent = data.rise !== '--' ? riseLabel + ' ' + data.rise : data.rise;
    moonSetEl.textContent = data.set !== '--' ? setLabel + ' ' + data.set : data.set;
    moonStatusEl.textContent = visible;
    moonStatusEl.style.color = visible.includes('VISIBLE')
      ? 'var(--accent)'
      : visible === 'BELOW HORIZON' ? 'var(--text-dim)' : 'var(--red)';
    moonSection.classList.add('active');
  }

  function isMoonVisible(riseTime, setTime, timezone) {
    const rise = timeToMinutes(riseTime);
    const set = timeToMinutes(setTime);
    const parts = timePartsInZone(new Date(), timezone);
    const now = parts.hour * 60 + parts.minute;
    if (rise !== null && set !== null) {
      return (rise < set ? now >= rise && now < set : now >= rise || now < set)
        ? 'VISIBLE ↑' : 'BELOW HORIZON';
    }
    if (rise === null && set !== null) return now < set ? 'VISIBLE ↑' : 'BELOW HORIZON';
    if (rise !== null && set === null) return now >= rise ? 'VISIBLE ↑' : 'BELOW HORIZON';
    return 'UNKNOWN';
  }

  function timeToMinutes(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(value || '');
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function dateInZone(date, timezone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const get = type => parts.find(part => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function timePartsInZone(date, timezone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    const get = type => Number(parts.find(part => part.type === type).value);
    return { hour: get('hour'), minute: get('minute') };
  }

  function timezoneOffsetHours(dateString, timezone) {
    const noonUtc = new Date(dateString + 'T12:00:00Z');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(noonUtc);
    const get = type => Number(parts.find(part => part.type === type).value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return (asUtc - noonUtc.getTime()) / 3600000;
  }

  function shiftIsoDate(dateString, days) {
    const date = new Date(dateString + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
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
    if (namespace === 'sync' && changes.weather) fetchWeather();
  });

  fetchWeather();
})();
