# Local widgets

Place custom `.ts` or `.js` widget files here, or in `<agent-dir>/footer-widgets/`
when using a read-only package. Default-export a `WidgetFactory` from
`../src/lib/widget.ts`. `/footer` discovers each file and offers an enable switch
and placement controls. See `../src/widgets/provider.ts` and the package README
for the lifecycle contract. These files are widgets, not Pi extension entry points.
