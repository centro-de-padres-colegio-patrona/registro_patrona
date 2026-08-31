// Script temporal de solo lectura para inspeccionar un usuario por email.
// Uso: node backend/tools/_inspeccionar_usuario.js <email>
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const config_env = require('../../src/setup/config/env.js');

async function main() {
  const emailArg = process.argv[2];
  if (!emailArg) { console.error('Falta email. Uso: node ... <email>'); process.exit(1); }

  const year = config_env.DATABASE_YEAR_NAME ? `_${config_env.DATABASE_YEAR_NAME}` : '';
  const uri = config_env.DB_URL
    .replace('${db_user}', config_env.DB_USER)
    .replace('${db_password}', config_env.DB_PASSWORD)
    .replace('${database_name}', `cpa_patrona${year}`);

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;

  // Busqueda case-insensitive del email
  const rx = new RegExp('^' + emailArg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
  const user = await db.collection('users').findOne({ email: rx });

  if (!user) {
    console.log('No se encontro usuario con email:', emailArg);
  } else {
    console.log('email:', user.email);
    console.log('displayName:', user.displayName);
    console.log('correo_validado:', user.correo_validado);
    console.log('hijos:', JSON.stringify(user.hijos, null, 2));
    console.log('padres (resumen):', (user.padres || []).map(p => ({ nombre: p.nombre, apellido: p.apellido, correo: p.correo })));
  }

  // Ademas, verificar el listado del curso III Medio B (id esperado: 3MB)
  const cursoDoc = await db.collection('listado_cursos').findOne({ id: '3MB' });
  console.log('\n--- listado_cursos id=3MB ---');
  if (!cursoDoc) {
    console.log('NO existe documento con id 3MB');
    // listar ids que empiecen con 3M
    const cursos3M = await db.collection('listado_cursos').find({ id: /^3M/ }).project({ id: 1 }).toArray();
    console.log('ids que empiezan con 3M:', cursos3M.map(c => c.id));
  } else {
    console.log('id:', cursoDoc.id);
    console.log('listaCurso length:', Array.isArray(cursoDoc.listaCurso) ? cursoDoc.listaCurso.length : 'NO ES ARRAY');
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error('ERROR:', err); process.exit(1); });
