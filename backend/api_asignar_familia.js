// =============================================================================
// api_asignar_familia.js
// -----------------------------------------------------------------------------
// Endpoint para ASIGNAR uno o varios ESTUDIANTES a una FAMILIA / APODERADO desde
// la vista de Apoderados (views/apoderados.html).
//
// Replica la logica del script backend/tools/asignar_estudiante_familia.js y del
// endpoint POST /api/registro, pero orientado a la UI: soporta un modo de
// simulacion ('dry') que NO escribe nada y devuelve un reporte de lo que haria,
// y un modo 'apply' que ejecuta los cambios.
//
// Vinculo de un estudiante con una familia (ver db_support.js):
//   1) DIRECTO (embebido): usersDB.hijos[] -> { nombre, rut, curso, seccion }
//      dentro del documento del apoderado (padres[] con es_usuario_cuenta).
//   2) CRUZADO (indice inverso): hermanosMapDB (coleccion 'nombreHermanosMap')
//      -> { id: <nombre estudiante>, apoderado_email: [correos] }.
//   El nexo es el NOMBRE del estudiante y el CORREO del apoderado.
//
// POST /api/asignar_familia   (protegido con apiKeyAuth)
//   body: {
//     target_email: string,        // correo del apoderado destino (email del doc o de padres[])
//     estudiantes: string[],       // nombres de los estudiantes a asignar
//     mode: 'dry' | 'apply'        // 'dry' = simular (por defecto), 'apply' = aplicar
//   }
//   respuesta: {
//     ok: true,
//     mode,
//     target: { email, correos_padres },
//     resultados: [ { estudiante, acciones: [...], estado_previo, estado_final? } ],
//     resumen: { total, con_cambios, sin_cambios, errores }
//   }
// =============================================================================

const express = require('express');
const router = express.Router();

const db_support = require('./db_support');
const apiKeyAuth = require('./apiKeyAuth');
// Se reutiliza el "merge" oficial de familias (api_familias.unificarFamilia) para
// mezclar la familia + sus entradas (bloques/jornada combinados) tras asignar un
// hermano. Se importa el modulo completo para evitar problemas de orden de carga.
const api_familias = require('./api_familias');

// Evento por defecto sobre el que se regeneran las entradas al asignar familia.
// (El sistema opera hoy con un unico evento activo de temporada.)
const ID_ORGANIZACION_DEFAULT = 'cpa_patrona';
const ID_EVENTO_DEFAULT = 'fiesta_chilena_2026';

// Normalizacion consistente con los tools: trim + colapsar espacios internos.
const norm = (s) => (s || '').trim().replace(/\s+/g, ' ');
const normLower = (s) => norm(s).toLowerCase();

// Determina el nombre_familia CANONICO (unico) para una familia a partir de los
// documentos del indice inverso de sus miembros. El objetivo es que TODOS los
// hermanos compartan exactamente el mismo nombre_familia, evitando variantes que
// solo difieren en mayus/minus (p.ej. "Ramirez silva" vs "ramirez silva"). Esas
// variantes hacen que las entradas se agrupen bajo "familias" distintas y que la
// generacion/lectura de entradas (comparacion exacta por 'familia') falle.
//
//   mapasFamilia: docs de hermanosMapDB de los miembros de la familia.
//   nombreEstudiante: un nombre de la familia (fallback para derivar el apellido).
// Devuelve el string canonico o null si no se puede determinar.
function resolverNombreFamiliaCanonico(mapasFamilia, nombreEstudiante) {
  const candidatos = (mapasFamilia || [])
    .map(m => norm(m && m.nombre_familia))
    .filter(Boolean);

  if (candidatos.length === 0) {
    // Sin dato previo: derivar el apellido como prefijo del nombre (2 tokens).
    // Es un fallback; en la practica los docs ya traen nombre_familia.
    const tokens = norm(nombreEstudiante).split(' ');
    return tokens.length >= 2 ? tokens.slice(0, 2).join(' ') : (tokens[0] || null);
  }

  // Agrupar por su forma en minusculas y elegir la variante mas frecuente;
  // en empate, la que ordena primero (determinista).
  const conteo = new Map();
  for (const c of candidatos) {
    const clave = c.toLowerCase();
    if (!conteo.has(clave)) conteo.set(clave, new Map());
    const variantes = conteo.get(clave);
    variantes.set(c, (variantes.get(c) || 0) + 1);
  }

  // Si hay una unica forma (misma en minusculas), elegir su mejor variante.
  // Si hubiera varias formas distintas (familia mezclada real), preferir la que
  // sea prefijo del nombre del estudiante procesado.
  const nombreLower = normLower(nombreEstudiante);
  let mejorClave = null;
  if (conteo.size === 1) {
    mejorClave = [...conteo.keys()][0];
  } else {
    mejorClave = [...conteo.keys()].find(k => nombreLower.startsWith(k))
      || [...conteo.keys()].sort()[0];
  }

  const variantes = conteo.get(mejorClave);
  return [...variantes.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'es'))[0][0];
}

// Regex para el nombre del estudiante tolerando espacios extra y mayus/minus.
function rxNombre(nombreNorm) {
  const escaped = nombreNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp('^\\s*' + escaped + '\\s*$', 'i');
}
// Regex exacta (case-insensitive) para correo.
function rxEmail(e) {
  return new RegExp('^' + normLower(e).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
}

// Construye el estado actual de un estudiante para el reporte.
async function leerEstadoEstudiante(nombreLimpio) {
  const rxN = rxNombre(nombreLimpio);
  const usuariosConHijo = await db_support.usersDB.find({ 'hijos.nombre': rxN }).lean();
  const mapa = await db_support.hermanosMapDB.findOne({ id: rxN }).lean();

  const familias = usuariosConHijo.map(u => {
    const hijo = (u.hijos || []).find(h => normLower(h.nombre) === normLower(nombreLimpio));
    return {
      email_doc: u.email,
      curso: hijo?.curso || '',
      seccion: hijo?.seccion || '',
      rut: hijo?.rut || '',
      padres: (u.padres || []).map(p => p.correo).filter(Boolean),
    };
  });

  return {
    familias,
    hermanosMap: mapa ? {
      id: mapa.id,
      nombre_familia: mapa.nombre_familia || null,
      apoderado_email: mapa.apoderado_email || [],
      hermanos: mapa.hermanos || [],
    } : null,
  };
}

// Procesa un estudiante (dry o apply). Devuelve el objeto de reporte.
//   hermanosFamilia: nombres (normalizados) de TODOS los estudiantes que
//   pertenecen a la familia destino (hijos[] del apoderado). Se usa para
//   sincronizar el campo hermanos[] del indice inverso, de modo que la consulta
//   /api/consulta/estudiantes/relacion los reconozca como hermanos y no dispare
//   el falso error "familias sin mergear" en Actividades.
async function procesarEstudiante(nombreLimpio, userDoc, correosPadres, apply, hermanosFamilia = [], nombreFamiliaCanonico = null) {
  const rxN = rxNombre(nombreLimpio);
  const acciones = [];
  let error = null;

  const estadoPrevio = await leerEstadoEstudiante(nombreLimpio);

  // ---- 1) usersDB.hijos[]: agregar el estudiante si no esta ----
  const yaTiene = (userDoc.hijos || []).some(h => normLower(h.nombre) === normLower(nombreLimpio));
  if (yaTiene) {
    acciones.push({ tipo: 'users', cambio: false, detalle: 'El estudiante ya esta en hijos[] de esta familia.' });
  } else {
    // Recuperar curso/seccion/rut desde otra familia que ya lo tenga.
    let base = { nombre: nombreLimpio, rut: '', curso: '', seccion: '' };
    const otra = estadoPrevio.familias.find(f => f.email_doc !== userDoc.email);
    if (otra) {
      base = { nombre: nombreLimpio, rut: otra.rut || '', curso: otra.curso || '', seccion: otra.seccion || '' };
    }
    acciones.push({
      tipo: 'users',
      cambio: true,
      detalle: `Se agregara a hijos[] de ${userDoc.email}: ${JSON.stringify(base)}`,
      datos: base,
    });
    if (apply) {
      await db_support.usersDB.updateOne(
        { _id: userDoc._id },
        { $push: { hijos: base } },
        { runValidators: false }
      );
    }
  }

  // ---- 2) hermanosMapDB: upsert del doc y union de apoderado_email ----
  const previos = estadoPrevio.hermanosMap ? estadoPrevio.hermanosMap.apoderado_email : [];
  const finales = [...new Set([...previos, ...correosPadres].filter(Boolean))];
  const existeDoc = !!estadoPrevio.hermanosMap;
  const cambioMapa = !existeDoc
    || JSON.stringify(previos.slice().sort()) !== JSON.stringify(finales.slice().sort());

  // Campos que se escribiran en el upsert del indice inverso.
  const setMapa = { id: nombreLimpio, apoderado_email: finales };

  if (!cambioMapa) {
    acciones.push({ tipo: 'hermanosMap', cambio: false, detalle: `apoderado_email ya contiene los correos: ${JSON.stringify(previos)}` });
  } else {
    acciones.push({
      tipo: 'hermanosMap',
      cambio: true,
      detalle: `${existeDoc ? 'Actualizar' : 'Crear (upsert)'} nombreHermanosMap id="${nombreLimpio}". apoderado_email: ${JSON.stringify(previos)} -> ${JSON.stringify(finales)}`,
      apoderado_email_previo: previos,
      apoderado_email_final: finales,
    });
  }

  // ---- 3) hermanosMapDB: sincronizar hermanos[] con TODA la familia ----
  // El indice inverso debe listar como hermanos a todos los estudiantes de la
  // familia (incluyendose a si mismo). Sin esto, dos hijos de un mismo apoderado
  // quedan en "familias" distintas y /api/consulta/estudiantes/relacion los trata
  // como no-hermanos (falso error "familias sin mergear" en Actividades).
  const hermanosPrevios = estadoPrevio.hermanosMap ? (estadoPrevio.hermanosMap.hermanos || []) : [];
  const hermanosFinales = [...new Set([...hermanosFamilia, nombreLimpio].map(norm).filter(Boolean))];
  const cambioHermanos =
    JSON.stringify(hermanosPrevios.map(norm).slice().sort()) !== JSON.stringify(hermanosFinales.slice().sort());

  if (!cambioHermanos) {
    acciones.push({ tipo: 'hermanosMap', cambio: false, detalle: `hermanos[] ya esta sincronizado: ${JSON.stringify(hermanosPrevios)}` });
  } else {
    setMapa.hermanos = hermanosFinales;
    acciones.push({
      tipo: 'hermanosMap',
      cambio: true,
      detalle: `Sincronizar hermanos[] de "${nombreLimpio}": ${JSON.stringify(hermanosPrevios)} -> ${JSON.stringify(hermanosFinales)}`,
      hermanos_previo: hermanosPrevios,
      hermanos_final: hermanosFinales,
    });
  }

  // ---- 4) hermanosMapDB: unificar nombre_familia con el valor canonico ----
  // Todos los hermanos deben compartir EXACTAMENTE el mismo nombre_familia. Si el
  // documento actual difiere del canonico (aunque solo sea por mayus/minus), se
  // corrige. De lo contrario las entradas quedan bajo "familias" distintas y no
  // se generan/leen correctamente (la agrupacion por 'familia' es exacta).
  const nombreFamiliaPrevio = estadoPrevio.hermanosMap ? (estadoPrevio.hermanosMap.nombre_familia || null) : null;
  const cambioNombreFamilia = !!nombreFamiliaCanonico
    && norm(nombreFamiliaPrevio) !== norm(nombreFamiliaCanonico);

  if (nombreFamiliaCanonico) {
    if (!cambioNombreFamilia) {
      acciones.push({ tipo: 'hermanosMap', cambio: false, detalle: `nombre_familia ya es consistente: "${nombreFamiliaPrevio}"` });
    } else {
      setMapa.nombre_familia = nombreFamiliaCanonico;
      const motivo = nombreFamiliaPrevio && normLower(nombreFamiliaPrevio) === normLower(nombreFamiliaCanonico)
        ? ' (solo difiere en mayus/minus; se unifica para que se generen las entradas)'
        : '';
      acciones.push({
        tipo: 'hermanosMap',
        cambio: true,
        detalle: `Unificar nombre_familia de "${nombreLimpio}": "${nombreFamiliaPrevio}" -> "${nombreFamiliaCanonico}"${motivo}`,
        nombre_familia_previo: nombreFamiliaPrevio,
        nombre_familia_final: nombreFamiliaCanonico,
      });
    }
  }

  // Un unico upsert con todos los campos que cambiaron (apoderado_email, hermanos
  // y/o nombre_familia).
  if (apply && (cambioMapa || cambioHermanos || cambioNombreFamilia)) {
    await db_support.hermanosMapDB.findOneAndUpdate(
      { id: nombreLimpio },
      { $set: setMapa },
      { upsert: true, runValidators: false }
    );
  }

  const reporte = {
    estudiante: nombreLimpio,
    error,
    con_cambios: acciones.some(a => a.cambio),
    acciones,
    estado_previo: estadoPrevio,
  };

  if (apply) {
    reporte.estado_final = await leerEstadoEstudiante(nombreLimpio);
  }

  return reporte;
}

// GET /api/estudiantes_registrados?curso=&seccion=
// Devuelve solo los estudiantes YA REGISTRADOS en el sistema (los que existen
// como hijos[] en algun documento de usersDB), a diferencia de /api/alumnos que
// devuelve el listado completo del colegio (listadoCursosDB). Filtra por curso y
// seccion si se proveen. Devuelve nombres unicos (sin duplicar por familia).
router.get('/estudiantes_registrados', async (req, res) => {
  const tag = '[GET /api/estudiantes_registrados]';
  try {
    const { curso, seccion } = req.query;

    const match = {};
    if (curso) match['hijos.curso'] = curso;
    if (seccion) match['hijos.seccion'] = seccion;

    // Traer solo el campo hijos de los usuarios que tengan al menos un hijo
    // en el curso/seccion pedido (o todos si no se filtra).
    const filtro = (curso || seccion) ? match : { 'hijos.0': { $exists: true } };
    const usuarios = await db_support.usersDB.find(filtro, 'hijos').lean();

    // Aplanar hijos y filtrar por curso/seccion exactos (el match de arriba
    // acota documentos, pero un documento puede tener hijos de varios cursos).
    const vistos = new Set();
    const estudiantes = [];
    for (const u of usuarios) {
      for (const h of (u.hijos || [])) {
        if (!h || !h.nombre) continue;
        if (curso && h.curso !== curso) continue;
        if (seccion && h.seccion !== seccion) continue;
        const clave = normLower(h.nombre);
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        estudiantes.push({ nombre: norm(h.nombre), rut: h.rut || '', curso: h.curso || '', seccion: h.seccion || '' });
      }
    }

    estudiantes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return res.json(estudiantes);
  } catch (error) {
    console.error(`${tag} Error:`, error);
    return res.status(500).json({ error: 'Error al consultar estudiantes registrados' });
  }
});

router.post('/asignar_familia', apiKeyAuth, express.json(), async (req, res) => {
  const tag = '[POST /api/asignar_familia]';
  try {
    const { target_email } = req.body;
    let { estudiantes, mode } = req.body;

    mode = mode === 'apply' ? 'apply' : 'dry';
    const apply = mode === 'apply';

    if (!target_email || !String(target_email).trim()) {
      return res.status(400).json({ ok: false, error: 'Falta el correo del apoderado destino (target_email).' });
    }

    if (typeof estudiantes === 'string') {
      try { estudiantes = JSON.parse(estudiantes); }
      catch (e) { estudiantes = estudiantes.split(',').map(s => s.trim()).filter(Boolean); }
    }
    if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
      return res.status(400).json({ ok: false, error: 'Debe seleccionar al menos un estudiante.' });
    }

    // Normalizar y deduplicar la lista de estudiantes.
    const nombres = [...new Set(estudiantes.map(norm).filter(Boolean))];

    // Ubicar el documento de la familia destino (por padres.correo o email).
    const rxC = rxEmail(target_email);
    let userDoc = await db_support.usersDB.findOne({ 'padres.correo': rxC }).lean();
    if (!userDoc) userDoc = await db_support.usersDB.findOne({ email: rxC }).lean();

    if (!userDoc) {
      return res.status(404).json({ ok: false, error: `No se encontro ningun apoderado con el correo: ${target_email}` });
    }

    const correosPadres = [...new Set((userDoc.padres || []).map(p => p.correo).filter(Boolean))];

    // Conjunto de hermanos de la familia: nombres de los hijos[] ya presentes en
    // el documento del apoderado destino, mas los estudiantes que se estan
    // asignando ahora. Se usa para sincronizar hermanos[] en el indice inverso.
    const hermanosFamilia = [...new Set([
      ...(userDoc.hijos || []).map(h => norm(h.nombre)).filter(Boolean),
      ...nombres,
    ].filter(Boolean))];

    // Resolver el nombre_familia CANONICO (unico) a partir de los documentos del
    // indice inverso de todos los miembros. Se usa para unificar el campo en cada
    // hermano y evitar variantes que solo difieren en mayus/minus.
    const rxHermanos = hermanosFamilia.map(rxNombre);
    const mapasFamilia = rxHermanos.length
      ? await db_support.hermanosMapDB.find({ id: { $in: rxHermanos } }).lean()
      : [];
    const nombreFamiliaCanonico = resolverNombreFamiliaCanonico(mapasFamilia, hermanosFamilia[0] || nombres[0]);

    console.log(`${tag} mode=${mode} target=${userDoc.email} estudiantes=${JSON.stringify(nombres)} hermanosFamilia=${JSON.stringify(hermanosFamilia)} nombre_familia_canonico="${nombreFamiliaCanonico}"`);

    const resultados = [];
    for (const nombre of nombres) {
      try {
        resultados.push(await procesarEstudiante(nombre, userDoc, correosPadres, apply, hermanosFamilia, nombreFamiliaCanonico));
      } catch (e) {
        resultados.push({
          estudiante: nombre,
          error: e.message || String(e),
          con_cambios: false,
          acciones: [],
        });
      }
    }

    // Sincronizar hermanos[] tambien en los miembros de la familia que NO venian
    // en la seleccion (p.ej. un hermano ya existente que no se remarco). Sin esto
    // el indice inverso quedaria consistente solo en un sentido: el doc del nuevo
    // hermano listaria a todos, pero los docs previos no listarian al nuevo.
    const yaProcesados = new Set(nombres.map(normLower));
    const otrosMiembros = hermanosFamilia.filter(n => !yaProcesados.has(normLower(n)));
    for (const nombre of otrosMiembros) {
      try {
        resultados.push(await procesarEstudiante(nombre, userDoc, correosPadres, apply, hermanosFamilia, nombreFamiliaCanonico));
      } catch (e) {
        resultados.push({
          estudiante: nombre,
          error: e.message || String(e),
          con_cambios: false,
          acciones: [],
        });
      }
    }

    // Mezclar la familia + sus entradas (bloques/jornada combinados) delegando en
    // api_familias.unificarFamilia (el "merge"). Se le pasan TODOS los hermanos de
    // la familia; el merge arma el nombre_familia combinado (apellidos distintos
    // con '/'), anula sets duplicados y regenera las entradas consolidadas.
    let entradasAcciones = [];
    try {
      const mergeRes = await api_familias.unificarFamilia({
        id_organizacion: ID_ORGANIZACION_DEFAULT,
        id_evento: ID_EVENTO_DEFAULT,
        estudiantes: hermanosFamilia,
        user_email: userDoc.email,
        mode,
      });
      // Normalizar las acciones del merge al formato del reporte (tipo/cambio/detalle).
      entradasAcciones = (mergeRes && mergeRes.acciones ? mergeRes.acciones : [])
        .map(a => ({ tipo: a.tipo || 'entradas', cambio: true, detalle: a.detalle }));
      if (mergeRes && mergeRes.nombre_familia) {
        entradasAcciones.unshift({ tipo: 'familia', cambio: true, detalle: `Familia unificada como "${mergeRes.nombre_familia}".` });
      }
    } catch (e) {
      entradasAcciones = [{ tipo: 'entradas', cambio: false, detalle: `Error al unificar familia/entradas: ${e.message || e}` }];
    }

    const resumen = {
      total: resultados.length,
      con_cambios: resultados.filter(r => r.con_cambios).length,
      sin_cambios: resultados.filter(r => !r.con_cambios && !r.error).length,
      errores: resultados.filter(r => r.error).length,
    };

    return res.json({
      ok: true,
      mode,
      target: { email: userDoc.email, correos_padres: correosPadres },
      resultados,
      entradas: entradasAcciones,
      resumen,
    });
  } catch (error) {
    console.error(`${tag} Error:`, error);
    return res.status(500).json({ ok: false, error: error.message || 'Error interno del servidor' });
  }
});

module.exports = router;
