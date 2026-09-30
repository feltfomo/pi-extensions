import { SessionManager, SessionSelectorComponent, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey, type KeyId } from "@earendil-works/pi-tui";
import { createPanel, panelOverlay } from "./lib/panel.ts";

export default function sessionManager(pi: ExtensionAPI, shortcut: KeyId | null = "ctrl+alt+s") {
  let open = false;
  pi.registerCommand("sessions", {
    description: "Floating session manager: search, resume, new, rename, delete",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") { ctx.ui.notify("Session manager requires TUI mode", "error"); return; }
      if (open) return;
      open = true;
      try {
        await ctx.waitForIdle();
        const current = ctx.sessionManager.getSessionFile();
        const cwd = ctx.cwd;
        const directory = ctx.sessionManager.getSessionDir() || undefined;
        const action = await ctx.ui.custom<{ kind: "resume"; path: string } | { kind: "new" } | undefined>((tui, theme, keybindings, done) => {
          let creating = false;
          const selector = new SessionSelectorComponent(
            (progress, signal) => SessionManager.list(cwd, directory, progress, signal),
            async (progress, signal) => {
              const all = await SessionManager.listAll(progress, signal);
              const local = await SessionManager.list(cwd, directory, undefined, signal);
              return [...new Map([...all, ...local].map((session) => [session.path, session])).values()]
                .sort((a, b) => b.modified.getTime() - a.modified.getTime());
            },
            (path) => done({ kind: "resume", path }), () => done(creating ? { kind: "new" } : undefined), () => done(undefined),
            () => tui.requestRender(),
            {
              keybindings, showRenameHint: true,
              renameSession: async (path, name) => {
                if (!name?.trim()) return;
                if (path === current) pi.setSessionName(name.trim());
                else SessionManager.open(path).appendSessionInfo(name.trim());
              },
            }, current,
          );
          const panel = createPanel("session manager | ctrl+alt+n new | Escape closes", selector, theme);
          const handleInput = panel.handleInput;
          panel.handleInput = (data) => {
            if (matchesKey(data, "ctrl+alt+n")) { creating = true; selector.getSessionList().onCancel?.(); }
            else handleInput?.(data);
            tui.requestRender();
          };
          return panel;
        }, panelOverlay);
        // Session replacement invalidates ctx; nothing may read it after these awaits.
        if (action?.kind === "new") await ctx.newSession({ withSession: async (fresh) => { fresh.ui.notify("New session started", "info"); } });
        else if (action?.kind === "resume") await ctx.switchSession(action.path);
      } catch (error) { ctx.ui.notify(`Session manager: ${error instanceof Error ? error.message : String(error)}`, "error"); }
      finally { open = false; }
    },
  });
  if (shortcut) pi.registerShortcut(shortcut, {
    description: "Open session manager",
    // Shortcuts have no session-control context. Command dispatch supplies that boundary.
    handler: (ctx) => {
      if (ctx.mode === "tui") pi.sendUserMessage("/sessions", { expandPromptTemplates: true });
    },
  });
}
