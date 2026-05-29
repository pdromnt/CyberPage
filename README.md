# CyberPage

MAGI/NERV-themed new tab page extension for Chrome-based browsers. Terminal aesthetic, weather, RSS feeds, bookmarks and quick links.

Forked from [ZenPage+](https://github.com/pdromnt/zenpage) with a complete visual overhaul and feature rework.

## Features

- **MAGI terminal aesthetic** — CRT scanlines, flicker animation, green-on-black, `Share Tech Mono` font
- **Clock & greeting** — centerpiece display with time-of-day greeting
- **Search with bangs** — `g/` Google, `gh/` GitHub, `yt/` YouTube, `ddg/` DuckDuckGo, `w/` Wikipedia, `npm/` npm
- **Weather** — OpenWeatherMap with browser geolocation or city name. Emoji weather icons. No PositionStack needed.
- **RSS reader** — configurable feed URLs in settings, inline XML parsing (RSS 2.0 + Atom)
- **Notepad** — persistent scratch notes via `chrome.storage.local`
- **Quick links** — configurable shortcuts to popular sites
- **Bookmarks** — categorized, `Ctrl+B` overlay
- **Export/import** — backup all settings as JSON

## What's different from ZenPage

| ZenPage | CyberPage |
|---------|-----------|
| Unsplash backgrounds | Solid dark terminal background |
| PositionStack geocoding | OpenWeatherMap geocoding (one less API key) |
| Lineicons font | Emoji/text weather icons |
| 6-language i18n | English only |
| animate.css, moment.js | CSS keyframes, Intl.DateTimeFormat |
| Photo credits footer | MAGI ticker with Evangelion flavor text |

## Install

1. Clone or download this repo
2. Go to `chrome://extensions` → Enable Developer Mode → Load Unpacked
3. Select the extension directory
4. Open Options (right-click extension icon → Options, or click SETTINGS on the new tab)
5. Enter your OpenWeatherMap API key (get one free at [openweathermap.org/api](https://openweathermap.org/api))
6. Configure RSS feeds, quick links, and bookmarks

## License

UNLICENSE — same as ZenPage+ for new code.
