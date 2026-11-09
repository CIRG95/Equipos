# APK de Terreno Topografía (empaquetador 0.1)

Esta carpeta **no contiene la app**: arma el APK de Android a partir de `../terreno` con Capacitor. La app se sigue editando solo en `terreno/`; cada cambio que llega a `main` genera un APK nuevo.

## Cómo se obtiene el APK
1. En GitHub: pestaña **Releases** del repositorio → la versión más reciente «Terreno Topografía vX · APK N» → descargar el `.apk`.
2. En el teléfono: abrir el archivo y permitir «Instalar apps desconocidas» para el navegador o el gestor de archivos.
3. Las versiones siguientes se instalan **encima**, sin borrar los datos (misma firma).

También se puede compilar a mano: pestaña **Actions** → «APK Terreno Topografía» → *Run workflow*.

## Qué hace el empaquetador
- `preparar.sh` copia `terreno/` y `config.js` dentro del APK con la misma estructura que GitHub Pages (`terreno/index.html` lee `../config.js`), genera el proyecto Android, pone permisos de **cámara** y **ubicación**, el ícono y la versión (`APP_VERSION` de `terreno/js/16-sesiones.js`).
- Dentro del APK no se registra el service worker: los archivos ya están en el teléfono y así un APK nuevo no queda mostrando archivos viejos.
- `.github/workflows/apk-terreno.yml` compila, firma y publica en Releases.

## Funciona sin conexión
La app y sus librerías van dentro del APK: abre y guarda datos sin señal desde la primera vez. Lo que necesita internet: mapas de fondo, pronóstico de vuelo y la nube.

## Conocido (para revisar en la v1)
- **Inicio de sesión de Google** (nube propia de Terreno y nube del Sistema): Google no lo permite dentro de la vista web del APK. Se reemplazará por el inicio de sesión nativo de Android (requiere cambio en el paquete de conexión, desde el Sistema).
- **Base local separada del Sistema:** el APK tiene su propio almacenamiento; el Sistema abierto en Chrome del mismo teléfono no lo ve. La conexión con el Sistema es por la nube.
- **Firma:** hoy se usa `prueba.keystore` (llave de prueba, solo para datos ficticios). Para la v1: crear una llave privada y guardarla en *Settings → Secrets and variables → Actions* como `TERRENO_LLAVE_B64` (llave en base64), `TERRENO_LLAVE_CLAVE` y `TERRENO_LLAVE_ALIAS`. Al cambiar la llave hay que desinstalar e instalar una vez (respaldar antes).
- Los enlaces externos (AIP Chile, Windy, etc.) y las descargas de PDF/Excel dentro del APK hay que probarlos.
