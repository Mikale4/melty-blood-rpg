#!/bin/sh
# Assemble Melty Blood RPG from the parts in this folder (order matters: later parts use earlier globals).
#   Melty Blood RPG.html  full document
#   dist/index.html       body-only copy for a claude.ai artifact (gitignored)
# The MBAACC sprite packs and menu art in sprites/ (tools/extract.py, tools/art.py) are embedded ahead of the game.
set -e
SRC=$(cd "$(dirname "$0")" && pwd)
OUT=$(dirname "$SRC")
# The parts are listed relative to the project folder (its name has spaces, so $BODY must not hold absolute paths).
cd "$OUT"
mkdir -p dist
BODY="src/a2_core.js src/a3a_roster.js src/a3b_kits.js src/a4_story.js src/a5_art.js src/a5b_sprites.js src/a6_state.js src/a7_engine.js src/a8a_render.js src/a8c_sfx.js src/a8b_battle.js src/a9a_screens.js src/a9b_screens.js src/a9c_meta.js src/a10_boot.js"
{
  printf '<script>window.MBSPR = {};</script>\n'
  for f in sprites/*.js; do
    [ -e "$f" ] || continue
    printf '<script>\n'; cat "$f"; printf '</script>\n'
  done
} > dist/packs.html
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n'
  printf '<meta name="theme-color" content="#08050b">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
  cat src/a1_head.html
  printf '</head>\n<body>\n'
  cat dist/packs.html $BODY
  printf '</body>\n</html>\n'
} > dist/game.html
cat src/a1_head.html dist/packs.html $BODY > dist/index.html
awk '/<script>/{f=1;next}/<\/script>/{f=0}f' $BODY > dist/check.js
node --check dist/check.js && echo "syntax ok"
# Only replace the playable file once the build has passed the syntax check.
mv dist/game.html "Melty Blood RPG.html"
wc -c "Melty Blood RPG.html"
