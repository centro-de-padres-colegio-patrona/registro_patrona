// =============================================================================
// set_representante.js
// -----------------------------------------------------------------------------
// Marca o desmarca a un apoderado como "representante de la familia"
// (campo padres[].es_usuario_cuenta) directamente en la base de datos.
//
// Escribe en la BD cuyo anio se define en .env.local (DATABASE_YEAR_NAME),
// es decir la MISMA base que usa el servidor (produccion: cpa_patrona_2026).
//
// USO (desde la raiz del proyecto, en PowerShell):
//
//   node backend/tools/set_representante.js <correo> <accion> [--force]
//
//   <correo>  : email del apoderado (case-insensitive)
//   <accion>  : marcar   -> es_usuario_cuenta = true
//               desmarcar -> es_usuario_cuenta = false
//   --force   : (opcional) permite marcar a un 2do representante aunque la
//               familia ya tenga uno. Sin --force, si ya hay otro representante
//               el script AVISA y no hace el cambio (para no dejar 2 a la vez).
//
// EJEMPLOS:
//   node backend/tools/set_representante.js caro.pino.marin@gmail.com marcar
//   node backend/tools/set_representante.js luciopb76@gmail.com desmarcar
//
// NOTA sobre familias con 2 apoderados en el MISMO documento:
//   Si quieres TRASPASAR el representante (marcar a uno y desmarcar al otro),
//   corre el script dos veces:
//     node backend/tools/set_representante.js nuevo@correo.com marcar --force
//     node backend/tools/set_representante.js viejo@correo.com desmarcar
//   (usa --force en el "marcar" porque hasta que no desmarques al otro, la
//    familia tendra 2 momentaneamente).
// =============================================================================

const mongoose = require('mongoose');
const db_support = require('../db_support');

function rxEmail(e) {
  return new RegExp('^' + e.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
}

async function main() {
  const [, , correoArg, accionArg, ...flags] = process.argv;
  const force = flags.includes('--force');

  // Validar argumentos
  if (!correoArg || !accionArg || !['marcar', 'desmarcar'].includes(accionArg)) {
    console.log('\nUso: node backend/tools/set_representante.js <correo> <marcar|desmarcar> [--force]\n');
    console.log('Ejemplos:');
    console.log('  node backend/tools/set_representante.js caro.pino.marin@gmail.com marcar');
    console.log('  node backend/tools/set_representante.js luciopb76@gmail.com desmarcar\n');
    process.exit(1);
  }

  const nuevoValor = accionArg === 'marcar'; // true si marcar, false si desmarcar
  const rx = rxEmail(correoArg);
  const year = process.env.DATABASE_YEAR_NAME || '';

  console.log(`\n>>> Base de datos objetivo: cpa_patrona${year ? '_' + year : ''}  (DATABASE_YEAR_NAME="${year}")`);
  console.log('>>> Si esta no es la base que esperas, revisa .env.local antes de continuar.\n');

  await db_support.connectToDB(year);
  await new Promise(r => setTimeout(r, 1500)); // esperar conexion

  try {
    // El correo puede estar como:
    //  (a) email del documento de usuario, o
    //  (b) correo de un objeto dentro de padres[] (aunque el doc sea de otro).
    // Buscamos el documento que contenga ese correo en su arreglo padres.
    let user = await db_support.usersDB.findOne({ 'padres.correo': rx }).lean();
    if (!user) {
      // Respaldo: buscar por email del documento.
      user = await db_support.usersDB.findOne({ email: rx }).lean();
    }

    if (!user) {
      console.log(`\n[ERROR] No se encontro ningun usuario/apoderado con el correo: ${correoArg}\n`);
      return;
    }

    const padres = user.padres || [];
    const idx = padres.findIndex(p => (p.correo || '').toLowerCase().trim() === correoArg.toLowerCase().trim());
    if (idx === -1) {
      console.log(`\n[ERROR] El correo ${correoArg} no aparece en la lista de padres del documento (email doc: ${user.email}).\n`);
      return;
    }

    console.log(`\nDocumento de usuario: ${user.email}`);
    console.log('[ANTES] padres:');
    padres.forEach((p, i) => console.log(`  [${i}] <${p.correo}> es_usuario_cuenta=${p.es_usuario_cuenta}`));

    // Verificacion de seguridad al MARCAR: evitar dejar 2 representantes.
    if (nuevoValor === true && !force) {
      const otrosRep = padres.filter((p, i) => i !== idx && p.es_usuario_cuenta === true).map(p => p.correo);
      if (otrosRep.length > 0) {
        console.log(`\n[AVISO] La familia ya tiene otro representante: ${JSON.stringify(otrosRep)}`);
        console.log('        No se aplico el cambio para no dejar 2 representantes.');
        console.log('        Si es un traspaso, primero desmarca al otro, o vuelve a correr con --force.\n');
        return;
      }
    }

    if (padres[idx].es_usuario_cuenta === nuevoValor) {
      console.log(`\n[OK] Sin cambios: ${correoArg} ya estaba con es_usuario_cuenta=${nuevoValor}.\n`);
      return;
    }

    // Update dirigido por INDICE del padre (no por correo), para tocar solo ese
    // elemento aunque hubiera correos repetidos. No revalida el documento completo.
    const setField = {};
    setField[`padres.${idx}.es_usuario_cuenta`] = nuevoValor;
    const result = await db_support.usersDB.updateOne(
      { _id: user._id },
      { $set: setField },
      { runValidators: false }
    );

    const after = await db_support.usersDB.findOne({ _id: user._id }).lean();
    console.log(`\nupdate -> matched:${result.matchedCount} modified:${result.modifiedCount}`);
    console.log('[DESPUES] padres:');
    (after.padres || []).forEach((p, i) => console.log(`  [${i}] <${p.correo}> es_usuario_cuenta=${p.es_usuario_cuenta}`));
    const reps = (after.padres || []).filter(p => p.es_usuario_cuenta === true).map(p => p.correo);
    console.log('Representante(s) resultante(s):', reps, '\n');
  } catch (e) {
    console.error('[ERROR]', e.message || e);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
