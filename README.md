# OKF

Read and write `.md` files in the [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) (OKF 0.2) — markdown concepts with YAML frontmatter that knowledge tools and agents exchange. Builds on [`rimir/frontmatter`](https://github.com/rimir-cc/tw-frontmatter) through its extension hooks.

## Features

- **OKF 0.2 frontmatter** — full YAML (nested maps, flow lists): `generated`, `verified`, `sources`, `usage_window` round-trip as JSON fields
- **Concept types** — OKF `type` lives in `okf.type`; the tiddler type is always `text/markdown`
- **Concept IDs = paths** — files stay where they are; new concepts are created at `<title>.md` with `/` as folders
- **Exact titles** — `tw.title` is written only when the file path can't reproduce the tiddler title (e.g. `:`)
- **Scope filter** — all `.md` files by default, or only tiddlers matching a filter (e.g. `[tag[okf]]`)
- **Safety rule** — files whose `type` is not a TW content type are always handled as OKF, so foreign OKF files are never destroyed
- **Lossless** — unknown keys are kept: scalars as fields, nested values in `okf.extra`

## Field mapping

| OKF frontmatter | Tiddler field |
|---|---|
| `type` | `okf.type` (no field when it equals the default type `tiddler`) |
| `title` | `caption` |
| `tw.title` | `title` (otherwise the title comes from the file path) |
| `tags`, `description` | `tags`, `description` |
| `resource`, `status`, `stale_after` | `okf.resource`, `okf.status`, `okf.stale_after` |
| `generated`, `verified`, `sources`, `usage_window` | `okf.<key>` as JSON |
| `created`, `modified` | TW dates (written as ISO 8601) |
| other scalar keys | field of the same name |
| other nested keys | `okf.extra` (YAML) |

## Prerequisites

- TiddlyWiki 5.3.0+ (Node.js server edition)
- `rimir/frontmatter` and the official `tiddlywiki/markdown` plugin
- **Restart the server after installing** — the mapping runs in server-side startup and save code

## Quick Start

1. Install the plugin and restart the server
2. Drop OKF `.md` files into `tiddlers/` — `tiddlers/metrics/revenue.md` becomes tiddler `metrics/revenue`, its `type: Metric` the field `okf.type`, its `title` the `caption`
3. Edit as usual — saving writes a valid OKF document back to the same file
4. Optional: restrict OKF to some tiddlers via `$:/config/rimir/okf/filter` (e.g. `[tag[okf]]`)

## License

MIT. Bundles [js-yaml](https://github.com/nodeca/js-yaml) 4.1.0 (MIT).
