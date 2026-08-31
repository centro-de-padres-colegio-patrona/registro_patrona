// =============================================================================
// limpiar_espacios_estudiante.js
// -----------------------------------------------------------------------------
// Corrige nombres de estudiante que quedaron guardados con espacios extra
// (al inicio/fin o espacios internos duplicados), lo que rompe la deteccion
// de hermanos y provoca el error "Se produjo un problema leyendo las entradas".
//
// Limpia el nombre en las 3 colecciones donde se usa como clave:
//   1) usersDB.hijos[].nombre
//   2) TicketEventoDB.nombre_completo
//   3) hermanosMapDB.id  y  hermanosMapDB.hermanos[]
//      (ademas fusiona el documento duplicado con-espacio hacia el sin-espacio,
//       conservando los apoderado_email)
//
// USO (desde la raiz del proyecto, PowerShell):
//
//   Ver que haria (sin escribir):
//     node backend/tools/limpiar_espacios_estudiante.js "<nombre del estudiante>" --dry
//
//   Aplicar cambios:
//     node backend/tools/limpiar_espacios_estudiante.js "<nombre del estudiante>" --apply
//
//   El <nombre> puede ir con o sin el espacio extra; el script normaliza.
//
// EJEMPLO:
//   node backend/tools/limpiar_espacios_estudiante.js "guevara swinburn vicente" --dry
//   node backend/tools/limpiar_espacios_estudiante.js "guevara swinburn vicente" --apply
//
// NOTA: escribe en la MISMA base que el servidor (segun DATABASE_YEAR_NAME).
//       Usa updateOne con runValidators:false para no chocar con datos legacy.
// =============================================================================

const mongoose = require('mongoose');
const db_support = require('../db_support');

const norm = (s) => (s || '').trim().replace(/\s+/g, ' ');
// Regex que matchea el nombre normalizado permitiendo espacios extra en BD.
function rxNombre(nombreNorm) {
  const escaped = nombreNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp('^\\s*' + escaped + '\\s*$', 'i');
}

async function main() {
  const [, , nombreArg, modo] = process.argv;
  const apply = modo === '--apply';
  const dry = modo === '--dry' || !modo;

  if (!nombreArg || (!apply && !dry) || (modo && modo !== '--apply' && modo !== '--dry')) {
    console.log('\nUso: node backend/tools/limpiar_espacios_estudiante.js "<nombre>" <--dry|--apply>\n');
    console.log('Ejemplos:');
    console.log('  node backend/tools/limpiar_espacios_estudiante.js "guevara swinburn vicente" --dry');
    console.log('  node backend/tools/limpiar_espacios_estudiante.js "guevara swinburn vicente" --apply\n');
    process.exit(1);
  }

  const nombreLimpio = norm(nombreArg);
  const rx = rxNombre(nombreLimpio);
  const year = process.env.DATABASE_YEAR_NAME || '';

  await db_support.connectToDB(year);
  await new Promise(r => setTimeout(r, 1500));

  console.log(`\n===== ${apply ? 'APLICAR' : 'DRY-RUN (sin escribir)'} | estudiante: "${nombreLimpio}" =====\n`);

  try {
    // ---- 1) usersDB.hijos[].nombre ----
    const users = await db_support.usersDB.find({ 'hijos.nombre': rx }).lean();
    console.log(`[usersDB] documentos con el hijo (variantes de espacio): ${users.length}`);
    for (const u of users) {
      const hijo = (u.hijos || []).find(h => rx.test(h.nombre || ''));
      if (hijo && hijo.nombre !== nombreLimpio) {
        console.log(`  - ${u.email}: "${hijo.nombre}" -> "${nombreLimpio}"`);
        if (apply) {
          await db_support.usersDB.updateOne(
            { _id: u._id, 'hijos.nombre': hijo.nombre },
            { $set: { 'hijos.$.nombre': nombreLimpio } },
            { runValidators: false }
          );
        }
      } else if (hijo) {
        console.log(`  - ${u.email}: ya esta limpio`);
      }
    }

    // ---- 2) TicketEventoDB.nombre_completo ----
    const tickets = await db_support.TicketEventoDB.find({ nombre_completo: rx }).lean();
    console.log(`\n[TicketEventoDB] tickets con nombre_completo (variantes de espacio): ${tickets.length}`);
    for (const t of tickets) {
      if (t.nombre_completo !== nombreLimpio) {
        console.log(`  - folio=${t.folio}: "${t.nombre_completo}" -> "${nombreLimpio}"`);
        if (apply) {
          await db_support.TicketEventoDB.updateOne(
            { _id: t._id },
            { $set: { nombre_completo: nombreLimpio } },
            { runValidators: false }
          );
        }
      } else {
        console.log(`  - folio=${t.folio}: ya esta limpio`);
      }
    }

    // ---- 3) hermanosMapDB (id + hermanos[]) con fusion de duplicados ----
    const mapas = await db_support.hermanosMapDB.find({ id: rx }).lean();
    console.log(`\n[hermanosMapDB] documentos con id (variantes de espacio): ${mapas.length}`);
    mapas.forEach(m => console.log(`  - id="${m.id}" apoderado_email=${JSON.stringify(m.apoderado_email)} hermanos=${JSON.stringify(m.hermanos)}`));

    if (mapas.length > 0) {
      // Elegir doc destino: preferir el que YA tiene id limpio; si no, el que tenga apoderados.
      let destino = mapas.find(m => m.id === nombreLimpio)
        || mapas.slice().sort((a, b) => (b.apoderado_email?.length || 0) - (a.apoderado_email?.length || 0))[0];

      // Fusionar apoderado_email y hermanos (limpios y unicos) de todos los duplicados.
      const apoderados = [...new Set(mapas.flatMap(m => m.apoderado_email || []).filter(Boolean))];
      const hermanos = [...new Set(mapas.flatMap(m => (m.hermanos || []).map(norm)).filter(Boolean))];

      console.log(`\n  -> destino id="${destino.id}" quedara como:`);
      console.log(`       id="${nombreLimpio}"`);
      console.log(`       apoderado_email=${JSON.stringify(apoderados)}`);
      console.log(`       hermanos=${JSON.stringify(hermanos)}`);

      if (apply) {
        await db_support.hermanosMapDB.updateOne(
          { _id: destino._id },
          { $set: { id: nombreLimpio, apoderado_email: apoderados, hermanos } },
          { runValidators: false }
        );
        // Eliminar los OTROS documentos duplicados (variantes con espacio).
        const idsAEliminar = mapas.filter(m => String(m._id) !== String(destino._id)).map(m => m._id);
        if (idsAEliminar.length) {
          const del = await db_support.hermanosMapDB.deleteMany({ _id: { $in: idsAEliminar } });
          console.log(`  -> documentos duplicados eliminados: ${del.deletedCount}`);
        }
      }
    }

    // ---- 3b) Limpiar el nombre dentro de hermanos[] de OTROS estudiantes (hermanos) ----
    const otrosConEse = await db_support.hermanosMapDB.find({ hermanos: rx }).lean();
    console.log(`\n[hermanosMapDB] otros docs que listan este nombre en 'hermanos': ${otrosConEse.length}`);
    for (const m of otrosConEse) {
      const nuevos = [...new Set((m.hermanos || []).map(norm))];
      const cambio = JSON.stringify(nuevos) !== JSON.stringify(m.hermanos);
      if (cambio) {
        console.log(`  - id="${m.id}": hermanos ${JSON.stringify(m.hermanos)} -> ${JSON.stringify(nuevos)}`);
        if (apply) {
          await db_support.hermanosMapDB.updateOne(
            { _id: m._id },
            { $set: { hermanos: nuevos } },
            { runValidators: false }
          );
        }
      }
    }

    console.log(`\n===== ${apply ? 'CAMBIOS APLICADOS' : 'FIN DRY-RUN (no se escribio nada)'} =====\n`);
  } catch (e) {
    console.error('[ERROR]', e.message || e);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
