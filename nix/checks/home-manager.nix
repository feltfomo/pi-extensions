{
  pkgs,
  home-manager,
  status-lines,
}:
let
  inherit (pkgs) lib;
  defaults = builtins.fromJSON (builtins.readFile ../../status-lines/status-lines.json);
  agentDir = "/home/test/.pi/agent";
  wrapperPath = "${agentDir}/extensions/status-lines/index.ts";
  evaluate =
    modules:
    (home-manager.lib.homeManagerConfiguration {
      inherit pkgs;
      modules = [
        ../home-manager/status-lines.nix
        {
          home = {
            username = "test";
            homeDirectory = "/home/test";
            stateVersion = "26.05";
          };
          programs.pi-coding-agent.extensions.status-lines.package = status-lines;
        }
      ]
      ++ modules;
    }).config;
  disabled = evaluate [ ];
  enabled = evaluate [ { programs.pi-coding-agent.extensions.status-lines.enable = true; } ];
  customized = evaluate [ ../examples/home-manager.nix ];
  relocated = evaluate [
    {
      programs.pi-coding-agent.configDir = "/home/test/.config/pi/agent";
      programs.pi-coding-agent.extensions.status-lines = {
        enable = true;
        settings.lines = [ { left = [ { widget = "model"; } ]; } ];
      };
    }
  ];
  resetEnabled = evaluate [
    {
      programs.pi-coding-agent.extensions.status-lines = {
        enable = true;
        showReset = true;
      };
    }
  ];
  resetCustom = evaluate [
    {
      programs.pi-coding-agent.extensions.status-lines = {
        enable = true;
        showReset = true;
        settings.lines = [
          {
            left = [
              {
                widget = "codex-weekly";
                settings = {
                  pollSeconds = 120;
                  showReset = false;
                };
              }
            ];
            center = [ { widget = "codex-weekly"; } ];
            right = [ { widget = "model"; } ];
          }
        ];
      };
    }
  ];
  resetIndividual = evaluate [
    {
      programs.pi-coding-agent.extensions.status-lines = {
        enable = true;
        settings.lines = [
          {
            right = [
              {
                widget = "codex-weekly";
                settings.showReset = true;
              }
            ];
          }
        ];
      };
    }
  ];
  settings = configuration: configuration.programs.pi-coding-agent.extensions.status-lines.settings;
  assertions = [
    (!(disabled.home.file ? "${wrapperPath}"))
    (!(disabled.home.file ? "${agentDir}/status-lines.json"))
    (enabled.home.file ? "${wrapperPath}")
    (settings enabled == defaults)
    ((settings customized).separator == " :: ")
    ((settings customized).lines == defaults.lines)
    (builtins.length (settings relocated).lines == 1)
    (relocated.home.file ? "/home/test/.config/pi/agent/extensions/status-lines/index.ts")
    (relocated.home.sessionVariables.PI_CODING_AGENT_DIR == "/home/test/.config/pi/agent")
    (!enabled.programs.pi-coding-agent.enable)
    (!(enabled.home.file ? "${agentDir}/settings.json"))
    (lib.hasInfix (builtins.unsafeDiscardStringContext "${status-lines}/src/index.ts")
      enabled.home.file.${wrapperPath}.text
    )
    (lib.hasInfix (builtins.unsafeDiscardStringContext "${enabled.home.file.${
      agentDir + "/status-lines.json"
    }.source
    }") enabled.home.file.${wrapperPath}.text)
  ];
in
assert lib.assertMsg (builtins.all (
  value: value
) assertions) "Status Lines Home Manager boundary assertions failed";
pkgs.runCommand "pi-status-lines-home-manager-check"
  {
    nativeBuildInputs = [ pkgs.nodejs_24 ];
  }
  ''
    node --experimental-strip-types --input-type=module - <<'JS'
    import assert from "node:assert/strict";
    import { loadConfig } from "${status-lines}/src/lib/config.ts";
    const fixtures = [
      "${enabled.home.file.${agentDir + "/status-lines.json"}.source}",
      "${customized.home.file.${agentDir + "/status-lines.json"}.source}",
      "${relocated.home.file."/home/test/.config/pi/agent/status-lines.json".source}",
    ];
    for (const path of fixtures) await loadConfig(path);
    const generated = configuration => loadConfig(configuration);
    const reset = await generated("${
      resetEnabled.home.file.${agentDir + "/status-lines.json"}.source
    }");
    assert.equal(reset.lines[1].right[0].settings.showReset, true);
    assert.equal(reset.lines[1].right[0].settings.pollSeconds, 300);
    const custom = await generated("${
      resetCustom.home.file.${agentDir + "/status-lines.json"}.source
    }");
    assert.equal(custom.lines.length, 1);
    assert.deepEqual(custom.lines[0].left[0].settings, { pollSeconds: 120, showReset: true });
    assert.equal(custom.lines[0].center[0].settings.showReset, true);
    assert.deepEqual(custom.lines[0].right[0].settings, {});
    const individual = await generated("${
      resetIndividual.home.file.${agentDir + "/status-lines.json"}.source
    }");
    assert.equal(individual.lines[0].right[0].settings.showReset, true);
    const normal = await generated(fixtures[0]);
    assert.equal(normal.lines[1].right[0].settings.showReset, undefined);
    console.log("13 Home Manager assertions, 8 reset assertions, and 6 generated JSON configurations passed");
    JS
    touch "$out"
  ''
