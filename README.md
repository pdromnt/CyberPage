<div align="center">
  <img src="icons/icon-128.png" width="96" height="96" alt="CyberPage icon">
  <h1>CyberPage</h1>
  <p>A MAGI-inspired new tab interface for Chromium browsers.</p>
  <p>
    <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&amp;logo=javascript&amp;logoColor=black">
    <img alt="CSS" src="https://img.shields.io/badge/CSS-1572B6?style=flat&amp;logo=css3&amp;logoColor=white">
    <img alt="HTML5" src="https://img.shields.io/badge/HTML5-E34F26?style=flat&amp;logo=html5&amp;logoColor=white">
    <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-ff9933?style=flat&amp;logo=googlechrome&amp;logoColor=white">
  </p>
</div>

![CyberPage new tab interface](https://github.com/user-attachments/assets/8c1df850-ba01-466a-bfff-b042456277b8)

CyberPage replaces the browser's new tab page with a compact personal dashboard: weather and astronomical data on the left, search and shortcuts in the center, feeds and notes on the right, and a daily quote along the bottom. It is built with plain HTML, CSS, and JavaScript—no framework, build step, account, or analytics.

The look is based on the terminal displays of NERV's MAGI supercomputers: green phosphor text, amber accents, CRT scanlines, restrained animation, and dense information without turning the page into cockpit soup.

## Features

### Dashboard

- **Clock, date, and greeting** localized to the selected language.
- **Weather** from Open-Meteo using a configured city or browser geolocation. No API key required.
- **Moon data** from the US Naval Observatory, including phase, illumination, rise/set times, and visibility.
- **Tide predictions** from TideCheck, with current height and trend, next high/low, and a daily table.
- **RSS and Atom reader** for user-configured feeds, with independent scrolling and failure states per feed.
- **Pinned notes** stored locally and saved automatically while typing.
- **Pinned todo checklist** with add, complete, and delete controls. It can be disabled in Settings.
- **Quote of the day** backed by a local ten-quote queue from DummyJSON. One quote is shown per local calendar day and the queue refills when three remain.

### Navigation and personalization

- Search Google directly or use slash/bang prefixes for other services.
- Choose quick links from the bundled site directory.
- Create categorized bookmarks and open them from the top navigation.
- Configure metric or imperial weather units.
- Export and import portable settings as JSON.
- Use English, Portuguese, Spanish, Japanese, German, or Dutch.
- Respect the operating system's reduced-motion preference.

## Browser support

CyberPage targets Manifest V3 Chromium browsers and is primarily used with **Brave**. Chrome, Edge, and other Chromium derivatives should also work.

A Firefox extension ID is present in the manifest, but Firefox is not currently the tested target. Consider its support experimental.

## Installation

There is no packaged store release yet. Install the repository as an unpacked extension.

### Brave

1. Clone this repository or download and extract its ZIP.
2. Open `brave://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository directory—the folder containing `manifest.json`.
6. Open a new tab, then select **[SETTINGS]** in the upper-right corner.

### Chrome and Edge

Follow the same process from `chrome://extensions` or `edge://extensions`.

### Updating

1. Pull or download the newer files.
2. Return to the browser's extensions page.
3. Press **Reload** on CyberPage.
4. Refresh any already-open new tabs.

Settings and local data survive ordinary extension reloads. Removing the extension clears browser-managed extension storage unless the browser restores it separately.

## Configuration guide

Open **[SETTINGS]** from CyberPage. Saving returns to the new tab page.

### General

- Choose the interface language and date format.
- Enable or disable the todo widget. Existing todo items remain stored when the widget is hidden.

### Weather

Enable the widget, select Celsius or Fahrenheit, and optionally enter a location such as `Recife, BR`.

When the location is blank, CyberPage requests browser geolocation. If location access is denied, configure a city manually. Open-Meteo weather and geocoding do not require an API key.

### Tides

Tide predictions require a free [TideCheck developer key](https://tidecheck.com/developers). The key is stored only in local extension storage.

You can either:

- leave **Station ID** blank and allow geolocation so CyberPage can request the nearest station; or
- follow the **FIND ↗** link, locate a station on TideCheck, and paste its station ID manually.

CyberPage deliberately does not fall back to an unrelated default station when location or station lookup fails.

### RSS feeds

Add a short label and the complete `http://` or `https://` URL for each RSS 2.0 or Atom feed.

- Maximum configured feeds: **20**
- Items displayed per feed: **6**
- Maximum accepted response size: **2 MB**
- Request timeout: **12 seconds**

Some sites block requests that identify themselves as Brave. For configured feed hosts only, CyberPage rewrites its own feed-request headers to a generic Chromium signature. The rule requires both the CyberPage extension origin and a configured RSS destination; it does not alter normal browsing traffic.

### Quick links

Enable any entries from the bundled site directory. They appear below the search box; overflow entries are grouped under the additional-links control.

### Bookmarks

Create up to **5 categories**, with up to **10 links per category**. Bookmark URLs must use HTTP or HTTPS. Open the overlay with **[BOOKMARKS]** in the upper-right corner and close it with Escape or the on-screen close control.

### Data import and export

The JSON export contains portable synchronized preferences, RSS feeds, quick links, and bookmarks.

For privacy, it does **not** include:

- the TideCheck API key;
- notes or todo items;
- weather, tide, moon, or quote caches.

Imported URLs and data structures are normalized and constrained to the same limits as the Settings interface.

## Search shortcuts

Enter a prefix followed by `/`, `!`, or a space. Without a recognized prefix, CyberPage searches Google.

| Prefix | Service | Example |
| --- | --- | --- |
| `g` | Google | `g/ browser extensions` |
| `gh` | GitHub | `gh/ cyberpage` |
| `yt` | YouTube | `yt/ ambient music` |
| `ddg` | DuckDuckGo | `ddg/ privacy browsers` |
| `w` | Wikipedia | `w/ MAGI Evangelion` |
| `npm` | npm | `npm/ rss parser` |

Compact forms such as `gh/cyberpage` and bang forms such as `gh! cyberpage` also work.

## Storage and privacy

CyberPage has no backend, telemetry, advertising, or user account. Browser extension storage is split intentionally:

| Storage | Contents |
| --- | --- |
| `chrome.storage.sync` | Interface preferences, widget visibility, feed configuration, quick links, and bookmarks |
| `chrome.storage.local` | TideCheck key, notes, todo items, and API response caches |

The extension contacts only the services needed for enabled features:

| Service | Purpose | Key required |
| --- | --- | --- |
| [Open-Meteo](https://open-meteo.com/) | Weather and location search | No |
| [USNO](https://aa.usno.navy.mil/data/api) | Moon phase and rise/set data | No |
| [TideCheck](https://tidecheck.com/) | Tide stations and predictions | Yes |
| [DummyJSON](https://dummyjson.com/docs/quotes) | Cached quote queue | No |
| User-configured feed hosts | RSS and Atom content | Depends on the feed |

## Permissions

| Permission | Why it is used |
| --- | --- |
| `storage` | Saves preferences, bookmarks, notes, todos, credentials, and caches |
| `geolocation` | Resolves local weather and the nearest tide station when no location or station is configured |
| `declarativeNetRequest` | Applies the Brave compatibility header rule to configured RSS hosts |
| `http://*/*`, `https://*/*` | Fetches arbitrary user-configured feeds and the documented data services |

The broad host permission exists because feed URLs are user-defined. Runtime URL validation accepts only HTTP and HTTPS, feed responses are size-limited, and feed markup is parsed as data rather than injected as remote HTML.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | New tab dashboard markup |
| `settings.html` | Extension options interface |
| `background.js` | Feed-specific request-header compatibility rule |
| `js/` | Dashboard widgets, storage, parsing, and interactions |
| `css/` | Dashboard, Settings, reset, icon, and bundled font styles |
| `i18n/` | Translation dictionaries and language metadata |
| `data/sites.json` | Built-in quick-link directory |
| `icons/` | Browser extension icons |

There is no compilation step or package dependency. Edit the source files, reload the unpacked extension, and refresh the new tab page.

## Troubleshooting

### Weather stays unavailable

- Allow location access for the extension, or set a city manually.
- Try a more specific location such as `City, Country code`.
- Confirm Open-Meteo is reachable from the browser.

### Tides do not load

- Confirm the TideCheck key is present and valid.
- Use **FIND ↗** to verify the station ID.
- If Station ID is blank, allow geolocation.
- Cached data may remain visible temporarily when TideCheck is unavailable.

### A feed fails

- Use the feed's direct XML URL, not its website homepage.
- Confirm the URL opens without authentication.
- Reload CyberPage after changing feed configuration so the compatibility rule is refreshed immediately.
- Some servers still reject browser-side feed requests regardless of headers or CORS policy.

### Changes do not appear

Reload CyberPage from the browser's extensions page, then open a fresh new tab. Extension service workers and already-open extension pages may retain the previous code until reloaded.

## Contributing

Bug reports and focused pull requests are welcome. Please include the browser, the failing feature, reproduction steps, and any visible status message. Keep external API additions optional, cache-friendly, and keyless where practical.

## License

No license is currently granted. The repository is publicly viewable, but the code remains unlicensed unless a license file is added later.
