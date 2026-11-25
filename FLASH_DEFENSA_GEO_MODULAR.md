# ⚡ HOJA FLASH DE DEFENSA ORAL: `pwa-geo-modular` (TEMA 6.3: GEOLOCALIZACIÓN MODULAR)

> **Regla de oro:** 100% Vanilla JS · Cero `async/await` (`new Promise`, `.then`, `.catch`, `.finally`) · Módulo reutilizable `geo-helper.js` · Rutas `./` en GitHub Pages.

## 🎤 Pitch de 25 segundos
*"Es una PWA modular de geolocalización consciente en Vanilla JS sin `async/await`. En `geo-helper.js` promisifiqué `getCurrentPosition()` con `new Promise`, traduciendo los errores `1, 2 y 3` y evaluando `coords.accuracy` (`< 30 m` GPS vs Wi-Fi/IP). En `app.js` aplico **Pre-Permiso UX** consultando `Permissions API` sin lecturas automáticas en `DOMContentLoaded` (regla de iOS), reutilizo el módulo en **2 funciones distintas** (reporte preciso y sucursales rápidas) e incluyo un **Plan B manual** para que nunca se bloquee."*

---

## 🔥 POSIBLES PREGUNTAS DE LA PRÁCTICA (CON LÍNEAS EXACTAS)

### Bloque 1 — Módulo `geo-helper.js` y Fundamentos de Geolocation API

1. **¿Por qué construiste `geo-helper.js` con `new Promise()` en vez de usar `navigator.geolocation` directo en `app.js`?**
   - **Respuesta:** Porque `getCurrentPosition(exito, error, opciones)` usa **callbacks antiguos** (previos a ES6). Al envolverlo en `new Promise` (`geo-helper.js` **L88–L122**), evito repetir callbacks anidados y lo reutilizo con `.then()/.catch()/.finally()` desde múltiples módulos de `app.js`.

2. **¿Diferencia entre `getCurrentPosition()` y `watchPosition()`, y cuál usaste?**
   - **Respuesta:** Usé **`getCurrentPosition()`** (`geo-helper.js` **L105**) porque hace **una lectura puntual** al etiquetar un reporte o buscar sucursales sin drenar la batería. `watchPosition()` abre un rastreo continuo de alto consumo energético que exige cerrarse con `clearWatch(watchId)`.

3. **¿Cómo traduces los errores nativos y qué significa cada código (`1, 2, 3`)?**
   - **Respuesta:** En `traducirErrorGeolocalizacion()` (`geo-helper.js` **L25–L36**): código **`1` (`PERMISSION_DENIED`)** = usuario bloqueó permiso; **`2` (`POSITION_UNAVAILABLE`)** = sin señal GPS/Wi-Fi; **`3` (`TIMEOUT`)** = se agotó el tiempo `timeout` sin fijar coordenada.

4. **¿Qué es `coords.accuracy` y cómo clasifica tu PWA la calidad de la señal?**
   - **Respuesta:** `coords.accuracy` (`geo-helper.js` **L110**) es el margen de error en metros (95% de confianza). En `evaluarCalidadSenal()` (**L45–L59**), si es **`< 30 m`** muestra *"Precisión GPS Alta"* (satélite GNSS), y si es **`>= 30 m`** muestra *"Ubicación Aproximada (Wi-Fi / IP)"* (renderizado en `app.js` **L194–L227**).

5. **¿Para qué sirven los 3 parámetros `enableHighAccuracy`, `timeout` y `maximumAge`?**
   - **Respuesta:** En `geo-helper.js` (**L89–L96**): `enableHighAccuracy: true` pide chip GPS satelital; `timeout: 8000` corta la espera a los 8 s lanzando código `3` para no colgar la app; `maximumAge: 30000` acepta una coordenada cacheada de hasta 30 s sin re-encender el sensor.

---

### Bloque 2 — Diferencias de Hardware (Laptops sin GPS vs Android vs iOS)

6. **La Trampa de `enableHighAccuracy: true` en Laptops / PCs por cable Ethernet:**
   - **Respuesta:** Una PC sin chip GPS triangulará por Wi-Fi o IP (margen de 30 m a 10,000 m, y `altitude/speed` dan `null`). Poner `enableHighAccuracy: true` en PC no inventa GPS; solo hace tardar al SO y suele fallar con **`TIMEOUT` (código 3)**. Por eso incluí `#chk-modo-laptop` (`index.html` **L71**, `app.js` **L259–L276**) y `#btn-reintentar-baja-precision` (`app.js` **L707–L719**) que pasan `enableHighAccuracy: false`.

7. **¿Por qué NUNCA llamas a `obtenerUbicacionActual()` dentro de `DOMContentLoaded`? (Regla de iOS):**
   - **Respuesta:** Por dos razones: 1) En **iPhone/Safari**, pedir ubicación sin nacer de un **gesto directo (`click`)** del usuario suele ser bloqueado o ignorado silenciosamente; y 2) violaría el Pre-Permiso ético quemando el diálogo nativo. En `DOMContentLoaded` (`app.js` **L617**) solo conecto listeners.

8. **¿Qué pasa con los permisos en iOS entre Safari y la PWA instalada (y la opción "Permitir una vez")?**
   - **Respuesta:** En iOS, Safari y la PWA instalada en inicio (`standalone`) tienen **almacenes de permisos separados**, e iOS ofrece *"Permitir una vez"* (vuelve a estar en `'prompt'` en la siguiente sesión), por lo que consultar el estado antes de cada uso es indispensable (`index.html` **L38–L44**, `app.js` **L97**).

---

### Bloque 3 — Pre-Permiso con `Permissions API`, Plan B y Reutilización Modular

9. **¿Cómo funciona el flujo de 3 caminos al pulsar "Adjuntar mi ubicación"?**
   - **Respuesta:** En `iniciarFlujoConscienteUbicacion()` (`app.js` **L339–L374**) llamo a `consultarEstadoPermisoGeo()` (`geo-helper.js` **L68–L76**):
     - Si es **`'granted'`**: lee directo `obtenerUbicacionActual()` (**L348**).
     - Si es **`'prompt'`**: muestra primero `#tarjeta-prepermiso` (`index.html` **L62**, `app.js` **L366**).
     - Si es **`'denied'`**: abre directo el **Plan B manual** y la guía para reactivar el permiso (**L356–L362**).

10. **¿Por qué `consultarEstadoPermisoGeo()` revisa `if (!('permissions' in navigator))` y tiene `.catch(() => 'prompt')`?**
    - **Respuesta:** En `geo-helper.js` (**L69–L75**), por programación defensiva: navegadores antiguos o WebViews restringidos pueden no soportar `Permissions API`, devolviendo `'prompt'` por seguridad para mostrar la tarjeta ética sin romper la app.

11. **¿Qué es el Plan B obligatorio y cuándo se activa en tu código?**
    - **Respuesta:** `habilitarSelectorManualZona()` (`app.js` **L234–L252**, `#seccion-plan-b` en `index.html` **L125**). Se activa si el permiso está `'denied'`, si ocurre error `1, 2 o 3` en `.catch()` (`app.js` **L313–L326**), o si el usuario pulsa `#btn-elegir-manual` (**L672**), permitiendo elegir sede manualmente sin bloquear jamás el trabajo.

12. **Demuéstrame dónde reutilizas `geo-helper.js` en dos funciones distintas de `app.js`:**
    - **Respuesta:**
      1) **Consumidor 1 (`ejecutarLecturaParaAdjuntar` y `enviarReporteConUbicacion`, `app.js` L292 y L481):** Pide **alta precisión** (`enableHighAccuracy: true, timeout: 7000`) para etiquetar incidencias.
      2) **Consumidor 2 (`buscarSucursalesCercanas`, `app.js` L563–L566):** Pide **lectura rápida de baja precisión** (`enableHighAccuracy: false, maximumAge: 60000`) y ordena sedes con fórmula Haversine (`calcularDistanciaKm`, **L507**).

13. **¿Por qué importa el orden de `<script>` en `index.html` e incluir `./geo-helper.js` en `sw.js`?**
    - **Respuesta:** En `index.html` (**L248–L249**), `./geo-helper.js` debe cargarse **antes** que `./app.js` para disponibilizar sus funciones en `window`. Y en `sw.js` (**L19**), incluir `./geo-helper.js` con ruta `./` dentro de `ARCHIVOS_APP_SHELL` garantiza que el módulo funcione offline en GitHub Pages.
