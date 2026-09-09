# CyberPage

<img width="1761" height="895" alt="image" src="https://github.com/user-attachments/assets/8c1df850-ba01-466a-bfff-b042456277b8" />

MAGI/NERV-themed new tab page extension for Chrome-based browsers. Terminal aesthetic, weather, RSS feeds, bookmarks and quick links.

## Features

- **MAGI terminal aesthetic** — CRT scanlines, flicker animation, green-on-black, `Share Tech Mono` font
- **Clock & greeting** — centerpiece display with time-of-day greeting, localized to 6 languages
- **Search with bangs** — `g/` Google, `gh/` GitHub, `yt/` YouTube, `ddg/` DuckDuckGo, `w/` Wikipedia, `npm/` npm
- **Weather** — OpenWeatherMap with browser geolocation or city name. Emoji weather icons
- **Moon phase** — USNO astronomical data: phase, illumination, rise/set, visibility
- **Tides** — TideCheck API: current height + trend, next high/low, daily tide table
- **RSS reader** — configurable feed URLs in settings, inline XML parsing (RSS 2.0 + Atom)
- **Notepad** — persistent scratch notes via `chrome.storage.local`
- **Quick links** — configurable shortcuts to popular sites
- **Bookmarks** — categorized, `Ctrl+B` overlay
- **i18n** — 6 languages: English, Portuguese, Dutch, German, Japanese, Spanish
- **Export/import** — backup all settings as JSON

## Install

1. Clone or download this repo
2. Go to `chrome://extensions` → Enable Developer Mode → Load Unpacked
3. Select the extension directory
4. Open Options (right-click extension icon → Options, or click SETTINGS on the new tab)
5. Enter your OpenWeatherMap API key (free at [openweathermap.org/api](https://openweathermap.org/api))
6. Enter your TideCheck API key for tide predictions (free at [tidecheck.com/developers](https://tidecheck.com/developers))
7. Configure RSS feeds, quick links, and bookmarks

## License

UNLICENSE
