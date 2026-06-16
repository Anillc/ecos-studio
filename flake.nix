{
  description = "Flake for ECOS Studio";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    parts.url = "github:hercules-ci/flake-parts";
    treefmt-nix.url = "github:numtide/treefmt-nix";
    treefmt-nix.inputs.nixpkgs.follows = "nixpkgs";
    ecc.url = "git+https://github.com/openecos-projects/ecc.git";
  };

  outputs =
    inputs@{
      parts,
      treefmt-nix,
      ecc,
      ...
    }:
    parts.lib.mkFlake { inherit inputs; } {
      imports = [
        treefmt-nix.flakeModule
      ];
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      perSystem =
        {
          inputs',
          pkgs,
          system,
          ...
        }:
        {
          devShells.default = pkgs.mkShell {
            ELECTRON_EXEC_PATH = "${pkgs.electron}/bin/electron";
            nativeBuildInputs = with pkgs; [
              ecc.inputs.infra.packages.${system}.yosysWithSlang
              nodejs
              pnpm
              uv
              nixfmt
              git
            ];
          };
          treefmt = {
            projectRootFile = "flake.nix";
            programs = {
              nixfmt.enable = true;
              nixfmt.package = pkgs.nixfmt;
            };
            flakeCheck = true;
          };
          packages = {
            inherit (pkgs) ecos-studio;
          };
        };
    };
}
