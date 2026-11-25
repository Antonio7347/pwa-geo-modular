// ==========================================================================
// app.js - Lógica de UI, Pre-Permiso Ético, Plan B y Consumo de geo-helper.js
// Tema 6.3: Geolocalización Consciente, Multiplataforma y Reutilizable
// Alumno: Antonio García González
// ==========================================================================
// REGLA DEL CURSO: 100% JavaScript Vanilla sin librerías externas y CERO async/await.
// Toda operación asíncrona se consume con .then(), .catch() y .finally().
//
// FLUJO GENERAL DE DECISIÓN ("QUÉ LLEVA A QUÉ"):
//   [Clic del usuario en "Adjuntar mi ubicación" o "Calcular Sucursal"]
//          │  (Jamás en DOMContentLoaded: iOS bloquea lecturas sin gesto directo)
//          ▼
//   iniciarFlujoConscienteUbicacion() ──► consultarEstadoPermisoGeo() (geo-helper.js)
//          │
//          ├── 'granted' ──► obtenerUbicacionActual() directo (Consumidor 1 alta precisión | Consumidor 2 baja precisión)
//          ├── 'prompt'  ──► muestra #tarjeta-prepermiso ──► botón confirmar dispara obtenerUbicacionActual()
//          └── 'denied'  ──► habilitarSelectorManualZona() (Plan B sin bloquear al usuario)
// ==========================================================================

let eventoInstalacionDiferido = null;
let ubicacionAdjuntaActual = null;
let zonaManualActual = null;
let accionPendienteTrasPermiso = 'adjuntar'; // 'adjuntar' | 'sucursales'
const reportesGuardados = [];

// Catálogo local de sedes operativas para el segundo consumidor modular (cálculo de distancia)
const SUCURSALES_SOPORTE = [
  {
    nombre: 'Centro Técnico Emiliano Zapata (UTEZ)',
    zona: 'Zona Centro - Emiliano Zapata (Campus UTEZ)',
    latitud: 18.8503,
    longitud: -99.2007
  },
  {
    nombre: 'Base Operativa Cuernavaca Norte',
    zona: 'Zona Norte - Cuernavaca',
    latitud: 18.9516,
    longitud: -99.2342
  },
  {
    nombre: 'Nodo Regional Cuautla Oriente',
    zona: 'Zona Oriente - Cuautla',
    latitud: 18.8126,
    longitud: -98.9554
  },
  {
    nombre: 'Unidad de Campo Jojutla Sur',
    zona: 'Zona Sur - Jojutla',
    latitud: 18.6148,
    longitud: -99.1803
  },
  {
    nombre: 'Hub Metropolitano CDMX Sur',
    zona: 'Zona Metropolitana - CDMX',
    latitud: 19.2965,
    longitud: -99.1678
  }
];

// --------------------------------------------------------------------------
// 1. REGISTRO DEL SERVICE WORKER (Ruta relativa './' para GitHub Pages)
// --------------------------------------------------------------------------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then((registro) => {
      console.log('[PWA] Service Worker registrado en scope:', registro.scope);
    })
    .catch((error) => {
      console.error('[PWA] Error al registrar Service Worker:', error);
    });
}

// --------------------------------------------------------------------------
// 2. INSTALABILIDAD NATIVA Y DETECCIÓN DE ENTORNO iOS / WEBKIT
// --------------------------------------------------------------------------
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  eventoInstalacionDiferido = event;

  const btnInstalar = document.getElementById('btn-instalar');
  if (btnInstalar) {
    btnInstalar.hidden = false;
  }
});

window.addEventListener('appinstalled', () => {
  const btnInstalar = document.getElementById('btn-instalar');
  if (btnInstalar) {
    btnInstalar.hidden = true;
  }
  eventoInstalacionDiferido = null;
  mostrarMensajeEstado('PWA instalada correctamente en la pantalla de inicio.', 'activo');
});

// En iOS/WebKit no existe beforeinstallprompt y los permisos entre Safari y la PWA
// instalada en pantalla de inicio (standalone) se almacenan de forma aislada.
function verificarNotaIOS() {
  const esDispositivoIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const estaEnStandalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (esDispositivoIOS && !estaEnStandalone) {
    const tarjetaIOS = document.getElementById('instrucciones-ios');
    if (tarjetaIOS) {
      tarjetaIOS.hidden = false;
    }
  }
}

// --------------------------------------------------------------------------
// 3. UTILIDADES VISUALES DE ESTADO, PERMISO Y DIAGNÓSTICO DE PRECISIÓN
// --------------------------------------------------------------------------
function mostrarMensajeEstado(texto, tipo) {
  const elemento = document.getElementById('mensaje-estado');
  if (!elemento) return;

  elemento.textContent = texto;
  elemento.className = 'mensaje-estado';
  if (tipo) {
    elemento.classList.add(tipo);
  }
}

function mostrarCargando(texto) {
  mostrarMensajeEstado(texto, 'cargando');
}

function mostrarMensajeError(texto) {
  mostrarMensajeEstado(texto, 'error');
}

function actualizarBadgePermiso(estado) {
  const badge = document.getElementById('badge-permiso');
  if (!badge) return;

  badge.className = 'badge';
  if (estado === 'granted') {
    badge.textContent = 'Permiso: concedido (granted)';
    badge.classList.add('badge-alta');
  } else if (estado === 'denied') {
    badge.textContent = 'Permiso: bloqueado (denied)';
    badge.classList.add('badge-denegado');
  } else {
    badge.textContent = 'Permiso: requiere confirmación (prompt)';
    badge.classList.add('badge-aviso');
  }
}

function formatearHora(timestamp) {
  return new Date(timestamp).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function actualizarResumenAdjunto() {
  const resumen = document.getElementById('resumen-adjunto');
  if (!resumen) return;

  if (ubicacionAdjuntaActual) {
    const diagnostico = evaluarCalidadSenal(ubicacionAdjuntaActual.precisionMetros);
    resumen.innerHTML = '';
    const etiqueta = document.createElement('span');
    etiqueta.textContent = 'Ubicación adjunta (GPS/Red): ';
    const fuerte = document.createElement('strong');
    fuerte.textContent = `${ubicacionAdjuntaActual.latitud.toFixed(5)}, ${ubicacionAdjuntaActual.longitud.toFixed(5)} (±${ubicacionAdjuntaActual.precisionMetros} m • ${diagnostico.etiqueta})`;
    resumen.appendChild(etiqueta);
    resumen.appendChild(fuerte);
    return;
  }

  if (zonaManualActual) {
    resumen.innerHTML = '';
    const etiqueta = document.createElement('span');
    etiqueta.textContent = 'Ubicación adjunta (Plan B Manual): ';
    const fuerte = document.createElement('strong');
    fuerte.textContent = zonaManualActual.referencia
      ? `${zonaManualActual.zona} — ${zonaManualActual.referencia}`
      : zonaManualActual.zona;
    resumen.appendChild(etiqueta);
    resumen.appendChild(fuerte);
    return;
  }

  resumen.textContent = 'Ubicación adjunta: Ninguna todavía (pulsa "Adjuntar mi ubicación" o selecciona zona manual).';
}

/**
 * Muestra en interfaz el margen de error `precisionMetros` (coords.accuracy) y clasifica
 * visualmente "Precisión GPS Alta" (< 30 m) vs "Ubicación Aproximada (Wi-Fi / IP)" (>= 30 m).
 */
function renderizarResultadoUbicacion(ubicacion) {
  const seccionResultado = document.getElementById('resultado-ubicacion');
  const badgeCalidad = document.getElementById('badge-calidad');
  const detalleCalidad = document.getElementById('detalle-calidad');
  const valorPrecision = document.getElementById('valor-precision');
  const valorTimestamp = document.getElementById('valor-timestamp');
  const valorLatitud = document.getElementById('valor-latitud');
  const valorLongitud = document.getElementById('valor-longitud');

  const calidad = evaluarCalidadSenal(ubicacion.precisionMetros);

  if (badgeCalidad) {
    badgeCalidad.textContent = calidad.etiqueta;
    badgeCalidad.className = 'badge ' + (calidad.nivel === 'alta' ? 'badge-alta' : 'badge-aproximada');
  }
  if (detalleCalidad) {
    detalleCalidad.textContent = calidad.detalle;
  }
  if (valorPrecision) {
    valorPrecision.textContent = `± ${ubicacion.precisionMetros} metros`;
  }
  if (valorTimestamp) {
    valorTimestamp.textContent = formatearHora(ubicacion.timestamp);
  }
  if (valorLatitud) {
    valorLatitud.textContent = ubicacion.latitud.toFixed(6);
  }
  if (valorLongitud) {
    valorLongitud.textContent = ubicacion.longitud.toFixed(6);
  }
  if (seccionResultado) {
    seccionResultado.hidden = false;
  }
}

/**
 * Plan B Obligatorio (Degradación Elegante):
 * Garantiza que la operación nunca quede bloqueada si el usuario deniega el permiso (código 1),
 * si está en un escritorio sin GPS o si ocurre TIMEOUT (código 3).
 */
function habilitarSelectorManualZona(mostrarGuiaPermisoDenegado, permitirReintentoBajaPrecision) {
  const seccionPlanB = document.getElementById('seccion-plan-b');
  const guiaReactivar = document.getElementById('guia-reactivar-permiso');
  const btnReintentarBaja = document.getElementById('btn-reintentar-baja-precision');
  const selectorZona = document.getElementById('selector-zona');

  if (guiaReactivar) {
    guiaReactivar.hidden = !mostrarGuiaPermisoDenegado;
  }
  if (btnReintentarBaja) {
    btnReintentarBaja.hidden = !permitirReintentoBajaPrecision;
  }
  if (seccionPlanB) {
    seccionPlanB.hidden = false;
  }
  if (selectorZona) {
    selectorZona.focus();
  }
}

// --------------------------------------------------------------------------
// 4. FLUJO DE PRE-PERMISO CONSCIENTE Y PREVENCIÓN DE TIMEOUT EN LAPTOPS SIN GPS
// --------------------------------------------------------------------------
// En computadoras sin chip GPS (especialmente conectadas por cable Ethernet), forzar
// enableHighAccuracy: true no genera precisión satelital y suele agotar el tiempo (TIMEOUT).
function obtenerOpcionesSegunDispositivo() {
  const chkModoLaptop = document.getElementById('chk-modo-laptop');
  const usarModoSinGPS = chkModoLaptop && chkModoLaptop.checked;

  if (usarModoSinGPS) {
    return {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000
    };
  }

  return {
    enableHighAccuracy: true,
    timeout: 8000,
    maximumAge: 30000
  };
}

/**
 * Consume `obtenerUbicacionActual()` desde `geo-helper.js` manejando éxito en .then(),
 * degradación automática al Plan B en .catch() y rehabilitación de botones en .finally().
 */
function ejecutarLecturaParaAdjuntar(opcionesForzadas) {
  const btnAdjuntar = document.getElementById('btn-adjuntar-ubicacion');
  const btnConfirmar = document.getElementById('btn-confirmar-ubicacion');
  const opciones = opcionesForzadas || obtenerOpcionesSegunDispositivo();

  if (btnAdjuntar) btnAdjuntar.disabled = true;
  if (btnConfirmar) btnConfirmar.disabled = true;

  mostrarCargando('Obteniendo coordenadas del dispositivo...');

  return obtenerUbicacionActual(opciones)
    .then((ubicacion) => {
      ubicacionAdjuntaActual = ubicacion;
      zonaManualActual = null;

      actualizarBadgePermiso('granted');
      renderizarResultadoUbicacion(ubicacion);
      actualizarResumenAdjunto();

      const seccionPlanB = document.getElementById('seccion-plan-b');
      if (seccionPlanB) {
        seccionPlanB.hidden = true;
      }

      const calidad = evaluarCalidadSenal(ubicacion.precisionMetros);
      mostrarMensajeEstado(
        `Coordenadas listas (±${ubicacion.precisionMetros} m — ${calidad.etiqueta}).`,
        'activo'
      );
      return ubicacion;
    })
    .catch((error) => {
      console.warn('[Geo] Plan B activado:', error.message);
      mostrarMensajeError(error.message);

      const fueDenegado = error.codigo === 1;
      const fueTimeoutOSinSenal = error.codigo === 2 || error.codigo === 3;

      if (fueDenegado) {
        actualizarBadgePermiso('denied');
      }

      habilitarSelectorManualZona(fueDenegado, fueTimeoutOSinSenal && opciones.enableHighAccuracy);
      return null;
    })
    .finally(() => {
      if (btnAdjuntar) btnAdjuntar.disabled = false;
      if (btnConfirmar) btnConfirmar.disabled = false;
    });
}

/**
 * Enrutador ético de 3 caminos basado en `consultarEstadoPermisoGeo()`:
 * - 'granted': solicita coordenadas directamente sin mostrar tarjeta redundante.
 * - 'prompt':  despliega primero `#tarjeta-prepermiso` explicando el beneficio al usuario.
 * - 'denied':  abre directamente el selector manual de zona e instrucciones de desbloqueo.
 */
function iniciarFlujoConscienteUbicacion(accionDestino) {
  accionPendienteTrasPermiso = accionDestino || 'adjuntar';

  return consultarEstadoPermisoGeo()
    .then((estado) => {
      actualizarBadgePermiso(estado);

      const tarjetaPrepermiso = document.getElementById('tarjeta-prepermiso');

      if (estado === 'granted') {
        if (tarjetaPrepermiso) tarjetaPrepermiso.hidden = true;
        if (accionPendienteTrasPermiso === 'sucursales') {
          return buscarSucursalesCercanas();
        }
        return ejecutarLecturaParaAdjuntar();
      }

      if (estado === 'denied') {
        if (tarjetaPrepermiso) tarjetaPrepermiso.hidden = true;
        mostrarMensajeError(
          'El permiso de ubicación está bloqueado en el navegador. Selecciona tu zona manualmente o reactívalo.'
        );
        habilitarSelectorManualZona(true, false);
        return null;
      }

      // Estado 'prompt': explicación contextual antes de disparar el diálogo del sistema
      if (tarjetaPrepermiso) {
        tarjetaPrepermiso.hidden = false;
      }
      mostrarMensajeEstado(
        'Revisa el aviso informativo y presiona "Compartir mi ubicación" para continuar.'
      );
      return null;
    });
}

// --------------------------------------------------------------------------
// 5. CONSUMIDOR MODULAR 1: REPORTE TÉCNICO EN CAMPO (Alta Precisión GPS)
// --------------------------------------------------------------------------
function registrarPaqueteReporte(paqueteCompleto) {
  reportesGuardados.unshift(paqueteCompleto);
  console.log('[Reporte] Paquete listo para enviar o almacenar:', paqueteCompleto);
  renderizarListaReportes();

  const formulario = document.getElementById('form-reporte');
  if (formulario) {
    formulario.reset();
  }
}

function renderizarListaReportes() {
  const lista = document.getElementById('lista-reportes');
  if (!lista) return;

  lista.innerHTML = '';

  reportesGuardados.forEach((reporte) => {
    const li = document.createElement('li');
    li.className = 'item-tarjeta';

    const cabecera = document.createElement('div');
    cabecera.className = 'item-cabecera';

    const titulo = document.createElement('strong');
    titulo.textContent = reporte.titulo;

    const badge = document.createElement('span');
    if (reporte.coordenadas) {
      const calidad = evaluarCalidadSenal(reporte.coordenadas.precisionMetros);
      badge.className = 'badge ' + (calidad.nivel === 'alta' ? 'badge-alta' : 'badge-aproximada');
      badge.textContent = `±${reporte.coordenadas.precisionMetros} m • ${calidad.etiqueta}`;
    } else {
      badge.className = 'badge badge-aviso';
      badge.textContent = 'Plan B Manual';
    }

    cabecera.appendChild(titulo);
    cabecera.appendChild(badge);

    const detalle = document.createElement('p');
    detalle.textContent = reporte.detalle;

    const meta = document.createElement('p');
    meta.className = 'item-meta';
    if (reporte.coordenadas) {
      meta.textContent = `Coords: ${reporte.coordenadas.latitud.toFixed(5)}, ${reporte.coordenadas.longitud.toFixed(5)} • ${formatearHora(reporte.coordenadas.timestamp)}`;
    } else if (reporte.ubicacionManual) {
      meta.textContent = reporte.ubicacionManual.referencia
        ? `Zona manual: ${reporte.ubicacionManual.zona} (${reporte.ubicacionManual.referencia})`
        : `Zona manual: ${reporte.ubicacionManual.zona}`;
    }

    li.appendChild(cabecera);
    li.appendChild(detalle);
    li.appendChild(meta);
    lista.appendChild(li);
  });
}

function enviarReporteConUbicacion(datosFormulario) {
  if (ubicacionAdjuntaActual) {
    const paqueteConGeo = Object.assign({}, datosFormulario, {
      coordenadas: ubicacionAdjuntaActual
    });
    registrarPaqueteReporte(paqueteConGeo);
    mostrarMensajeEstado('Reporte guardado con coordenadas verificadas.', 'activo');
    return Promise.resolve(paqueteConGeo);
  }

  if (zonaManualActual) {
    const paqueteManual = Object.assign({}, datosFormulario, {
      ubicacionManual: zonaManualActual
    });
    registrarPaqueteReporte(paqueteManual);
    mostrarMensajeEstado('Reporte guardado exitosamente usando Plan B manual.', 'activo');
    return Promise.resolve(paqueteManual);
  }

  return consultarEstadoPermisoGeo()
    .then((estado) => {
      actualizarBadgePermiso(estado);

      if (estado === 'prompt') {
        const tarjetaPrepermiso = document.getElementById('tarjeta-prepermiso');
        if (tarjetaPrepermiso) tarjetaPrepermiso.hidden = false;
        mostrarMensajeEstado(
          'Antes de enviar, confirma "Compartir mi ubicación" o elige una zona manual.'
        );
        return null;
      }

      if (estado === 'denied') {
        mostrarMensajeError(
          'Permiso bloqueado. Selecciona tu zona manual en el Plan B para guardar el reporte.'
        );
        habilitarSelectorManualZona(true, false);
        return null;
      }

      mostrarCargando('Obteniendo coordenadas para el reporte...');
      // Consumidor 1 invoca geo-helper.js priorizando precisión satelital
      return obtenerUbicacionActual({ enableHighAccuracy: true, timeout: 7000 })
        .then((ubicacion) => {
          ubicacionAdjuntaActual = ubicacion;
          renderizarResultadoUbicacion(ubicacion);
          actualizarResumenAdjunto();

          const paqueteCompleto = Object.assign({}, datosFormulario, {
            coordenadas: ubicacion
          });
          registrarPaqueteReporte(paqueteCompleto);
          mostrarMensajeEstado('Reporte guardado con coordenadas en tiempo real.', 'activo');
          return paqueteCompleto;
        })
        .catch((error) => {
          console.warn('[Geo] Fallback activado al enviar reporte:', error.message);
          mostrarMensajeError(error.message);
          habilitarSelectorManualZona(error.codigo === 1, error.codigo === 3);
          return null;
        });
    });
}

// --------------------------------------------------------------------------
// 6. CONSUMIDOR MODULAR 2: SUCURSALES CERCANAS (Lectura Rápida de Baja Precisión)
// --------------------------------------------------------------------------
// Fórmula de Haversine para calcular distancia geodésica en kilómetros sobre la esfera terrestre
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const radioTierraKm = 6371;
  const aRadianes = (grados) => (grados * Math.PI) / 180;

  const dLat = aRadianes(lat2 - lat1);
  const dLon = aRadianes(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(aRadianes(lat1)) * Math.cos(aRadianes(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radioTierraKm * c;
}

function renderizarSucursalesOrdenadas(listaConDistancias, modoOrigen) {
  const contenedor = document.getElementById('lista-sucursales');
  if (!contenedor) return;

  contenedor.innerHTML = '';

  listaConDistancias.forEach((sucursal, indice) => {
    const li = document.createElement('li');
    li.className = 'item-tarjeta';

    const cabecera = document.createElement('div');
    cabecera.className = 'item-cabecera';

    const nombre = document.createElement('strong');
    nombre.textContent = sucursal.nombre;

    const etiqueta = document.createElement('span');
    etiqueta.className = 'badge ' + (indice === 0 ? 'badge-alta' : 'badge-neutro');
    etiqueta.textContent = typeof sucursal.distanciaKm === 'number'
      ? `${sucursal.distanciaKm.toFixed(1)} km`
      : (indice === 0 ? 'Tu zona elegida' : 'Alternativa');

    cabecera.appendChild(nombre);
    cabecera.appendChild(etiqueta);

    const meta = document.createElement('p');
    meta.className = 'item-meta';
    meta.textContent = `${sucursal.zona} • Calculado vía ${modoOrigen}`;

    li.appendChild(cabecera);
    li.appendChild(meta);
    contenedor.appendChild(li);
  });
}

/**
 * Segundo consumidor independiente de `geo-helper.js`:
 * A diferencia del reporte técnico, aquí pasamos `enableHighAccuracy: false` y `maximumAge: 60000`
 * para resolver al instante con caché o red sin encender innecesariamente el GPS satelital.
 */
function buscarSucursalesCercanas() {
  mostrarCargando('Calculando sucursales cercanas (lectura rápida)...');

  return obtenerUbicacionActual({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 })
    .then((ubicacion) => {
      ubicacionAdjuntaActual = ubicacion;
      actualizarBadgePermiso('granted');
      renderizarResultadoUbicacion(ubicacion);
      actualizarResumenAdjunto();

      const ordenadas = SUCURSALES_SOPORTE
        .map((sucursal) => {
          return Object.assign({}, sucursal, {
            distanciaKm: calcularDistanciaKm(
              ubicacion.latitud,
              ubicacion.longitud,
              sucursal.latitud,
              sucursal.longitud
            )
          });
        })
        .sort((a, b) => a.distanciaKm - b.distanciaKm);

      renderizarSucursalesOrdenadas(ordenadas, `coordenadas (±${ubicacion.precisionMetros} m)`);
      mostrarMensajeEstado(
        `Sucursal más cercana: ${ordenadas[0].nombre} (${ordenadas[0].distanciaKm.toFixed(1)} km).`,
        'activo'
      );
    })
    .catch((error) => {
      console.warn('[Sucursales] Activando Plan B:', error.message);
      mostrarMensajeError(error.message);
      habilitarSelectorManualZona(error.codigo === 1, false);

      if (zonaManualActual) {
        filtrarSucursalesPorZonaManual(zonaManualActual.zona);
      }
    });
}

function filtrarSucursalesPorZonaManual(zonaSeleccionada) {
  const ordenadasPorZona = SUCURSALES_SOPORTE.slice().sort((a, b) => {
    const coincideA = a.zona === zonaSeleccionada ? 0 : 1;
    const coincideB = b.zona === zonaSeleccionada ? 0 : 1;
    return coincideA - coincideB;
  });

  renderizarSucursalesOrdenadas(ordenadasPorZona, 'selección manual (Plan B)');
}

// --------------------------------------------------------------------------
// 7. CONEXIÓN DE EVENTOS EN DOMContentLoaded (Cero lectura automática de GPS)
// - En iOS/Safari, llamar getCurrentPosition() automáticamente al cargar la página
//   sin un clic directo del usuario suele ser bloqueado silenciosamente.
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  verificarNotaIOS();
  actualizarResumenAdjunto();

  const btnInstalar = document.getElementById('btn-instalar');
  const btnAdjuntar = document.getElementById('btn-adjuntar-ubicacion');
  const btnConfirmarUbicacion = document.getElementById('btn-confirmar-ubicacion');
  const btnElegirManual = document.getElementById('btn-elegir-manual');
  const btnAplicarZonaManual = document.getElementById('btn-aplicar-zona-manual');
  const btnReintentarBaja = document.getElementById('btn-reintentar-baja-precision');
  const btnBuscarSucursales = document.getElementById('btn-buscar-sucursales');
  const formReporte = document.getElementById('form-reporte');
  const tarjetaPrepermiso = document.getElementById('tarjeta-prepermiso');

  // Instalación programática de un solo uso en Android / Chromium
  if (btnInstalar) {
    btnInstalar.addEventListener('click', () => {
      if (!eventoInstalacionDiferido) return;

      eventoInstalacionDiferido.prompt();
      eventoInstalacionDiferido.userChoice
        .then((eleccion) => {
          btnInstalar.hidden = true;
          eventoInstalacionDiferido = null;
          if (eleccion.outcome === 'accepted') {
            mostrarMensajeEstado('Instalación aceptada por el usuario.', 'activo');
          }
        })
        .catch((error) => {
          console.error('[PWA] Error en prompt de instalación:', error);
        });
    });
  }

  // Disparo bajo demanda desde gesto directo del usuario ("Adjuntar mi ubicación")
  if (btnAdjuntar) {
    btnAdjuntar.addEventListener('click', () => {
      iniciarFlujoConscienteUbicacion('adjuntar');
    });
  }

  // Confirmación informada dentro de #tarjeta-prepermiso (gesto directo compatible con Safari iOS)
  if (btnConfirmarUbicacion) {
    btnConfirmarUbicacion.addEventListener('click', () => {
      if (tarjetaPrepermiso) {
        tarjetaPrepermiso.hidden = true;
      }
      if (accionPendienteTrasPermiso === 'sucursales') {
        buscarSucursalesCercanas();
      } else {
        ejecutarLecturaParaAdjuntar();
      }
    });
  }

  // Paso voluntario al Plan B manual sin disparar ni quemar el diálogo nativo del navegador
  if (btnElegirManual) {
    btnElegirManual.addEventListener('click', () => {
      if (tarjetaPrepermiso) {
        tarjetaPrepermiso.hidden = true;
      }
      mostrarMensajeEstado('Modo manual activado sin solicitar permiso al navegador.');
      habilitarSelectorManualZona(false, false);
    });
  }

  // Confirmar sede operativa elegida manualmente en el Plan B
  if (btnAplicarZonaManual) {
    btnAplicarZonaManual.addEventListener('click', () => {
      const selectorZona = document.getElementById('selector-zona');
      const inputReferencia = document.getElementById('input-referencia-manual');

      if (!selectorZona || !selectorZona.value) {
        mostrarMensajeError('Por favor selecciona una zona operativa en la lista.');
        return;
      }

      zonaManualActual = {
        zona: selectorZona.value,
        referencia: inputReferencia ? inputReferencia.value.trim() : '',
        timestamp: Date.now()
      };
      ubicacionAdjuntaActual = null;

      actualizarResumenAdjunto();
      filtrarSucursalesPorZonaManual(zonaManualActual.zona);
      mostrarMensajeEstado(`Zona manual confirmada: ${zonaManualActual.zona}.`, 'activo');
    });
  }

  // Reintento rápido en laptops sin GPS cuando enableHighAccuracy provocó TIMEOUT (código 3)
  if (btnReintentarBaja) {
    btnReintentarBaja.addEventListener('click', () => {
      const chkModoLaptop = document.getElementById('chk-modo-laptop');
      if (chkModoLaptop) {
        chkModoLaptop.checked = true;
      }
      ejecutarLecturaParaAdjuntar({
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000
      });
    });
  }

  // Envío del formulario sin recarga nativa (Consumidor 1)
  if (formReporte) {
    formReporte.addEventListener('submit', (event) => {
      event.preventDefault();
      const inputTitulo = document.getElementById('titulo-reporte');
      const inputDetalle = document.getElementById('detalle-reporte');

      const datos = {
        titulo: inputTitulo ? inputTitulo.value.trim() : '',
        detalle: inputDetalle ? inputDetalle.value.trim() : ''
      };

      if (!datos.titulo || !datos.detalle) {
        mostrarMensajeError('Completa el título y las observaciones antes de guardar.');
        return;
      }

      enviarReporteConUbicacion(datos);
    });
  }

  // Buscador de sucursales cercanas (Consumidor 2 de geo-helper.js)
  if (btnBuscarSucursales) {
    btnBuscarSucursales.addEventListener('click', () => {
      iniciarFlujoConscienteUbicacion('sucursales');
    });
  }
});
