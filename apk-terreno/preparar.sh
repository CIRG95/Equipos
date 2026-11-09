#!/usr/bin/env bash
# Arma el proyecto Android de Terreno Topografía con Capacitor.
# No edita la app: copia ../terreno y ../config.js dentro del APK
# (www/terreno/ y www/config.js, igual que en GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")"
RAIZ=..

# 1. Archivos web: misma estructura que el sitio publicado
rm -rf www
mkdir -p www
cp -r "$RAIZ/terreno" www/terreno
cp "$RAIZ/config.js" www/config.js
cat > www/index.html <<'HTML'
<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=terreno/index.html"><title>Terreno Topografía</title>
HTML

# 2. Ajuste solo para el APK: los archivos ya van dentro de la app,
#    así que no se registra el service worker (evita servir archivos viejos tras actualizar el APK).
python3 - <<'PY'
p = "www/terreno/index.html"
s = open(p, encoding="utf-8").read()
shim = ('<script>/* APK: archivos locales, sin service worker */'
        'if(window.Capacitor&&navigator.serviceWorker){navigator.serviceWorker.register=function(){return Promise.resolve();};}</script>')
s = s.replace("<head>", "<head>\n" + shim, 1)
open(p, "w", encoding="utf-8").write(s)
PY

# 3. Versión del APK = versión de la app (APP_VERSION) y número correlativo
VERSION=$(grep -oP 'APP_VERSION\s*=\s*"\K[^"]+' "$RAIZ/terreno/js/16-sesiones.js")
CODIGO=${GITHUB_RUN_NUMBER:-1}
echo "Versión de la app: $VERSION · código $CODIGO"
echo "$VERSION" > www/version-apk.txt

# 4. Proyecto Android
rm -rf android
npx cap add android
npx cap sync android

sed -i "s/versionCode 1/versionCode $CODIGO/; s/versionName \"1.0\"/versionName \"$VERSION\"/" android/app/build.gradle

# Permisos: cámara (fotos de boletas y levantamientos) y ubicación (GPS de puntos)
sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <uses-feature android:name="android.hardware.location.gps" android:required="false" />#' \
  android/app/src/main/AndroidManifest.xml

# Ícono de la app
rm -rf android/app/src/main/res/mipmap-anydpi-v26
for d in iconos/mipmap-*; do cp "$d"/*.png "android/app/src/main/res/$(basename "$d")/"; done

echo "Proyecto Android listo en apk-terreno/android"
