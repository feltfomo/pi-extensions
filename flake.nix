{
  description = "Personal Pi extensions with per-extension packages and Home Manager modules";

  inputs = {
    nixpkgs.url = "https://channels.nixos.org/nixos-unstable/nixexprs.tar.zst";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      home-manager,
    }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forSystems = nixpkgs.lib.genAttrs systems;
      pkgsFor = system: import nixpkgs { inherit system; };
    in
    {
      packages = forSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          status-lines = pkgs.callPackage ./nix/packages/status-lines.nix { };
          default = self.packages.${system}.status-lines;
        }
      );

      homeManagerModules = {
        status-lines = ./nix/home-manager/status-lines.nix;
        default = self.homeManagerModules.status-lines;
      };

      checks = forSystems (
        system:
        let
          pkgs = pkgsFor system;
          status-lines = self.packages.${system}.status-lines;
        in
        {
          inherit status-lines;
          home-manager-status-lines = import ./nix/checks/home-manager.nix {
            inherit pkgs home-manager status-lines;
          };
        }
      );

      formatter = forSystems (system: (pkgsFor system).nixfmt);

      devShells = forSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_24
              git
              python3
              nixfmt
              prefetch-npm-deps
            ];
          };
        }
      );
    };
}
