# Internal APIs

Document shared boundaries here when using them requires knowledge from another extension.

## Panel shell

`footer-plus/src/lib/panel.ts` is shared by footer++ and session manager. Both ship
in the checked source package; the session-manager Nix output selects its own entry point.

`createPanel(title, content, theme)` wraps a Pi component with a width-bounded ASCII
frame. It forwards keyboard input, mouse input, invalidation, and focus. It does not
own selection, state, persistence, completion, or async resources. Create a fresh
content component and shell for every `ctx.ui.custom()` interaction. The caller
must use the supplied completion callback to close the overlay.

`panelOverlay` supplies centered, responsive overlay dimensions. Content must
respect its available width. Caller-provided content controls height and scrolling.
