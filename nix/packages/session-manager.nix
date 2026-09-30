{
  runCommand,
  callPackage,
  footer-plus ? callPackage ./footer-plus.nix { },
}:
runCommand "pi-session-manager-${footer-plus.version}" { } ''
  mkdir -p "$out"
  ln -s ${footer-plus}/src "$out/src"
  ln -s ${footer-plus}/node_modules "$out/node_modules"
  echo '{"name":"pi-session-manager","version":"${footer-plus.version}","type":"module","pi":{"extensions":["./src/session-manager.ts"]}}' > "$out/package.json"
''
