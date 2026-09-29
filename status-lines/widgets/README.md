# Local widgets

Place custom `.ts` or `.js` widget files here. Default-export a `WidgetFactory` from `../src/lib/widget.ts`, add the filename stem to `status-lines.json`, then run `/status-lines reload`.

See `../src/widgets/provider.ts` for a minimal implementation and the package README for the lifecycle contract. This directory is deliberately outside Pi's extension entry point: its files are loaded as widgets, not as independent extensions.
