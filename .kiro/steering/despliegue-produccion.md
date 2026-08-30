---
inclusion: manual
---

# Cambios pendientes de despliegue a producción

Registro de los cambios realizados en la rama de desarrollo y su destino
(producción o solo local). Actualizar esta lista a medida que se agregan cambios
o se completa un despliegue.

Base de datos de producción: `cpa_patrona_2026` (cluster `old-data.g2qp95c.mongodb.net`).
El nombre de la BD se define con `DATABASE_YEAR_NAME` en `.env.local` / variables de Render.

## SÍ deben ir a producción

Correcciones reales de funcionalidad. Incluir todas al desplegar.

1. `views/entradas_eventos.html`
   - `cargarNombresHijosPorEmail()`: cuando el `user_email` llega por la URL,
     se pueblan los hijos consultando `/api/consulta/hijos` (antes quedaba
     `nombres_hijos` vacío y aparecía "No se encontraron entradas").
   - `getTextoBloques()`: muestra el bloque real (ej. "Bloque 03") y solo
     "Por Confirmar" cuando el campo viene vacío (antes estaba fijo en
     "Por Confirmar").
   - `getUserEmail()`: en la rama de sesión, si el documento del usuario no tiene
     hijos propios pero SÍ es apoderado de una familia (registrada por el
     representante en hermanosMap), ahora se hace fallback a
     `cargarNombresHijosPorEmail()`. Antes un apoderado no representante veía
     "No se encontraron entradas" en Actividades. También se blindó el acceso a
     `window.parent.location.search` (fallback a `window.location.search`).
   - `cargarEntradasUsuario()`: ahora se RENDERIZAN también las entradas en estado
     `inactiva` (`renderizar.inactiva = true`). El botón "Enviar entradas al
     correo" queda DESHABILITADO cuando no hay entradas activas (solo
     inactivas/usadas). Se corrigió el bloque `finally` que antes re-habilitaba
     el botón incondicionalmente.

2. `backend/api_entradas.js`
   - `POST /entradas/send_email`: tras un envío exitoso marca en el usuario
     `entradas_enviadas: true` y `fecha_envio_entradas`, para que el mantenedor
     de Apoderados refleje el estado correcto.

3. `backend/api_consultas_db.js`
   - `GET /api/consulta/hijos`: búsqueda de `apoderado_email` case-insensitive
     (correos guardados con mayúsculas ya hacen match con el login en minúsculas).
   - `GET /api/consulta/estudiantes/relacion`: comparación de nombres tolerante a
     espacios extra (evita el falso error de "familias sin mergear").
   - Corregido `catch` que referenciaba una variable inexistente (`error` -> `err`).

4. `views/mis_datos.html`
   - `poblarNombresAlumnos()`: el select de NOMBRE del hijo se puebla aunque
     falle la consulta de "ya registrados" (antes quedaba vacío en móvil porque
     el poblado dependía de un segundo fetch con x-api-key). Reemplaza el patrón
     frágil en el listener `change`, en el botón "Modificar" y en
     `fillChildrenSection` (elimina también una race condition).
   - Validación al guardar: obliga a marcar exactamente un "Representante de la
     familia" (`account_owner[]`) antes de enviar.
   - Preselección/deshabilitación de nombres tolerante a mayúsculas y espacios
     extra (los nombres vienen con capitalización inconsistente): antes la
     comparación exacta podía dejar el hijo sin seleccionar o bloquear su opción.
   - FIX INICIALIZACIÓN EN IFRAME (causa real del "no aparece el listado" en
     móvil): los dos bloques `DOMContentLoaded` usaban el guard
     `paginaInicializada(id_pagina)`, que marca un flag en `window.top`. Como
     `mis_datos.html` corre dentro del iframe `#visor`, al recargar el iframe con
     el flag ya puesto en el top, el bloque se saltaba COMPLETO y los listeners
     `change` de curso/sección nunca se registraban, por lo que
     `poblarNombresAlumnos()` no se llamaba (no salía ni `/api/alumnos` en logs).
     Se reemplazó por una bandera por-documento (`document.__misDatosInicializado_1`
     y `_2`): el setup corre una vez por carga real del iframe y no se duplica.
   - Diagnóstico visible: si el select de Nombre queda sin alumnos, muestra el
     motivo como opción deshabilitada (útil en móvil sin consola).
   - Validación al guardar: los correos de los apoderados deben ser DISTINTOS
     entre sí (dos apoderados con el mismo correo rompen la asociación de
     entradas). Bloquea el envío con alerta si hay correos repetidos.
   - Texto: el aviso de cuota pendiente en la tarjeta de invitados cambió de
     "Debes pagar la Cuota del Centro de Padres para poder solicitar invitados."
     a "Debes pagar las entradas de los invitados."

5. `src/server.js`
   - `GET /api/manualUser`: búsqueda de usuario por email case-insensitive
     (evita "Error al cargar datos del usuario" cuando el email guardado está en
     minúsculas pero el user_email de la URL viene en mayúsculas, p.ej. desde
     hermanosMap). También se normaliza la comparación al heredar datos de un
     registro relacionado.
   - `POST /api/registro`: valida que el registro entrante designe EXACTAMENTE un
     representante de la familia (`es_usuario_cuenta === true`). Obliga a marcar
     representante al registrarse por primera vez; responde 400 con mensaje claro
     si falta o si hay más de uno. Es la defensa de backend equivalente a la
     validación del formulario en `mis_datos.html` (por si la petición no pasa
     por el frontend actualizado).
   - `POST /api/registro`: valida además que los correos de los apoderados sean
     DISTINTOS entre sí (responde 400 "Cada apoderado debe tener un correo
     distinto."). Defensa de backend equivalente a la validación del formulario.
   - NOTA: este archivo tambien contiene un cambio "solo local" (ver mas abajo,
     ruta /authenticated). Al desplegar, incluir SOLO el fix de /api/manualUser y
     la validación de representante en /api/registro.

6. `views/pagos_cpa.html`  (tabla "Mis Pagos", función `paymentsUpdate`)
   - Orden por fecha más reciente primero; los pagos SIN fecha (o fecha inválida)
     quedan al final (segunda prioridad). Se ordena sobre una copia del array
     para no afectar el cálculo de acumulados / último pago.
   - Concepto por prioridad: descripción del compromiso -> `tipo` -> `subtipo`.
     Antes los pagos de flow reconciliados (con `tipo` vacío y descripción en
     `subtipo`, ej. "Invitaciones adicionales (2)") mostraban el Concepto en
     blanco.
   - Glosa visible: mapa `GLOSAS_CONCEPTO` traduce identificadores crudos de
     `tipo` a texto legible (`pago_agenda_sin_cpa` -> "Pago Agenda"). El valor en
     BD se conserva; solo cambia lo que ve el usuario. Extensible.

7. `views/panel_usuario.html`  (función `construirMenu`)
   - Cuando el usuario NO está registrado (sin hijos/padres enrolados) se ocultan
     del menú tanto "Mis Pagos al CGPA" (`pagos_cpa.html`) como "Actividades y
     Eventos" (`entradas_eventos.html`). Antes solo se ocultaba Mis Pagos. Se usa
     la lista `ocultarSinRegistro` (extensible). Al registrar sus datos,
     `habilitarMisPagos()` reconstruye el menú y ambos ítems reaparecen.

## Herramientas de mantención (opcionales en producción)

Scripts de terminal para operaciones manuales sobre la BD. No afectan el runtime
de la app; incluirlos es opcional.

- `backend/tools/set_representante.js`
  Marca/desmarca el representante de una familia.
  Uso: `node backend/tools/set_representante.js <correo> <marcar|desmarcar> [--force]`

- `backend/tools/limpiar_espacios_estudiante.js`
  Limpia espacios extra en el nombre de un estudiante (usersDB, TicketEventoDB,
  hermanosMapDB) y fusiona duplicados de hermanosMap.
  Uso: `node backend/tools/limpiar_espacios_estudiante.js "<nombre>" <--dry|--apply>`

- `backend/tools/_conteo_apoderados.js`
  Cuenta apoderados/usuarios registrados en la BD (`cpa_patrona_<año>`): total de
  cuentas, cuentas con al menos un padre/hijo, correos validados, total de padres
  individuales y familias en hermanosMap. Solo lectura.
  Uso: `node backend/tools/_conteo_apoderados.js`

- `backend/tools/_inspeccionar_usuario.js`
  Inspecciona un usuario por email (hijos, padres, correo validado) y verifica el
  listado del curso 3MB. Útil para diagnosticar registros. Solo lectura.
  Uso: `node backend/tools/_inspeccionar_usuario.js <email>`

- `backend/tools/consultar_pagos_usuario.js`
  Lista los pagos (pagosDB) asociados a un apoderado o estudiante para validar
  movimientos de "Mis Pagos": tipo, subtipo, monto, fecha, método, commerce_order,
  num_folio. Resuelve los estudiantes de la familia vía hermanosMap. Solo lectura.
  Uso: `node backend/tools/consultar_pagos_usuario.js <email>`
       `node backend/tools/consultar_pagos_usuario.js --estudiante "<nombre>"`
  Nota: conservar como requisito/SPEC; NO eliminar (herramienta de diagnóstico).

## NO deben ir a producción (solo ambiente local)

Cambios que omiten la validación de correo para facilitar pruebas locales.
Están condicionados a local (no debilitan producción aunque se suban por error),
pero por decisión del equipo NO se despliegan. Excluir / revertir antes del deploy.

1. `public/index.html`
   - Constante `esLocal` (`location.hostname` es `localhost`/`127.0.0.1`).
   - En `validarYEnviar()`: las ramas del login manual que, cuando `esLocal`,
     redirigen directo a `/panel_usuario.html` en lugar de `/validar_correo.html`
     (rama principal, rama `.then` del catch y rama `.catch` del catch).

2. `src/server.js`
   - Ruta `GET /authenticated`: bloque `const esLocal = (PORT == LOCAL_PORT)` que
     omite servir `validar_correo.html` cuando corre en local.

## Notas de despliegue

- Los cambios de backend (`api_*.js`, `server.js`) requieren reiniciar el servidor
  para tomar efecto. Los cambios de vistas (`public/`, `views/`) solo requieren
  recargar el navegador con caché limpia.
- Antes de desplegar, revisar que los dos cambios "solo local" queden fuera de la
  rama/commit que va a producción.
