#!/bin/sh
# Arma sistema-app.js (script clásico) desde app/, compartido/ y modulos/, y valida cada .js con node --check.
# Requiere Node y esbuild (npx lo baja solo).
set -e
cd "$(dirname "$0")"
for f in app/*.js compartido/*.js modulos/*/*.js; do
  cp "$f" /tmp/_chk.mjs && node --check /tmp/_chk.mjs || { echo "Error de sintaxis en $f"; exit 1; }
done
npx --yes esbuild@0.24.0 app/sistema.js --bundle --format=iife --target=es2019 --charset=utf8 \
  --banner:js="/* sistema-app.js — ARCHIVO GENERADO con construir.sh. No editar: los cambios van en app/, compartido/ o modulos/. */" \
  --outfile=sistema-app.js
node --check sistema-app.js
echo "Listo: sistema-app.js"
