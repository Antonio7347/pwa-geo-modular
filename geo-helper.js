// ==========================================================================
// geo-helper.js - Módulo reutilizable de Geolocalización en Vanilla JS
// Tema 6.3: APIs de Sensores, Promisificación Modular y Diagnóstico de Señal
// Alumno: Antonio García González
// ==========================================================================
// REGLA DEL CURSO: 100% JavaScript Vanilla y CERO async/await.
// Toda la asincronía se encapsula con new Promise() y se consume con .then() y .catch().
//
// PROPÓSITO ARQUITECTÓNICO:
//   La API nativa navigator.geolocation fue diseñada antes de ES6 y opera mediante
//   callbacks tradicionales (successCallback, errorCallback). Encapsularla aquí en
//   funciones puras basadas en Promesas evita repetir callbacks anidados y permite
//   que múltiples módulos de app.js (reportes técnicos, filtro de sucursales, etc.)
//   la reutilicen con distintas configuraciones de precisión y caché.
// ==========================================================================

/**
 * 1. TRADUCCIÓN DE CÓDIGOS DE ERROR NATIVOS (GeolocationPositionError)
 * - Código 1 (PERMISSION_DENIED): El usuario rechazó el permiso o está bloqueado a nivel navegador/SO
 *   (una vez bloqueado, JavaScript no puede volver a invocar el cuadro nativo).
 * - Código 2 (POSITION_UNAVAILABLE): Fallo de hardware satelital o sin redes Wi-Fi/celulares visibles.
 * - Código 3 (TIMEOUT): Se agotó el límite en milisegundos (timeout) antes de fijar coordenadas
 *   (frecuente en laptops por Ethernet cuando se fuerza enableHighAccuracy: true sin chip GPS).
 */
function traducirErrorGeolocalizacion(error) {
  switch (error.code) {
    case 1: // error.PERMISSION_DENIED
      return 'Permiso de ubicación denegado. Puedes ingresar tu zona manualmente.';
    case 2: // error.POSITION_UNAVAILABLE
      return 'No fue posible determinar tu ubicación (señal GPS o Wi-Fi no disponible).';
    case 3: // error.TIMEOUT
      return 'Se agotó el tiempo de espera intentando obtener las coordenadas.';
    default:
      return 'Ocurrió un error inesperado al consultar la ubicación.';
  }
}

/**
 * 2. DIAGNÓSTICO DE CALIDAD DE SEÑAL SEGÚN MARGEN DE ERROR (coords.accuracy)
 * - `accuracy` representa el radio de confianza del 95% expresado en metros:
 *   - Menor a 30 m: lectura obtenida por chip GNSS/GPS satelital (típico en smartphones en exterior).
 *   - 30 m o mayor: triangulación por redes Wi-Fi (MAC/BSSID), torres celulares o dirección IP
 *     (típico en interiores o computadoras de escritorio/laptops sin GPS, donde altitude y speed son null).
 */
function evaluarCalidadSenal(precisionMetros) {
  if (precisionMetros < 30) {
    return {
      etiqueta: 'Precisión GPS Alta',
      nivel: 'alta',
      detalle: 'Señal satelital GNSS/GPS óptima (menor a 30 metros).'
    };
  }

  return {
    etiqueta: 'Ubicación Aproximada (Wi-Fi / IP)',
    nivel: 'aproximada',
    detalle: 'Triangulación por red Wi-Fi, antenas celulares o dirección IP (30 m o mayor).'
  };
}

/**
 * 3. INSPECCIÓN PREVENTIVA DEL ESTADO DEL PERMISO (Permissions API)
 * - Devuelve una Promesa con 'granted' (concedido), 'denied' (bloqueado) o 'prompt' (sin decidir,
 *   o tras elegir "Permitir una vez" en iOS en una sesión previa).
 * - Incluye comprobación defensiva ('permissions' in navigator) y fallback a 'prompt' en .catch()
 *   para no romper la ejecución en navegadores o WebViews que restringen esta API.
 */
function consultarEstadoPermisoGeo() {
  if (!('permissions' in navigator)) {
    return Promise.resolve('prompt');
  }

  return navigator.permissions.query({ name: 'geolocation' })
    .then((resultado) => resultado.state) // 'granted', 'denied' o 'prompt'
    .catch(() => 'prompt');
}

/**
 * 4. LECTURA PUNTUAL PROMISIFICADA DE COORDENADAS (getCurrentPosition)
 * - Se utiliza `getCurrentPosition()` en lugar de `watchPosition()` porque solo requerimos fijar
 *   una coordenada puntual bajo demanda sin dejar encendido el chip GPS drenando batería
 *   (watchPosition abre un canal continuo que obligaría a limpiarse con clearWatch(watchId)).
 * - Parámetros PositionOptions combinados vía Object.assign():
 *   - enableHighAccuracy: true solicita GPS satelital; false prioriza respuesta rápida por Wi-Fi/red.
 *   - timeout: tiempo máximo de espera (ms) antes de rechazar con código 3 (TIMEOUT).
 *   - maximumAge: antigüedad máxima (ms) aceptada de una lectura en caché del SO (0 fuerza lectura fresca).
 */
function obtenerUbicacionActual(opcionesPersonalizadas) {
  const opciones = Object.assign(
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000 // Reutiliza una lectura reciente de hasta 30 s para ahorrar batería
    },
    opcionesPersonalizadas
  );

  return new Promise((resolve, reject) => {
    // Feature Detection defensiva (además, geolocation requiere Contexto Seguro HTTPS o localhost)
    if (!('geolocation' in navigator)) {
      reject(new Error('Este navegador no soporta la API de Geolocalización.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        // Normaliza GeolocationPosition entregando una estructura limpia a cualquier módulo consumidor
        resolve({
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
          precisionMetros: Math.round(posicion.coords.accuracy),
          timestamp: posicion.timestamp
        });
      },
      (error) => {
        const errorTraducido = new Error(traducirErrorGeolocalizacion(error));
        errorTraducido.codigo = error.code;
        reject(errorTraducido);
      },
      opciones
    );
  });
}
