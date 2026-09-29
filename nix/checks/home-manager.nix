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
    import { loadConfig } from "${status-lines}/src/lib/config.ts";
    const fixtures = [
      "${enabled.home.file.${agentDir + "/status-lines.json"}.source}",
      "${customized.home.file.${agentDir + "/status-lines.json"}.source}",
      "${relocated.home.file."/home/test/.config/pi/agent/status-lines.json".source}",
    ];
    for (const path of fixtures) await loadConfig(path);
    console.log("13 Home Manager assertions and 3 generated JSON configurations passed");
    JS
    touch "$out"
  ''
