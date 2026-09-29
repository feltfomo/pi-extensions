{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.programs.pi-coding-agent.extensions.status-lines;
  agentDir = config.programs.pi-coding-agent.configDir;
  json = pkgs.formats.json { };
  defaults = builtins.fromJSON (builtins.readFile ../../status-lines/status-lines.json);
  configFile = json.generate "pi-status-lines.json" cfg.settings;
in
{
  options.programs.pi-coding-agent.extensions.status-lines = {
    enable = lib.mkEnableOption "the Status Lines Pi footer extension";
    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ../packages/status-lines.nix { };
      defaultText = lib.literalExpression "inputs.pi-extensions.packages.${pkgs.stdenv.hostPlatform.system}.status-lines";
      description = "Pi package containing Status Lines and its runtime dependencies.";
    };
    settings = lib.mkOption {
      type = lib.types.submodule {
        freeformType = json.type;
        config = lib.mapAttrs (_: lib.mkDefault) defaults;
      };
      default = { };
      description = ''
        JSON-compatible Status Lines configuration. Defaults come from the
        extension's status-lines.json. Replacing lines replaces the tier list.
        Partial top-level settings retain unspecified defaults. Widget settings
        are validated by the extension, so new widgets need no module changes.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    home.sessionVariables = lib.mkIf (agentDir != "${config.home.homeDirectory}/.pi/agent") {
      PI_CODING_AGENT_DIR = agentDir;
    };
    home.file = {
      "${agentDir}/status-lines.json".source = configFile;
      "${agentDir}/extensions/status-lines/index.ts".text = ''
        import statusLines from ${builtins.toJSON "${cfg.package}/src/index.ts"};
        export default function (pi) {
          statusLines(pi, ${builtins.toJSON "${configFile}"});
        }
      '';
    };
  };
}
