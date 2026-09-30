# Pi extensions

Two extensions for Pi 0.99.1:

- **footer++**: configurable multiline footer and a floating widget configuration panel.
- **session manager**: floating session search, resume, creation, rename, and confirmed deletion.

## Nix

Import `inputs.pi-extensions.homeManagerModules.default` to expose both modules.
Individual modules are `footer-plus` and `session-manager`. See the compiled
example in `nix/examples/home-manager.nix`.

Set `programs.pi-coding-agent.extensions.footer-plus.enable = true` and
`programs.pi-coding-agent.extensions.session-manager.enable = true`.
Both use `programs.pi-coding-agent.configDir`; neither enables Pi itself or manages
Pi's settings.json. The `status-lines` module and package attributes remain aliases.
The old Home Manager option path redirects to `footer-plus` with a rename warning.

Every bundled footer widget has `widgets.<name>.enable`, `row`, `group`, `position`,
`priority`, and `settings`. Rows and positions start at zero. Groups are `left`,
`center`, and `right`. Higher priority survives narrow terminals. Position ties sort
by widget name. Disabled widgets retain their slots. For example, setting
`widgets.model = { enable = true; row = 3; group = "left"; position = 0; };`
places the model in the fourth configured row, at the left of that group.
Empty rows are hidden rather than taking terminal space.

`settings.separator` sets the separator. Raw `settings.lines` replaces the generated
layout and bypasses `widgets` options. `showReset` adds local reset timestamps to
Codex quota widgets. Each extension has a nullable `shortcut` option using Pi key
syntax. Defaults: `ctrl+alt+f` and `ctrl+alt+s`.

The module owns footer.json. Panel saves go to the writable footer-overrides.json
in the agent directory, never to a Nix store path. Overrides replace the layout
until reset, including when Nix defaults change. `/footer reset` removes them.

`packages.<system>.footer-plus` and `packages.<system>.session-manager` are Pi
packages. Try `nix build .#footer-plus`, then `pi -e ./result`. The session-manager
output selects a different entry point from the same checked source and runtime
closure. This keeps Pi pins and the shared panel shell in one place without
activating both extensions when only one is requested.

## Commands

`/footer` configures all discovered widgets. Enter opens a widget's settings; choose
enabled state, row, group, or position. Changes return to the widget list. Save
applies and persists the draft. Escape from the main list cancels it. Reset removes
panel overrides. `/footer on`, `/footer off`, and `/footer reload` control the footer.

`/sessions` opens session manager. Search by typing, Tab switches current folder/all,
Enter resumes, `ctrl+r` renames, `ctrl+d` confirms deletion, and `ctrl+alt+n` creates
a session. The picker honors Pi's configured session-selector keybindings. The
active session cannot be deleted. The all view includes default storage and the
current session directory if it is customized. Session switching waits for idle and
uses Pi's session replacement API, including its cancellation and trust handling.

## Development

Source, tests, and pinned development dependencies live in `footer-plus/`.
`src/index.ts` is footer++; `src/session-manager.ts` is session manager.
`internal-api/README.md` documents the shared panel shell.

Enter `nix develop`, then run `npm ci --ignore-scripts` in `footer-plus/`.
Run `npm run check` and `npm test`. `nix flake check path:.` also builds both
packages and verifies Home Manager configuration. Package filesets exclude local
node_modules, logs, and temporary fixtures.

After a lockfile change, use `env NPM_FETCHER_VERSION=2 prefetch-npm-deps footer-plus/package-lock.json`
and update `npmDepsHash` in `nix/packages/footer-plus.nix`. Fetcher version 2 supplies
registry metadata required by Pi's shrinkwrap. No global installation is needed.

`python3 footer-plus/tests/terminal-smoke.py` exercises both panels offline in PTYs.
Use `--extension ./result` to test a Nix-built footer package. The script creates
isolated test files inside the checkout and never sends a model prompt.
