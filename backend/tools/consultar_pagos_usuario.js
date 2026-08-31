// Herramienta de consulta (solo lectura): lista los pagos asociados a un
// usuario/apoderado para validar movimientos en "Mis Pagos".
//
// Resuelve los estudiantes de la familia del apoderado (via hermanosMap) y busca
// en la coleccion `pagos` (pagosDB) todos los registros cuyo `id` sea uno de esos
// estudiantes. Muestra tipo, subtipo, monto, fecha, metodo y commerce_order.
//
// Uso:
//   node backend/tools/consultar_pagos_usuario.js <email_apoderado>
//   node backend/tools/consultar_pagos_usuario.js --estudiante "<nombre estudiante>"
//
// Requiere DATABASE_YEAR_NAME y credenciales DB en .env.local.
const mongoose = require('mongoose');
const dns = require('dns');
// Igual que db_support.js: DNS de Google/Cloudflare para evitar bloqueos SRV.
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const config_env = require('../../src/setup/config/env.js');

function buildUri() {
  const year = config_env.DATABASE_YEAR_NAME ? `_${config_env.DATABASE_YEAR_NAME}` : '';
  return config_env.DB_URL
    .replace('${db_user}', config_env.DB_USER)
    .replace('${db_password}', config_env.DB_PASSWORD)
    .replace('${database_name}', `cpa_patrona${year}`);
}

function normaliza(s) {
  return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Uso: node backend/tools/consultar_pagos_usuario.js <email> | --estudiante "<nombre>"');
    process.exit(1);
  }

  await mongoose.connect(buildUri(), { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;

  let estudiantes = [];

  if (args[0] === '--estudiante') {
    estudiantes = [args.slice(1).join(' ')];
  } else {
    const email = args[0];
    const rx = new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    const familias = await db.collection('nombreHermanosMap')
      .find({ apoderado_email: { $elemMatch: { $regex: rx } } }).toArray();
    if (!familias.length) {
      console.log('No se encontraron familias para el apoderado:', email);
    }
    estudiantes = [...new Set(
      familias.flatMap(f => (Array.isArray(f.hermanos) && f.hermanos.length ? f.hermanos : (f.id ? [f.id] : [])))
    )];
    console.log('Apoderado:', email);
    console.log('Familias:', familias.map(f => f.nombre_familia).join(' | ') || '(ninguna)');
  }

  console.log('Estudiantes:', estudiantes.join(' | ') || '(ninguno)');
  console.log('-------------------------------------------');

  let total = 0;
  for (const est of estudiantes) {
    const rxEst = new RegExp('^' + normaliza(est).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    const pagos = await db.collection('pagos').find({ id: rxEst }).toArray();
    console.log(`\n### ${est}  (pagos: ${pagos.length})`);
    pagos.forEach(p => {
      total += (p.monto || 0);
      console.log(JSON.stringify({
        tipo: p.tipo, subtipo: p.subtipo, monto: p.monto, fecha: p.fecha,
        payment_method: p.payment_method, commerce_order: p.commerce_order,
        cuota_cpa: p.cuota_cpa, num_folio: p.num_folio, comentarios: p.comentarios
      }));
    });
  }
  console.log('\n-------------------------------------------');
  console.log('Monto total sumado:', total);

  await mongoose.disconnect();
}

main().catch(err => { console.error('ERROR:', err); process.exit(1); });
