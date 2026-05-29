# CyberPage

MAGI/NERV-themed new tab page extension for Chrome-based browsers. Terminal aesthetic, weather, RSS feeds, bookmarks and quick links.

## Features

- **MAGI terminal aesthetic** — CRT scanlines, flicker animation, green-on-black, `Share Tech Mono` font
- **Clock & greeting** — centerpiece display with time-of-day greeting, localized to 6 languages
- **Search with bangs** — `g/` Google, `gh/` GitHub, `yt/` YouTube, `ddg/` DuckDuckGo, `w/` Wikipedia, `npm/` npm
- **Weather** — OpenWeatherMap with browser geolocation or city name. Emoji weather icons
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
5. Enter your OpenWeatherMap API key (get one free at [openweathermap.org/api](https://openweathermap.org/api))
6. Configure RSS feeds, quick links, and bookmarks

## License

UNLICENSE
