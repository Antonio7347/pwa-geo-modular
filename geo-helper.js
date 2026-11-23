// ==========================================================================
// geo-helper.js - Modulo reutilizable de geolocalizacion en Vanilla JS
// Alumno: Antonio Garcia Gonzalez
// ==========================================================================
// REGLA TECNICA: 100% JavaScript Vanilla y uso exclusivo de new Promise(),
// .then() y .catch() sin librerias externas.
// ==========================================================================

/**
 * Traduce los codigos numericos nativos de GeolocationPositionError (1, 2, 3)
 * a mensajes claros para la interfaz de usuario.
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
 * Evalua el margen de error en metros (coords.accuracy) para distinguir
 * entre senal satelital GPS de alta precision (< 30 m) y ubicacion aproximada
 * obtenida por triangulacion Wi-Fi o direccion IP (>= 30 m).
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
 * Consulta de forma preventiva la Permissions API para conocer si el usuario
 * ya otorgo ('granted'), bloqueo ('denied') o aun no decide ('prompt') el permiso.
 * Incluye respaldo defensivo para navegadores que restringen navigator.permissions.
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
 * Encapsula navigator.geolocation.getCurrentPosition() dentro de una Promesa
 * reutilizable y normaliza el objeto de coordenadas devuelto.
 */
function obtenerUbicacionActual(opcionesPersonalizadas) {
  const opciones = Object.assign(
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000 // Acepta una lectura reciente de hasta 30 segundos
    },
    opcionesPersonalizadas
  );

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Este navegador no soporta la API de Geolocalización.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
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
