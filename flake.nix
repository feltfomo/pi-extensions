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
          footer-plus = pkgs.callPackage ./nix/packages/footer-plus.nix { };
          session-manager = pkgs.callPackage ./nix/packages/session-manager.nix {
            inherit (self.packages.${system}) footer-plus;
          };
          status-lines = self.packages.${system}.footer-plus;
          default = self.packages.${system}.footer-plus;
        }
      );

      homeManagerModules = {
        footer-plus = ./nix/home-manager/footer-plus.nix;
        session-manager = ./nix/home-manager/session-manager.nix;
        status-lines = self.homeManagerModules.footer-plus;
        default = {
          imports = [
            self.homeManagerModules.footer-plus
            self.homeManagerModules.session-manager
          ];
        };
      };

      checks = forSystems (
        system:
        let
          pkgs = pkgsFor system;
          inherit (self.packages.${system}) footer-plus session-manager;
        in
        {
          inherit footer-plus session-manager;
          home-manager = import ./nix/checks/home-manager.nix {
            inherit
              pkgs
              home-manager
              footer-plus
              session-manager
              ;
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
