{
  pkgs,
  home-manager,
  footer-plus,
  session-manager,
}:
let
  inherit (pkgs) lib;
  agentDir = "/home/test/.pi/agent";
  evaluate =
    modules:
    (home-manager.lib.homeManagerConfiguration {
      inherit pkgs;
      modules = [
        ../home-manager/footer-plus.nix
        ../home-manager/session-manager.nix
        {
          home = {
            username = "test";
            homeDirectory = "/home/test";
            stateVersion = "26.05";
          };
          programs.pi-coding-agent.extensions.footer-plus.package = footer-plus;
          programs.pi-coding-agent.extensions.session-manager.package = session-manager;
        }
      ]
      ++ modules;
    }).config;
  disabled = evaluate [ ];
  enabled = evaluate [ { programs.pi-coding-agent.extensions.footer-plus.enable = true; } ];
  customized = evaluate [ ../examples/home-manager.nix ];
  relocated = evaluate [
    {
      programs.pi-coding-agent.configDir = "/home/test/.config/pi/agent";
      programs.pi-coding-agent.extensions.footer-plus = {
        enable = true;
        widgets.model = {
          row = 3;
          group = "left";
          position = 0;
        };
        widgets.provider.enable = false;
      };
    }
  ];
  sessionOnly = evaluate [ { programs.pi-coding-agent.extensions.session-manager.enable = true; } ];
  legacy = evaluate [
    {
      programs.pi-coding-agent.extensions.status-lines = {
        enable = true;
        showReset = true;
      };
    }
  ];
  assertions = [
    (!(disabled.home.file ? "${agentDir}/extensions/footer-plus/index.ts"))
    (!(disabled.home.file ? "${agentDir}/extensions/session-manager/index.ts"))
    (enabled.home.file ? "${agentDir}/footer.json")
    (
      builtins.length (builtins.attrNames enabled.programs.pi-coding-agent.extensions.footer-plus.widgets)
      == 11
    )
    (relocated.home.sessionVariables.PI_CODING_AGENT_DIR == "/home/test/.config/pi/agent")
    (relocated.home.file ? "/home/test/.config/pi/agent/extensions/footer-plus/index.ts")
    (!enabled.programs.pi-coding-agent.enable)
    (!(enabled.home.file ? "${agentDir}/settings.json"))
    (!(enabled.home.file ? "${agentDir}/footer-overrides.json"))
    (sessionOnly.home.file ? "${agentDir}/extensions/session-manager/index.ts")
    (!(sessionOnly.home.file ? "${agentDir}/footer.json"))
    (legacy.home.file ? "${agentDir}/extensions/footer-plus/index.ts")
    (lib.hasInfix "session-manager.ts"
      sessionOnly.home.file."${agentDir}/extensions/session-manager/index.ts".text
    )
  ];
in
assert lib.assertMsg (builtins.all (
  value: value
) assertions) "Pi Home Manager boundary assertions failed";
pkgs.runCommand "pi-home-manager-check" { nativeBuildInputs = [ pkgs.nodejs_24 ]; } ''
  node --experimental-strip-types --input-type=module - <<'JS'
  import assert from "node:assert/strict";
  import { loadConfig } from "${footer-plus}/src/lib/config.ts";
  const normal = await loadConfig("${enabled.home.file."${agentDir}/footer.json".source}");
  assert.deepEqual(normal, await loadConfig("${footer-plus}/footer.json"));
  const custom = await loadConfig("${customized.home.file."${agentDir}/footer.json".source}");
  assert.equal(custom.separator, " :: ");
  const widgets = custom.lines.flatMap(line => [...line.left, ...line.center, ...line.right]);
  assert.equal(widgets.find(spec => spec.widget === "codex-weekly").settings.showReset, true);
  const moved = await loadConfig("${
    relocated.home.file."/home/test/.config/pi/agent/footer.json".source
  }");
  assert.equal(moved.lines[3].left[0].widget, "model");
  assert.equal(moved.lines[1].left.find(spec => spec.widget === "provider").enabled, false);
  assert.equal(moved.lines[1].right.find(spec => spec.widget === "context").enabled, true);
  const legacy = await loadConfig("${legacy.home.file."${agentDir}/footer.json".source}");
  assert.equal(legacy.lines[1].right.find(spec => spec.widget === "codex-weekly").settings.showReset, true);
  console.log("13 Home Manager boundary assertions and 7 JSON assertions passed");
  JS
  touch "$out"
''
