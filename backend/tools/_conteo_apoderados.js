// Script temporal de solo lectura para contar apoderados registrados.
// Reutiliza la config de conexion del proyecto (mismo cluster/BD).
const mongoose = require('mongoose');
const dns = require('dns');
// Igual que db_support.js: usar DNS de Google/Cloudflare para evitar bloqueos
// de ISP en las consultas SRV de Atlas.
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const config_env = require('../../src/setup/config/env.js');

async function main() {
  const year = config_env.DATABASE_YEAR_NAME ? `_${config_env.DATABASE_YEAR_NAME}` : '';
  const db_password = config_env.DB_PASSWORD;
  const db_user = config_env.DB_USER;
  const db_url_template = config_env.DB_URL;
  const database_name = `cpa_patrona${year}`;
  const uri = db_url_template
    .replace('${db_user}', db_user)
    .replace('${db_password}', db_password)
    .replace('${database_name}', database_name);

  console.log('BD:', database_name);
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const db = mongoose.connection.db;

  const usersCol = db.collection('users');
  const totalUsers = await usersCol.countDocuments({});
  const conAlgunPadre = await usersCol.countDocuments({ 'padres.0': { $exists: true } });
  const conAlgunHijo = await usersCol.countDocuments({ 'hijos.0': { $exists: true } });
  const conEmail = await usersCol.countDocuments({ email: { $exists: true, $ne: '' } });
  const correoValidado = await usersCol.countDocuments({ correo_validado: true });

  // Total de padres/apoderados individuales dentro de todos los users
  const aggPadres = await usersCol.aggregate([
    { $project: { n: { $size: { $ifNull: ['$padres', []] } } } },
    { $group: { _id: null, total: { $sum: '$n' } } }
  ]).toArray();
  const totalPadresIndividuales = aggPadres[0] ? aggPadres[0].total : 0;

  // Familias en hermanosMap con apoderado_email asignado
  const hermanosCol = db.collection('nombreHermanosMap');
  const totalFamilias = await hermanosCol.countDocuments({});
  const familiasConApoderado = await hermanosCol.countDocuments({
    apoderado_email: { $exists: true, $not: { $size: 0 } }
  });

  console.log('--- Colección users ---');
  console.log('Total documentos users:', totalUsers);
  console.log('users con email:', conEmail);
  console.log('users con al menos un padre/apoderado:', conAlgunPadre);
  console.log('users con al menos un hijo:', conAlgunHijo);
  console.log('users con correo_validado=true:', correoValidado);
  console.log('Total padres/apoderados individuales (sumando arrays):', totalPadresIndividuales);
  console.log('--- Colección nombreHermanosMap (familias) ---');
  console.log('Total familias:', totalFamilias);
  console.log('Familias con apoderado_email asignado:', familiasConApoderado);

  await mongoose.disconnect();
}

main().catch(err => { console.error('ERROR:', err); process.exit(1); });
