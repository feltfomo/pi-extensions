{
  lib,
  buildNpmPackage,
  nodejs_24,
  git,
}:
let
  source = ../../footer-plus;
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
      (source + /footer.json)
      (source + /README.md)
      (source + /src)
      (source + /tests)
      (source + /widgets)
    ];
  };

  nodejs = nodejs_24;
  # Pi's published shrinkwrap needs registry metadata during offline installation.
  npmDepsFetcherVersion = 2;
  npmDepsHash = "sha256-+kohsd59WOY1cR7QlD84J2HiZ4sFXBI2DzBLneYhGT4=";
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
    cp -r src widgets node_modules package.json footer.json README.md "$out/"
    runHook postInstall
  '';

  meta = {
    description = manifest.description;
    homepage = "https://github.com/feltfomo/pi-extensions";
    platforms = lib.platforms.linux;
  };
}
