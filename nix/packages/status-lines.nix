{
  lib,
  buildNpmPackage,
  nodejs_24,
  git,
}:
let
  source = ../../status-lines;
  manifest = builtins.fromJSON (builtins.readFile (source + /package.json));
in
buildNpmPackage {
  pname = manifest.name;
  inherit (manifest) version;
  src = lib.fileset.toSource {
    root = source;
    fileset = lib.fileset.unions [
      (source + /package.json)
      (source + /package-lock.json)
      (source + /tsconfig.json)
      (source + /status-lines.json)
      (source + /README.md)
      (source + /src)
      (source + /tests)
      (source + /widgets)
    ];
  };

  nodejs = nodejs_24;
  # Pi's published shrinkwrap needs registry metadata during offline installation.
  npmDepsFetcherVersion = 2;
  npmDepsHash = "sha256-vvdYsH+/v8HzHSHNns5JEwCJrArUsKSCh9pTm9LWAgk=";
  npmFlags = [ "--ignore-scripts" ];
  dontNpmBuild = true;
  doCheck = true;
  nativeCheckInputs = [ git ];
  checkPhase = ''
    runHook preCheck
    npm run check
    npm test
    runHook postCheck
  '';

  installPhase = ''
    runHook preInstall
    npm prune --omit=dev --ignore-scripts --no-save
    mkdir -p "$out"
    cp -r src widgets node_modules package.json status-lines.json README.md "$out/"
    runHook postInstall
  '';

  meta = {
    description = manifest.description;
    homepage = "https://github.com/feltfomo/pi-extensions";
    platforms = lib.platforms.linux;
  };
}
