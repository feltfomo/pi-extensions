{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.programs.pi-coding-agent.extensions.session-manager;
  agentDir = config.programs.pi-coding-agent.configDir;
in
{
  options.programs.pi-coding-agent.extensions.session-manager = {
    enable = lib.mkEnableOption "the floating Pi session manager";
    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ../packages/session-manager.nix { };
      description = "Session manager Pi package.";
    };
    shortcut = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = "ctrl+alt+s";
      description = "Panel shortcut in Pi key syntax, or null to disable.";
    };
  };
  config = lib.mkIf cfg.enable {
    home.sessionVariables = lib.mkIf (agentDir != "${config.home.homeDirectory}/.pi/agent") {
      PI_CODING_AGENT_DIR = agentDir;
    };
    home.file."${agentDir}/extensions/session-manager/index.ts".text = ''
      import sessionManager from ${builtins.toJSON "${cfg.package}/src/session-manager.ts"};
      export default function (pi) {
        sessionManager(pi, ${builtins.toJSON cfg.shortcut});
      }
    '';
  };
}
