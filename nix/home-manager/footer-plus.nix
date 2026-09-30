{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.programs.pi-coding-agent.extensions.footer-plus;
  agentDir = config.programs.pi-coding-agent.configDir;
  json = pkgs.formats.json { };
  defaults = builtins.fromJSON (builtins.readFile ../../footer-plus/footer.json);
  sides = [
    "left"
    "center"
    "right"
  ];
  catalog = builtins.listToAttrs (
    lib.concatLists (
      lib.imap0 (
        row: line:
        lib.concatMap (
          group:
          lib.imap0 (position: spec: {
            name = spec.widget;
            value = {
              enable = spec.enabled or true;
              inherit row group position;
              priority = spec.priority or 50;
              settings = spec.settings or { };
            };
          }) line.${group}
        ) sides
      ) defaults.lines
    )
  );
  widgetType = lib.types.submodule (
    { name, ... }: {
      options = {
        enable = lib.mkOption {
          type = lib.types.bool;
          default = catalog.${name}.enable or false;
          description = "Enable this footer widget.";
        };
        row = lib.mkOption {
          type = lib.types.ints.between 0 9;
          default = catalog.${name}.row or 0;
          description = "Zero-based footer row.";
        };
        group = lib.mkOption {
          type = lib.types.enum sides;
          default = catalog.${name}.group or "left";
          description = "Alignment group.";
        };
        position = lib.mkOption {
          type = lib.types.ints.unsigned;
          default = catalog.${name}.position or 0;
          description = "Order within the group. Ties sort by widget name.";
        };
        priority = lib.mkOption {
          type = lib.types.int;
          default = catalog.${name}.priority or 50;
          description = "Higher priorities survive narrow terminals.";
        };
        settings = lib.mkOption {
          type = json.type;
          default = catalog.${name}.settings or { };
          description = "Widget-specific settings.";
        };
      };
    }
  );
  entries = lib.mapAttrsToList (name: value: value // { widget = name; }) cfg.widgets;
  lastRow = lib.foldl' (row: spec: lib.max row spec.row) 0 entries;
  generated = lib.genList (
    row:
    builtins.listToAttrs (
      map (group: {
        name = group;
        value =
          map
            (spec: {
              inherit (spec) widget priority settings;
              enabled = spec.enable;
            })
            (
              lib.sort (a: b: if a.position == b.position then a.widget < b.widget else a.position < b.position) (
                builtins.filter (spec: spec.row == row && spec.group == group) entries
              )
            );
      }) sides
    )
  ) (lastRow + 1);
  lines = map (
    line:
    lib.mapAttrs (
      _: specs:
      map (
        spec:
        spec
        // lib.optionalAttrs (cfg.showReset && spec.widget == "codex-weekly") {
          settings = (spec.settings or { }) // {
            showReset = true;
          };
        }
      ) specs
    ) line
  ) (cfg.settings.lines or generated);
  configFile = json.generate "pi-footer.json" (
    { separator = defaults.separator; } // cfg.settings // { inherit lines; }
  );
in
{
  imports = [
    (lib.mkRenamedOptionModule
      [ "programs" "pi-coding-agent" "extensions" "status-lines" ]
      [ "programs" "pi-coding-agent" "extensions" "footer-plus" ]
    )
  ];
  options.programs.pi-coding-agent.extensions.footer-plus = {
    enable = lib.mkEnableOption "footer++, the configurable Pi footer";
    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ../packages/footer-plus.nix { };
      description = "Checked footer++ source package.";
    };
    shortcut = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = "ctrl+alt+f";
      description = "Panel shortcut in Pi key syntax, or null to disable.";
    };
    showReset = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Show the local reset timestamp for every Codex weekly widget.";
    };
    widgets = lib.mkOption {
      type = lib.types.attrsOf widgetType;
      default = lib.mapAttrs (_: _: { }) catalog;
      description = "Bundled and custom widget enable switches, positions, and settings. Default positions come from footer.json.";
    };
    settings = lib.mkOption {
      type = json.type;
      default = { };
      description = "Raw JSON settings. separator changes the separator; lines replaces the generated layout, bypassing widgets options.";
    };
  };
  config = lib.mkIf cfg.enable {
    programs.pi-coding-agent.extensions.footer-plus.widgets = lib.mapAttrs (
      _: _: lib.mkDefault { }
    ) catalog;
    home.sessionVariables = lib.mkIf (agentDir != "${config.home.homeDirectory}/.pi/agent") {
      PI_CODING_AGENT_DIR = agentDir;
    };
    home.file = {
      "${agentDir}/footer.json".source = configFile;
      "${agentDir}/extensions/footer-plus/index.ts".text = ''
        import footerPlus from ${builtins.toJSON "${cfg.package}/src/index.ts"};
        export default function (pi) {
          footerPlus(pi, ${builtins.toJSON "${configFile}"}, ${builtins.toJSON cfg.shortcut});
        }
      '';
    };
  };
}
