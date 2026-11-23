# pwa-geo-modular

Práctica **Tema 6.3: Geolocalización Consciente y Modular (`geo-helper.js`)**.

- **Alumno:** Antonio García González
- **Asignatura:** Desarrollo de Aplicaciones Web Progresivas (PWA)

## Arquitectura y Cumplimiento Técnico

1. **100% JavaScript Vanilla y Promesas puras:** Sin librerías externas y sin `async`/`await`. Toda la asincronía se encapsula con `new Promise()` y se consume mediante `.then()`, `.catch()` y `.finally()`.
2. **Módulo reutilizable (`./geo-helper.js`):**
   - `obtenerUbicacionActual(opcionesPersonalizadas)`: promisifica `navigator.geolocation.getCurrentPosition()` y normaliza `{ latitud, longitud, precisionMetros, timestamp }`.
   - `consultarEstadoPermisoGeo()`: consulta defensivamente `navigator.permissions.query({ name: 'geolocation' })` devolviendo `'granted'`, `'denied'` o `'prompt'`.
   - `traducirErrorGeolocalizacion(error)`: traduce los códigos nativos `1` (`PERMISSION_DENIED`), `2` (`POSITION_UNAVAILABLE`) y `3` (`TIMEOUT`).
   - `evaluarCalidadSenal(precisionMetros)`: clasifica `< 30` m como **Precisión GPS Alta** y `>= 30` m como **Ubicación Aproximada (Wi-Fi / IP)**.
3. **Pre-Permiso Ético y Plan B Obligatorio (`./app.js`):**
   - Ninguna llamada a `navigator.geolocation` ocurre al cargar el DOM (compatible con la regla de gesto directo de Safari/iOS).
   - Tarjeta informativa previa cuando el estado es `'prompt'`, lectura directa cuando es `'granted'` y selector manual de zona + guía de reactivación cuando es `'denied'` o ocurre `TIMEOUT`.
   - Reutilización modular demostrada en dos flujos independientes: **Reporte Técnico en Campo** (alta precisión) y **Cálculo de Sucursales Cercanas** (baja precisión y caché).
4. **Offline e Instalabilidad (`./sw.js` y `./manifest.json`):**
   - `./geo-helper.js` incluido dentro de `ARCHIVOS_APP_SHELL` con rutas relativas `./` para despliegue seguro bajo HTTPS en **GitHub Pages**.
