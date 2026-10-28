#!/bin/sh
# Arma equipos-app.js (script clásico) desde compartido/, modulos/equipos/ y envoltorio.js.
# Requiere esbuild:  npx esbuild@0.24.0 ...
cd "$(dirname "$0")"
npx --yes esbuild@0.24.0 envoltorio.js --bundle --format=iife --target=es2019 --charset=utf8 \
  --banner:js="/* equipos-app.js — ARCHIVO GENERADO con construir.sh. No editar: los cambios van en compartido/, modulos/equipos/ o envoltorio.js. */" \
  --outfile=equipos-app.js
