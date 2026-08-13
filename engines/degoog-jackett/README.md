# degoog-jackett

A custom search engine extension for **degoog** to search torrents and media across configured indexers using the [Jackett](https://github.com/Jackett/Jackett) Torznab / JSON API.

## Features

- **Jackett API v2.0 Integration**: Queries all indexers or a specific configured indexer.
- **Rich Torrent Metadata**: Parses seeders, peers/leechers, human-readable file size, tracker name, category, publish date, and magnet/download links.
- **Time & Date Filtering**: Filters results by time period (day, week, month, year) or specific date range.
- **Poster / Thumbnail Proxying**: Supports poster image preview using degoog's proxy URL signing.
- **Custom Bang Shortcut**: Use `!jackett <query>` directly in your search bar.

## Configuration

In the degoog settings panel for **degoog-jackett**, configure the following options:

| Setting | Type | Required | Default | Description |
|---|---|---|---|---|
| **Base URL** (`baseUrl`) | Text | Yes | `http://localhost:9117` | The URL where your Jackett instance is hosted. |
| **API Key** (`apiKey`) | Password | Yes | — | Your Jackett API key (found in the top right of the Jackett web UI). |
| **Indexer** (`indexer`) | Text | No | `all` | Specific indexer ID (e.g. `1337x`, `yts`) or `all` to search all configured indexers. |
| **Categories** (`categories`) | Text | No | `""` | Comma-separated Torznab category IDs (e.g. `2000,5000` for Movies and TV). |

## Usage

- **Normal Search**: Select the **Torrent** or **Web** search tab in degoog.
- **Bang Shortcut**: Search with `!jackett <query>` (or `!degoog-jackett <query>`).
