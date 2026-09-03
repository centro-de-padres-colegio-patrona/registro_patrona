const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');
const { BASEURL } = require('../backend/git_branch');
// Reutiliza la generacion/consolidacion oficial de entradas por familia.
const api_entradas = require('./api_entradas');


const SECRET_API_KEY = config_env.API_KEY;

const url_server = config_env.LOCAL_PORT === 5001 ? `http://localhost:${config_env.LOCAL_PORT}` : BASEURL;

// --- Helpers de nombres/familia (tolerantes a mayus/minus y espacios) ---
const mergeNorm = (s) => (s || '').trim().replace(/\s+/g, ' ');
const mergeNormLower = (s) => mergeNorm(s).toLowerCase();
const rxFamiliaMerge = (f) => new RegExp('^\\s*' + mergeNorm(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+') + '\\s*$', 'i');

// Deduplica una lista de nombres de forma tolerante a mayus/minus y espacios,
// conservando el primer casing visto por nombre.
function dedupNombres(nombres) {
  const vistos = new Map(); // clave lower -> primer casing
  for (const n of nombres) {
    const limpio = mergeNorm(n);
    if (!limpio) continue;
    const clave = limpio.toLowerCase();
    if (!vistos.has(clave)) vistos.set(clave, limpio);
  }
  return [...vistos.values()];
}

// Deriva el "apellido" (nombre de familia base) de un nombre completo de
// estudiante: los dos primeros tokens (apellido paterno + materno).
function apellidoDeNombre(nombreCompleto) {
  const tokens = mergeNorm(nombreCompleto).split(' ');
  return tokens.length >= 2 ? tokens.slice(0, 2).join(' ') : (tokens[0] || '');
}

// Construye el nombre_familia combinado a partir de los nombres de los hermanos:
// une los apellidos DISTINTOS (case-insensitive) con '/'; si todos comparten el
// mismo apellido, devuelve uno solo. Preserva el primer casing visto por apellido.
function construirNombreFamiliaCombinado(nombresHermanos) {
  const vistos = new Map(); // clave lower -> primer casing
  for (const nombre of nombresHermanos) {
    const ap = apellidoDeNombre(nombre);
    if (!ap) continue;
    const clave = ap.toLowerCase();
    if (!vistos.has(clave)) vistos.set(clave, ap);
  }
  return [...vistos.values()].join('/');
}

// Busca un correo con rol supervisor/administrador para autorizar la
// reactivacion de entradas dentro de generarEntradaParaFamilia.
async function obtenerEmailSupervisorMerge(correos = []) {
  try {
    for (const correo of correos) {
      if (!correo) continue;
      const rx = new RegExp('^' + mergeNormLower(correo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
      const p = await db_support.perfilesDB.findOne({ email: rx }).lean();
      if (p && db_support.hasSupervisorAccessRights(p.rol)) return p.email;
    }
    const admin = await db_support.perfilesDB.findOne({ rol: 'administrador', activo: true }).lean();
    return admin ? admin.email : null;
  } catch (e) {
    return null;
  }
}


/*router.post('/api/familias/merge', apiKeyAuth, async (req, res) => {
    const tag = '[POST /api/familias/merge]';
    //const url_server = config_env.URL_SERVER || BASEURL;
    try {
        const { id_organizacion, estudiantes , user_email} = req.body;

        // Validar que estudiantes sea un arreglo
        if (!Array.isArray(estudiantes)) {
            return res.status(400).json({ error: 'El campo "estudiantes" debe ser un arreglo.' });
        }

        // Verificar id_organizacion
        if (!id_organizacion) {
            return res.status(400).json({ error: 'El campo "id_organizacion" es obligatorio.' });
        }

        if (!user_email) {
            return res.status(400).json({ error: 'El campo "user_email" es obligatorio.' });
        }

        // Obtener la información de los estudiantes desde la base de datos
        const estudiantesInfo = await db_support.hermanosMapDB.find({ id: { $in: estudiantes } }).lean();
        const listaFamilias = {};
        const listas_hermanos = [];
        const estudiantesAnalizados = new Set();
        for (const estudianteInfo of estudiantesInfo) {
            // Anular todas las entradas de eventos.
            const id_evento = 'fiesta_chilena_2026';
            for (const estudiante of estudiantesInfo) {
                const result = await fetch(`${url_server}/api/entrada/desactivar`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': SECRET_API_KEY
                    },
                    body: JSON.stringify({
                        id_organizacion,
                        id_evento,
                        familia: estudiante.nombre_familia,
                    })
                });
                await result.json();
            }
        }
        // Merging estudiantes as brothers

        // Creating entradas for the new family
        
    } catch (error) {
        console.error(`${tag} Error al procesar la solicitud:`, error);
        res.status(500).json({ message: 'Error interno del servidor', error });
    }
});*/

// -----------------------------------------------------------------------------
// unificarFamilia: nucleo del "merge" de una familia. Combina el nombre_familia
// (apellidos distintos con '/', iguales uno solo), unifica el indice inverso,
// anula sets de apoderado/invitado duplicados de familias previas, re-vincula a
// los estudiantes (conservando folios) y regenera/consolida las entradas con
// jornada/bloques COMBINADOS. Reutilizable desde el endpoint y desde
// api_asignar_familia. Con mode='dry' NO escribe; solo describe las acciones.
async function unificarFamilia({ id_organizacion, id_evento, estudiantes, user_email, mode = 'apply' }) {
    const tag = '[unificarFamilia]';
    const apply = mode !== 'dry';
    const acciones = [];

    // 1) Reunir a TODOS los hermanos de la familia unificada. Partimos de los
        // estudiantes recibidos y expandimos con los hermanos[] que ya tengan sus
        // documentos en el indice inverso (por si vienen incompletos).
        const estudiantesNorm = dedupNombres(estudiantes);
        const rxEstudiantes = estudiantesNorm.map(rxFamiliaMerge);
        const docsIndice = await db_support.hermanosMapDB.find({ id: { $in: rxEstudiantes } }).lean();

        // Dedup case-insensitive: un mismo estudiante puede venir con distinta
        // capitalizacion desde hijos[] (minuscula) y desde hermanos[] del indice
        // inverso (con mayuscula). Se conserva un solo casing por estudiante.
        const nombresHermanos = dedupNombres([
            ...estudiantesNorm,
            ...docsIndice.flatMap(d => (d.hermanos || [])),
        ]);

        if (nombresHermanos.length < 1) {
            return { ok: false, status: 400, error: 'No se encontraron estudiantes para unificar.' };
        }

        // 2) Nombre de familia COMBINADO (apellidos distintos con '/', iguales uno).
        const nuevoNombreFamilia = construirNombreFamiliaCombinado(nombresHermanos);
        acciones.push({ tipo: 'familia', detalle: `nombre_familia combinado: "${nuevoNombreFamilia}" (hermanos: ${JSON.stringify(nombresHermanos)})` });

        // 3) Determinar las FAMILIAS EXACTAS de ESTA familia a partir de las
        // entradas de tipo estudiante de los HERMANOS REALES (match por
        // nombre_completo, tolerante a mayus/minus). Se usan los valores EXACTOS de
        // 'familia' de esos tickets (case-sensitive) para NO mezclar familias
        // homonimas: p.ej. "Ramirez silva" (alonso) no debe arrastrar a otra familia
        // "Ramirez Silva" (baltazar), que tiene otro estudiante y otros apoderados.
        const ticketsEstudiantes = await db_support.TicketEventoDB.find({
            id_organizacion, id_evento, tipo: 'estudiante',
            nombre_completo: { $in: nombresHermanos.map(rxFamiliaMerge) },
        }).lean();
        const familiasExactas = [...new Set(ticketsEstudiantes.map(t => t.familia).filter(Boolean))];

        // 4) Reunir TODAS las entradas de esas familias EXACTAS (match sensible a
        // mayus/minus via $in de strings) para consolidarlas.
        const entradasFamilia = await db_support.TicketEventoDB.find({
            id_organizacion, id_evento,
            familia: { $in: familiasExactas },
            estado: { $in: ['activa', 'inactiva'] },
        }).lean();

        // 4a) ESTUDIANTES: re-vincular al nombre combinado los que esten bajo otra
        // variante (conservan su folio). La regeneracion recombina jornada/bloques.
        const estudiantesAReVincular = entradasFamilia.filter(t => t.tipo === 'estudiante' && mergeNorm(t.familia) !== nuevoNombreFamilia);
        if (estudiantesAReVincular.length) {
            const folios = estudiantesAReVincular.map(t => t.folio);
            acciones.push({ tipo: 'entradas', detalle: `Re-vincular estudiante(s) a "${nuevoNombreFamilia}" (conserva folios ${JSON.stringify(folios)}).` });
            if (apply) {
                await db_support.TicketEventoDB.updateMany(
                    { id_organizacion, id_evento, _id: { $in: estudiantesAReVincular.map(t => t._id) } },
                    { $set: { familia: nuevoNombreFamilia }, $push: { historial: { accion: 'correccion', descripcion: `merge de familia: re-vinculado a "${nuevoNombreFamilia}"` } } }
                );
            }
        }

        // 4b) APODERADO/INVITADO: colapsar DUPLICADOS. Por cada (nombre_completo+
        // tipo) se conserva UNA entrada (preferir 'activa'; a igualdad, menor folio)
        // y se ANULAN las demas. Cubre el caso de sets duplicados aunque esten bajo
        // variantes de 'familia' que solo difieren en mayus/minus. Nunca toca 'usada'
        // (ya excluidas por el filtro de estado).
        const apoInv = entradasFamilia.filter(t => t.tipo === 'apoderado' || t.tipo === 'invitado');
        const grupos = new Map(); // clave: tipo|nombre_lower -> [tickets]
        for (const t of apoInv) {
            const clave = `${t.tipo}|${mergeNormLower(t.nombre_completo)}`;
            if (!grupos.has(clave)) grupos.set(clave, []);
            grupos.get(clave).push(t);
        }
        const foliosAnular = [];
        for (const [, lista] of grupos) {
            if (lista.length <= 1) continue;
            // Orden: activas primero, luego menor folio. Se conserva el primero.
            lista.sort((a, b) => {
                const pa = a.estado === 'activa' ? 0 : 1;
                const pb = b.estado === 'activa' ? 0 : 1;
                return pa - pb || (a.folio - b.folio);
            });
            foliosAnular.push(...lista.slice(1).map(t => t.folio));
        }
        if (foliosAnular.length) {
            acciones.push({ tipo: 'entradas', detalle: `Anular ${foliosAnular.length} apoderado/invitado duplicados (folios ${JSON.stringify(foliosAnular.sort((a, b) => a - b))}). Se excluyen las usadas.` });
            if (apply) {
                await db_support.TicketEventoDB.updateMany(
                    { id_organizacion, id_evento, folio: { $in: foliosAnular } },
                    { $set: { estado: 'anulada', usado: false, fecha_uso: null, validado_por: null }, $push: { historial: { accion: 'anulacion', descripcion: 'merge de familia: apoderado/invitado duplicado' } } }
                );
            }
        }

        // 4c) Las entradas apoderado/invitado que se CONSERVAN pero esten bajo otra
        // variante de 'familia' se re-vinculan al nombre combinado.
        const foliosAnularSet = new Set(foliosAnular);
        const apoInvAReVincular = apoInv.filter(t => !foliosAnularSet.has(t.folio) && mergeNorm(t.familia) !== nuevoNombreFamilia);
        if (apoInvAReVincular.length) {
            acciones.push({ tipo: 'entradas', detalle: `Re-vincular ${apoInvAReVincular.length} apoderado/invitado a "${nuevoNombreFamilia}" (folios ${JSON.stringify(apoInvAReVincular.map(t => t.folio))}).` });
            if (apply) {
                await db_support.TicketEventoDB.updateMany(
                    { id_organizacion, id_evento, _id: { $in: apoInvAReVincular.map(t => t._id) } },
                    { $set: { familia: nuevoNombreFamilia }, $push: { historial: { accion: 'correccion', descripcion: `merge de familia: re-vinculado a "${nuevoNombreFamilia}"` } } }
                );
            }
        }

        // 5) Actualizar el indice inverso: nombre_familia combinado + hermanos[]
        // unificados para todos los miembros.
        acciones.push({ tipo: 'indice', detalle: `Set nombre_familia="${nuevoNombreFamilia}" y hermanos=${JSON.stringify(nombresHermanos)} para ${nombresHermanos.length} documento(s).` });
        if (apply) {
            for (const hermano of nombresHermanos) {
                await db_support.hermanosMapDB.updateOne(
                    { id: rxFamiliaMerge(hermano) },
                    { $set: { nombre_familia: nuevoNombreFamilia, hermanos: nombresHermanos } }
                );
            }
        }

        // 6) Regenerar/consolidar las entradas de la familia combinada (jornada y
        // bloques mezclados) usando generarEntradaParaFamilia con un supervisor.
        const infoEvento = await db_support.EventDB.findOne({ id_evento }).lean();
        if (!infoEvento) {
            acciones.push({ tipo: 'entradas', detalle: `No existe el evento "${id_evento}"; no se regeneran entradas.` });
        } else {
            const curso_bloques = infoEvento.cursoBloqueMap || {};
            const imagen_ticket_path = infoEvento.imagen_ticket_path || '';
            const correosPadres = [...new Set(docsIndice.flatMap(d => d.apoderado_email || []).filter(Boolean))];
            const emailSupervisor = await obtenerEmailSupervisorMerge([user_email, ...correosPadres]);
            acciones.push({ tipo: 'entradas', detalle: `Regenerar/consolidar entradas de "${nuevoNombreFamilia}" (bloques/jornada combinados)${emailSupervisor ? '' : ' [sin supervisor: no se reactivaran existentes]'}.` });
            if (apply) {
                const semilla = nombresHermanos[0];
                const generados = await api_entradas.generarEntradaParaFamilia(
                    id_organizacion, id_evento, imagen_ticket_path, semilla, curso_bloques, false, emailSupervisor
                );
                acciones.push({ tipo: 'entradas', detalle: `Entradas regeneradas para: ${JSON.stringify(generados || [])}` });
            }
        }

    return {
        ok: true,
        status: 200,
        message: apply ? 'Familia unificada y entradas regeneradas' : 'Simulacion (dry-run): no se escribio nada',
        mode,
        nombre_familia: nuevoNombreFamilia,
        hermanos: nombresHermanos,
        acciones,
    };
}

// Endpoint HTTP: valida el body y delega en unificarFamilia.
router.post('/familias/merge', apiKeyAuth, async (req, res) => {
    const tag = '[POST /api/familias/merge]';
    try {
        const { id_organizacion, id_evento, user_email } = req.body;
        let estudiantes = req.body.estudiantes;
        const mode = req.body.mode === 'dry' ? 'dry' : 'apply';

        if (typeof estudiantes === 'string') {
            try { estudiantes = JSON.parse(estudiantes); }
            catch (e) { estudiantes = estudiantes.split(',').map(s => s.trim()).filter(Boolean); }
        }
        if (!Array.isArray(estudiantes)) {
            return res.status(400).json({ error: 'El campo "estudiantes" debe ser un arreglo.' });
        }
        if (!id_organizacion) {
            return res.status(400).json({ error: 'El campo "id_organizacion" es obligatorio.' });
        }
        if (!user_email) {
            return res.status(400).json({ error: 'El campo "user_email" es obligatorio.' });
        }

        const resultado = await unificarFamilia({ id_organizacion, id_evento, estudiantes, user_email, mode });
        return res.status(resultado.status || 200).json(resultado);
    } catch (error) {
        console.error(`${tag} Error al procesar la solicitud:`, error);
        res.status(500).json({ message: 'Error interno del servidor', error: error.message || String(error) });
    }
});

module.exports = router;
module.exports.unificarFamilia = unificarFamilia;
