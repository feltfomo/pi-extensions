# Status Lines

A Pi extension that replaces the footer below the prompt with configurable tiers. The default has two lines: project root and Git checkout above, provider/model/thinking, other extension statuses, and Codex weekly quota below.

## Try it

From this directory, run `npm ci`, then start Pi with `pi -e /absolute/path/to/pi-extensions/status-lines`. This loads it for that invocation without editing Pi settings. Run that command from whichever project you want to work on.

For a persistent personal installation, run `pi install /absolute/path/to/pi-extensions/status-lines`. Only one extension can replace the footer at a time. The repository's top-level README documents its Nix package and Home Manager module; Nix packaging needs no npm install at startup.

Commands:

- `/status-lines reload`: reread config and widget files.
- `/status-lines off`: restore Pi's built-in footer and stop background work.
- `/status-lines on`: install the custom footer again.

The extension is inactive outside interactive TUI mode.

## Configuration

Edit `status-lines.json` in the package directory. Pass `--status-lines-config /absolute/path/config.json` to Pi to use another file. Relative flag paths resolve from the session working directory. The exported extension factory accepts an optional second argument for a managed default config path; the Home Manager loader uses it without changing global environment state. The CLI flag takes precedence over that default. This extension does not automatically load executable widgets from projects you visit.

`lines` is an ordered array of 1 to 10 tiers. Each tier has `left`, `center`, and `right` arrays; omitted regions are empty. Each widget entry has a `widget` filename stem, optional numeric `priority` (default 50), and optional `settings` object. The top-level `separator` defaults to ` | `.

Higher-priority widgets survive narrow terminals. The layout removes lower-priority widgets until the regions fit, then truncates the last remaining widget if necessary. The center region is centered relative to the terminal. Width measurement handles ANSI styles and wide characters. No widget wraps onto another tier.

Built-in settings:

| Widget | Settings |
| --- | --- |
| `project-root` | `style`: `short`, `full`, or `name`; default `short` abbreviates the home directory |
| `git` | `showCheckout`: boolean, default true |
| `codex-weekly` | `pollSeconds`: 60 to 3600, default 300; `showReset`: boolean, default false |
| `model`, `provider`, `thinking`, `extension-statuses` | None |

Git labels `local` and `worktree` distinguish the main working tree from a linked worktree. Detached HEAD displays its short commit ID. Outside Git, the root is the working directory and Git displays `no git`. These labels do not describe remote execution.

## Widget contract

Add a lowercase, hyphenated `.ts` or `.js` file to `widgets/`, then reference its filename stem in config. Built-ins live in `src/widgets/`. Names must be unique across both directories. `/status-lines reload` discovers new files; no central registry edit is required. Widget files execute with the same permissions as Pi. Do not install untrusted files.

The default export implements `WidgetFactory` in `src/lib/widget.ts`. `src/widgets/provider.ts` is a minimal example. Each factory receives a `WidgetEnvironment` and its settings object. Validate widget-specific settings in the factory.

The returned `Widget` implements `render(theme): string`. Output must fit on one logical line; the layout owns final width allocation and truncation. Use the supplied theme at render time and `plainLabel()` for untrusted paths or labels. Other extensions' status output may already contain ANSI styling.

Optional `refresh()` runs at startup and on model/thinking changes, agent completion, and tree navigation. It may be asynchronous. Cache expensive work outside rendering and call `environment.requestRender()` after background state changes. The environment provides the live context, a shared project snapshot, Pi's read-only footer data, and an abort signal. Do not capture an old session context; call `environment.context()` when needed.

Optional `dispose()` releases subscriptions and timers. The host aborts the environment signal before disposal and ignores redraw requests afterward. Cleanup must be idempotent. Start background work only in the widget factory, which is called after an interactive session starts. Factory construction must either complete or release its own partial resources before throwing. A failed widget renders an unavailable label without hiding neighboring widgets.

The footer host owns shared Git inspection because both project-root and Git widgets depend on the same checkout metadata. Git work is asynchronous, bounded, and refreshed on Pi's branch notifications. The layout and widget contract have no network policy; quota polling belongs to `codex-weekly`.

## Codex quota

The widget requests `https://chatgpt.com/backend-api/wham/usage` using Pi's resolved Codex credentials and the account ID from the access token. Pi owns token refresh. The fixed endpoint rejects redirects; credentials never enter config, logs, or footer text. No model completion is made to obtain quota.

The weekly window is selected by its duration of 604800 seconds, not by assuming primary or secondary means weekly. Remaining percentage is `100 - used_percent`, displayed to one decimal place without rounding upward. Additional model-specific limits are not displayed. This account endpoint is an upstream implementation detail and can change.

Set `"showReset": true` in the `codex-weekly` entry's `settings` to append `(resets YYYY-MM-DD HH:mm)` beside the percentage. The timestamp uses the machine's local timezone and comes from the same weekly quota window. It remains visible on stale values; unavailable states have no reset timestamp.

The widget shows `loading`, `login required`, `unavailable`, or `n/a` instead of estimating a percentage. Pi's `--offline` mode disables quota requests and displays `weekly offline`. A failed refresh retains the last successful value with `(stale)`. An expired quota window is also marked stale. Requests are spaced at least 60 seconds apart; normal polling is every five minutes. Non-Codex models display `weekly n/a`.

The endpoint and fields were checked against OpenAI Codex's `backend-client/src/client/rate_limit_resets.rs` and `backend-client/src/client.rs`. Automated tests use fixtures, never a real account.

## Checks

Run `npm run check` and `npm test` with Node 24 or later. Tests cover the shipped two-tier configuration, layout, file-based widget loading, lifecycle cleanup, Git checkout metadata, and quota parsing/display. `python3 tests/terminal-smoke.py` exercises the installed Pi in regular and fullscreen PTYs: startup, off/on, reload, resize, and shutdown. It uses offline mode and sends no model prompt. A real terminal is still needed to judge appearance and interaction with other footer extensions.
