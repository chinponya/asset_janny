{
  inputs.nixpkgs.url = "nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }: {
    devShell.x86_64-linux = let pkgs = nixpkgs.legacyPackages.x86_64-linux;
    in pkgs.mkShell { buildInputs = with pkgs; [ deno ]; };
  };
}
