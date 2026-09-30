# footer++ and session manager

Pi 0.99.1 source package. The manifest activates footer++ only; the session-manager
Nix package selects `src/session-manager.ts` instead.

## Widgets

| Name | Output | Default |
| --- | --- | --- |
| project-root | Project root, short or full path | on |
| git | Branch or detached commit; main checkout/worktree | on |
| diff | Tracked staged + unstaged line changes against HEAD | on |
| provider | Active provider | on |
| model | Active model | on |
| thinking | Thinking level | on |
| context | Context-window percentage, unknown when unavailable | on |
| codex-weekly | Weekly Codex quota remaining | on |
| response-time | Elapsed run time or last completed run time | on |
| session | Session name, falling back to abbreviated ID | off |
| extension-statuses | Other extensions' status text, without emoji | off |

The Git widget's "main checkout" describes the primary checkout, not a guessed
branch name. `showCheckout` defaults to true. Diff excludes untracked and binary
files; it refreshes after tool execution and session/model events. Context values
come from Pi's context usage API. Run time covers agent start through final settle,
including tools and continuations; it is not time-to-first-token. Values are not
reconstructed from previous sessions.

Session settings: `showId` adds the abbreviated ID beside a name. Project settings:
`style` is `short` or `full`. Codex settings: `pollSeconds` (60 to 3600, default 300)
and `showReset` (default false). Other widgets have no settings. Unknown settings
fail validation. Codex quota uses the authenticated account's actual weekly window;
no quota or credentials are estimated. Offline mode (`PI_OFFLINE=1`) skips quota
network access. Credential errors and account bodies are never printed.

## Configuration

`footer.json` defines a separator and up to ten lines, each containing `left`,
`center`, and `right` arrays. A widget spec contains `widget`, optional `enabled`
(default true), optional numeric `priority` (default 50), and `settings`.
Array order defines placement. Disabled specs retain position without constructing
widgets or starting timers. Narrow terminals drop lower-priority cells first.

`/footer` opens the editor. Its draft includes disabled entries for newly discovered
widgets. Save persists a full layout to `<agent-dir>/footer-overrides.json`.
Escape cancels; Reset restores the configured base. Override paths are changeable
with `--footer-overrides`; base paths with `--footer-config`. Nix-generated files
are never written. Failed override reads are reported, not silently discarded.

## Add a widget

Place a lowercase kebab-case `.ts` or `.js` file in `widgets/`, or in
`<agent-dir>/footer-widgets/`. The latter works with read-only Nix packages. Default
export a `WidgetFactory` from `src/lib/widget.ts`. `/footer` discovers it and offers
it disabled. No registry edit is needed. Duplicate filenames fail discovery.

`WidgetEnvironment` supplies current context, cached project metadata, footer
statuses, an abort signal, response timing, and `requestRender`. A factory validates
settings, then returns `render(theme)` plus optional `refresh()` and `dispose()`.

Rendering must be synchronous, side-effect free, one line, and use the supplied
active theme. Use `plainLabel` for untrusted labels. Do expensive work in refresh,
cache the result, and request a render. A disabled widget must allocate no resources.
Refresh can repeat while work is pending; serialize work where necessary. Honor the
abort signal and release timers/processes in dispose. Render or refresh failures
are isolated to the widget, with a warning once per footer instance. The footer
layout measures terminal columns, including ANSI and wide characters.

Use plain text or Nerd Font private-use glyphs for icons, never emoji. The extension
statuses widget strips emoji supplied by other extensions while retaining Nerd Font
glyphs. The MCP adapter can also disable its status icon with `showStatusIcon=false`.

## Session manager

`/sessions` uses Pi's exported session selector inside the shared floating panel.
It inherits search, sorting, scope, rename, deletion confirmation, and protection of
the active session. `ctrl+alt+n` starts a new session; Escape closes. The global
shortcut defaults to `ctrl+alt+s`. Session control runs in a command context; the
shortcut dispatches `/sessions` as a command and does not submit it to the model.
