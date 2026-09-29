# Pi extensions

One repository for personal Pi extensions. Each extension owns a top-level directory, its TypeScript package, and its default JSON configuration. `nix/` holds per-extension packaging and Home Manager modules. There are no nested repositories or submodules.

The Git remote uses SSH: `git@github.com:feltfomo/pi-extensions.git`.

## Outputs

| Output | Purpose |
| --- | --- |
| `packages.<system>.status-lines` | A complete Pi package with runtime dependencies |
| `homeManagerModules.status-lines` | Declarative installation and JSON configuration |
| `checks.<system>.status-lines` | Package build, TypeScript check, and Node tests |
| `checks.<system>.home-manager-status-lines` | Module boundaries and generated JSON validation |
| `devShells.<system>.default` | Node 24, Git, Python, Nix formatter, and npm dependency prefetcher |

`default` package and Home Manager module aliases point to Status Lines. Packages and development shells support `x86_64-linux` and `aarch64-linux`.

## Nix package

Run `nix build .#status-lines`, then `pi -e ./result` to try the built extension. The output root is the Pi package directory. It includes TypeScript source and runtime dependencies; no npm download or compilation is needed at startup.

Installing this data package with `nix profile install .#status-lines` keeps it rooted, but does not activate it in Pi. Use the Home Manager module for activation, or pass the package's store path to `pi install`. Avoid activating the same extension through both mechanisms.

For another flake, declare the input URL as `git+ssh://git@github.com/feltfomo/pi-extensions` and follow your existing `nixpkgs` and `home-manager` inputs. SSH access to the repository is required. This repository's lock pins both inputs to a tested pair; following them uses the consumer's pins instead.

## Home Manager

Import `inputs.pi-extensions.homeManagerModules.status-lines` into a Home Manager configuration. Set `programs.pi-coding-agent.extensions.status-lines.enable = true`. The compiled example in `nix/examples/home-manager.nix` enables the extension and changes its separator.

Options:

- `enable`: defaults to false.
- `package`: defaults to the Status Lines derivation built with Home Manager's `pkgs`; it can be set to `inputs.pi-extensions.packages.<system>.status-lines`.
- `settings`: JSON-compatible Status Lines configuration. Defaults are read from `status-lines/status-lines.json`. Partial top-level overrides retain other defaults. A `lines` definition replaces the complete tier list.

The module uses `programs.pi-coding-agent.configDir`, which defaults to `~/.pi/agent`. It manages only `status-lines.json` and `extensions/status-lines/index.ts` in that directory. The generated loader imports the packaged extension and supplies its generated JSON as the default configuration. The CLI flag `--status-lines-config` can still override it for one invocation.

The module does not install or enable Pi itself, replace `settings.json`, or manage authentication. Keep your existing Pi installation. For a non-default config directory, it exports `PI_CODING_AGENT_DIR` even when the upstream Pi Home Manager program is disabled.

On NixOS, import this Home Manager module into `home-manager.users.<name>.imports`. Extension state and configuration belong to the user, so this repository has no separate system-wide extension module. Apply that configuration through your normal Home Manager or NixOS workflow; building this flake alone changes no home files or services.

Nix-generated configuration is read-only. Change `settings` in Nix and apply it, or use a separate writable JSON file through the CLI flag. Credentials must never enter Nix settings or the store.

## Layout and new extensions

`status-lines/` is independently loadable by Pi and npm. `nix/packages/status-lines.nix` builds it, and `nix/home-manager/status-lines.nix` owns its declarative integration. Its README documents the widget contract.

For another extension, add its own directory, package expression, named Home Manager module, and explicit flake outputs. Share an implementation only when a second extension needs the same behavior. The repository does not require an extension framework or a system configuration framework.

## Development and gates

Enter `nix develop`, then run `npm ci` in `status-lines/`. Run `npm run check` and `npm test` there. `python3 tests/terminal-smoke.py` exercises the installed Pi offline in regular and fullscreen PTYs without a model prompt. Pass `--extension ../result` from the extension directory to test the built Nix package instead of local source.

Run `nix fmt`, then `nix flake check`. The package build runs the TypeScript check and Node tests in the sandbox. The module check evaluates disabled/enabled configurations, partial overrides, the generic example, and a relocated agent directory, then validates generated files with the extension's own parser.

A Git-backed flake sees tracked source. Before staging a candidate, `nix flake check path:.` includes untracked source; the package fileset excludes node_modules, logs, and generated test directories. The first packaging step after a lockfile change is `env NPM_FETCHER_VERSION=2 prefetch-npm-deps status-lines/package-lock.json`; put its hash in `nix/packages/status-lines.nix`. Fetcher version 2 includes registry metadata needed by Pi's published shrinkwrap. Registry entries need integrity hashes. Do not upgrade dependencies to resolve a missing hash.
