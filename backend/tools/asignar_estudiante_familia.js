// =============================================================================
// asignar_estudiante_familia.js
// -----------------------------------------------------------------------------
// Diagnostica y (opcionalmente) repara el vinculo de un ESTUDIANTE con una
// FAMILIA / APODERADO.
//
// En este proyecto NO hay una coleccion de estudiantes independiente. Un
// estudiante queda "asignado a la familia" mediante DOS vinculos que conviven:
//
//   1) Vinculo DIRECTO (embebido): el estudiante vive dentro del documento del
//      apoderado, en usersDB.hijos[]  ->  { nombre, rut, curso, seccion }
//      Los apoderados viven en usersDB.padres[] -> { ..., correo, es_usuario_cuenta }
//      Esto es lo que muestra la tarjeta de views/apoderados.html.
//
//   2) Vinculo CRUZADO (indice inverso): en hermanosMapDB (coleccion
//      'nombreHermanosMap') -> { id: <nombre estudiante>, apoderado_email: [correos] }
//
//   El nexo entre ambas colecciones es el NOMBRE del estudiante
//   (usersDB.hijos[].nombre  <->  hermanosMapDB.id) y el CORREO del apoderado
//   (usersDB.padres[].correo <->  hermanosMapDB.apoderado_email[]).
//
// El endpoint de la app que crea/actualiza este vinculo es POST /api/registro
// (src/server.js): escribe usersDB.{hijos,padres} y hace upsert en hermanosMapDB.
// Este script replica esa logica de sincronizacion para casos manuales.
//
// -----------------------------------------------------------------------------
// USO (desde la raiz del proyecto, PowerShell):
//
//   A) SOLO DIAGNOSTICO (que familia/apoderados tiene un estudiante hoy):
//     node backend/tools/asignar_estudiante_familia.js "<nombre estudiante>"
//     node backend/tools/asignar_estudiante_familia.js "<nombre estudiante>" --diag
//
//   B) ASIGNAR / VINCULAR el estudiante al apoderado <correo>:
//        --dry   : muestra que haria, sin escribir (por defecto si no se pasa --apply)
//        --apply : aplica los cambios
//     node backend/tools/asignar_estudiante_familia.js "<nombre estudiante>" <correo> --dry
//     node backend/tools/asignar_estudiante_familia.js "<nombre estudiante>" <correo> --apply
//
// EJEMPLOS:
//   node backend/tools/asignar_estudiante_familia.js "vargas vargas nicolas alonso"
//   node backend/tools/asignar_estudiante_familia.js "vargas vargas nicolas alonso" daniel.maldonado@gmail.com --dry
//   node backend/tools/asignar_estudiante_familia.js "vargas vargas nicolas alonso" daniel.maldonado@gmail.com --apply
//
// QUE HACE EL MODO ASIGNAR (con --apply):
//   1) Ubica el documento de usuario del apoderado (por padres.correo o por email).
//   2) Si el estudiante no esta en usersDB.hijos[] de ese documento, lo agrega.
//      El curso/seccion se toma de un doc de usuario existente que ya tenga al
//      estudiante, o de hermanosMapDB, o queda vacio para completar luego.
//   3) Sincroniza hermanosMapDB: upsert del doc { id: <nombre> } y agrega TODOS
//      los correos de padres[] del documento al arreglo apoderado_email (sin
//      duplicar), replicando el comportamiento de POST /api/registro.
//
// NOTA: escribe en la MISMA base que el servidor (segun DATABASE_YEAR_NAME de
//       .env.local). Usa updateOne/findOneAndUpdate con runValidators:false para
//       no chocar con datos legacy.
// =============================================================================

const mongoose = require('mongoose');
const db_support = require('../db_support');

// Normaliza nombres/correos: trim + colapsa espacios internos.
const norm = (s) => (s || '').trim().replace(/\s+/g, ' ');
const normLower = (s) => norm(s).toLowerCase();

// Regex para el nombre del estudiante tolerando espacios extra y mayus/minus.
function rxNombre(nombreNorm) {
  const escaped = nombreNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp('^\\s*' + escaped + '\\s*$', 'i');
}
// Regex exacta (case-insensitive) para correo.
function rxEmail(e) {
  return new RegExp('^' + normLower(e).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
}

function imprimirEstadoEstudiante(nombreLimpio, usuariosConHijo, mapa) {
  console.log(`\n----- DIAGNOSTICO estudiante: "${nombreLimpio}" -----`);

  console.log(`\n[usersDB] documentos (familias) que contienen a este estudiante en hijos[]: ${usuariosConHijo.length}`);
  usuariosConHijo.forEach(u => {
    const hijo = (u.hijos || []).find(h => normLower(h.nombre) === normLower(nombreLimpio));
    const rep = (u.padres || []).find(p => p.es_usuario_cuenta === true);
    const correosPadres = (u.padres || []).map(p => p.correo).filter(Boolean);
    console.log(`  * doc email=${u.email}`);
    console.log(`      hijo  : nombre="${hijo ? hijo.nombre : '?'}" rut=${hijo?.rut || '-'} curso=${hijo?.curso || '-'} seccion=${hijo?.seccion || '-'}`);
    console.log(`      padres: ${JSON.stringify(correosPadres)}`);
    console.log(`      representante (es_usuario_cuenta): ${rep ? rep.correo : '(ninguno)'}`);
  });

  console.log(`\n[hermanosMapDB] doc de indice inverso (id = nombre estudiante):`);
  if (!mapa) {
    console.log('  (no existe entrada en hermanosMapDB para este estudiante)');
  } else {
    console.log(`  id="${mapa.id}"`);
    console.log(`  nombre_familia=${mapa.nombre_familia || '-'}`);
    console.log(`  apoderado_email=${JSON.stringify(mapa.apoderado_email || [])}`);
    console.log(`  hermanos=${JSON.stringify(mapa.hermanos || [])}`);
  }
  console.log('');
}

async function main() {
  const argv = process.argv.slice(2);
  // Separar flags de argumentos posicionales.
  const flags = argv.filter(a => a.startsWith('--'));
  const positional = argv.filter(a => !a.startsWith('--'));

  const apply = flags.includes('--apply');
  const soloDiag = flags.includes('--diag') || positional.length < 2;

  const nombreArg = positional[0];
  const correoArg = positional[1]; // opcional; requerido para asignar

  if (!nombreArg) {
    console.log('\nUso:');
    console.log('  Diagnostico:  node backend/tools/asignar_estudiante_familia.js "<nombre estudiante>"');
    console.log('  Asignar    :  node backend/tools/asignar_estudiante_familia.js "<nombre estudiante>" <correo> <--dry|--apply>\n');
    process.exit(1);
  }

  const nombreLimpio = norm(nombreArg);
  const rxN = rxNombre(nombreLimpio);
  const year = process.env.DATABASE_YEAR_NAME || '';

  console.log(`\n>>> Base de datos objetivo: cpa_patrona${year ? '_' + year : ''}  (DATABASE_YEAR_NAME="${year}")`);
  console.log('>>> Si esta no es la base que esperas, revisa .env.local antes de continuar.');

  await db_support.connectToDB(year);
  await new Promise(r => setTimeout(r, 1500)); // esperar conexion

  try {
    // Estado actual del estudiante en ambas colecciones.
    const usuariosConHijo = await db_support.usersDB.find({ 'hijos.nombre': rxN }).lean();
    const mapa = await db_support.hermanosMapDB.findOne({ id: rxN }).lean();

    imprimirEstadoEstudiante(nombreLimpio, usuariosConHijo, mapa);

    // ---- Modo solo diagnostico ----
    if (soloDiag) {
      console.log('===== FIN (modo diagnostico, sin escribir) =====\n');
      return;
    }

    // ---- Modo asignar ----
    console.log(`===== ${apply ? 'APLICAR' : 'DRY-RUN (sin escribir)'} | asignar "${nombreLimpio}" -> ${correoArg} =====`);

    const rxC = rxEmail(correoArg);
    // El correo puede ser el email del documento o un correo dentro de padres[].
    let user = await db_support.usersDB.findOne({ 'padres.correo': rxC }).lean();
    if (!user) user = await db_support.usersDB.findOne({ email: rxC }).lean();

    if (!user) {
      console.log(`\n[ERROR] No se encontro ningun apoderado con el correo: ${correoArg}\n`);
      return;
    }

    console.log(`\nDocumento de familia destino: email=${user.email}`);
    const correosPadres = [...new Set((user.padres || []).map(p => p.correo).filter(Boolean))];
    console.log(`Correos de padres del documento: ${JSON.stringify(correosPadres)}`);

    // ---- 1) usersDB.hijos[]: agregar el estudiante si no esta ----
    const yaTiene = (user.hijos || []).some(h => normLower(h.nombre) === normLower(nombreLimpio));
    if (yaTiene) {
      console.log(`\n[usersDB] El estudiante ya esta en hijos[] de este documento. Sin cambios en users.`);
    } else {
      // Intentar recuperar curso/seccion/rut de otra fuente para no dejarlo vacio.
      let base = { nombre: nombreLimpio, rut: '', curso: '', seccion: '' };
      const otroDoc = usuariosConHijo.find(u => (u.hijos || []).some(h => normLower(h.nombre) === normLower(nombreLimpio)));
      if (otroDoc) {
        const h = otroDoc.hijos.find(x => normLower(x.nombre) === normLower(nombreLimpio));
        base = { nombre: nombreLimpio, rut: h.rut || '', curso: h.curso || '', seccion: h.seccion || '' };
        console.log(`\n[usersDB] curso/seccion/rut recuperados de doc existente (${otroDoc.email}).`);
      } else if (mapa && mapa.nombre_familia) {
        console.log(`\n[usersDB] no se encontro curso/seccion en otro doc; se dejara vacio (completar en la app).`);
      }
      console.log(`[usersDB] se agregara a hijos[]: ${JSON.stringify(base)}`);
      if (apply) {
        await db_support.usersDB.updateOne(
          { _id: user._id },
          { $push: { hijos: base } },
          { runValidators: false }
        );
        console.log('[usersDB] hijo agregado.');
      }
    }

    // ---- 2) hermanosMapDB: upsert del doc y union de apoderado_email ----
    const apoderadosPrevios = mapa ? (mapa.apoderado_email || []) : [];
    const apoderadosFinales = [...new Set([...apoderadosPrevios, ...correosPadres].filter(Boolean))];
    const cambioMapa = JSON.stringify(apoderadosPrevios.slice().sort()) !== JSON.stringify(apoderadosFinales.slice().sort()) || !mapa;

    console.log(`\n[hermanosMapDB] apoderado_email actual : ${JSON.stringify(apoderadosPrevios)}`);
    console.log(`[hermanosMapDB] apoderado_email final  : ${JSON.stringify(apoderadosFinales)}`);
    if (!cambioMapa) {
      console.log('[hermanosMapDB] sin cambios (el/los correo(s) ya estaban).');
    } else if (apply) {
      await db_support.hermanosMapDB.findOneAndUpdate(
        { id: nombreLimpio },
        { $set: { id: nombreLimpio, apoderado_email: apoderadosFinales } },
        { upsert: true, runValidators: false }
      );
      console.log('[hermanosMapDB] documento sincronizado (upsert).');
    }

    // ---- Estado final ----
    if (apply) {
      const userAfter = await db_support.usersDB.findOne({ _id: user._id }).lean();
      const mapaAfter = await db_support.hermanosMapDB.findOne({ id: rxN }).lean();
      const usuariosAfter = await db_support.usersDB.find({ 'hijos.nombre': rxN }).lean();
      console.log('\n----- ESTADO FINAL -----');
      console.log(`[usersDB] hijos[] de ${userAfter.email}: ${JSON.stringify((userAfter.hijos || []).map(h => h.nombre))}`);
      imprimirEstadoEstudiante(nombreLimpio, usuariosAfter, mapaAfter);
      console.log('===== CAMBIOS APLICADOS =====\n');
    } else {
      console.log('\n===== FIN DRY-RUN (no se escribio nada). Repite con --apply para aplicar. =====\n');
    }
  } catch (e) {
    console.error('[ERROR]', e.message || e);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
