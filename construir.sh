#!/bin/sh
# Arma sistema-app.js (script clásico) desde app/, compartido/ y modulos/.
# Pasos: 1) node --check a cada .js  2) pruebas de cálculo (pruebas/*.test.mjs)  3) esbuild
#        4) sw.js toma la versión de app/version.js  5) version.json para el aviso de subida incompleta
#        6) paquetes para la app de Terreno: pronóstico (paquete-pronostico/) y conexión (paquete-conexion/)
# Requiere Node 20+ y esbuild (npx lo baja solo).
set -e
cd "$(dirname "$0")"
for f in app/*.js compartido/*.js modulos/*/*.js; do
  cp "$f" /tmp/_chk.mjs && node --check /tmp/_chk.mjs || { echo "Error de sintaxis en $f"; exit 1; }
done
node --test pruebas/*.test.mjs > /tmp/_pruebas.txt 2>&1 || { cat /tmp/_pruebas.txt; echo "Fallaron pruebas: no se arma."; exit 1; }
grep -E "^# (pass|fail)" /tmp/_pruebas.txt
npx --yes esbuild@0.24.0 app/sistema.js --bundle --format=iife --target=es2019 --charset=utf8 \
  --banner:js="/* sistema-app.js — ARCHIVO GENERADO con construir.sh. No editar: los cambios van en app/, compartido/ o modulos/. */" \
  --outfile=sistema-app.js
node --check sistema-app.js
VER=$(node -e "import('./app/version.js').then(m => console.log(m.VERSION_SISTEMA))")
sed -i "s/^const CACHE = .*/const CACHE = 'sistema-v$VER';/" sw.js
node -e "
const fs = require('fs');
const sw = fs.readFileSync('sw.js', 'utf8');
const lista = sw.slice(sw.indexOf('const ARCHIVOS'), sw.indexOf('];', sw.indexOf('const ARCHIVOS')));
const archivos = [...lista.matchAll(/'(\.\/[^']+)'/g)].map(m => m[1]).filter(a => a !== './' && a !== './config.js');
const faltan = archivos.filter(a => !fs.existsSync(a));
if (faltan.length) { console.error('Archivos del caché que no existen:', faltan); process.exit(1); }
fs.writeFileSync('version.json', JSON.stringify({ version: '$VER', armado: new Date().toISOString(), archivos }, null, 1) + '\n');
"
mkdir -p paquete-pronostico
npx --yes esbuild@0.24.0 modulos/vuelos/pronostico-widget.js --bundle --format=iife --global-name=PronosticoVuelo \
  --target=es2019 --charset=utf8 --log-level=warning \
  --banner:js="/* pronostico-vuelo.js — GENERADO desde Sistema Topoland · modulos/vuelos. No editar aquí. */" \
  --outfile=paquete-pronostico/pronostico-vuelo.js
npx --yes esbuild@0.24.0 app/conexion-terreno.js --bundle --format=iife --global-name=TopolandConexion \
  --target=es2019 --charset=utf8 --log-level=warning \
  --banner:js="/* topoland-conexion.js — GENERADO desde Sistema Topoland · app/conexion-terreno.js. No editar aquí. */" \
  --outfile=paquete-conexion/topoland-conexion.js
node --check paquete-conexion/topoland-conexion.js
echo "Listo: sistema-app.js v$VER · version.json · paquete-pronostico/ · paquete-conexion/"
