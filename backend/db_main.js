/////////////////////////////////////////////////////////////////////////////////////////////
/// module  : db_main.js
/// created : 2026-07-22
/// autor   : lherrera
/// brief   :
/////////////////////////////////////////////////////////////////////////////////////////////


/////////////////////////////////////////////////////////////////////////////////////////////
/// Packages import
/////////////////////////////////////////////////////////////////////////////////////////////

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');



/////////////////////////////////////////////////////////////////////////////////////////////
/// Owner module import
/////////////////////////////////////////////////////////////////////////////////////////////

const config_env = require('../src/setup/config/env.js');




/////////////////////////////////////////////////////////////////////////////////////////////
/// Module Variables Declaration
/////////////////////////////////////////////////////////////////////////////////////////////

const local_config = {
    'url_server': null
}


/////////////////////////////////////////////////////////////////////////////////////////////
/// Schemas
/////////////////////////////////////////////////////////////////////////////////////////////

const perfilSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  rut: { type: String, required: true },
  nombre_completo: { type: String, required: true },
  rol: { type: String, required: true, enum: ['administrador', 'apoderado', 'validador', 'supervisor'] },
  activo: { type: Boolean, default: true },
  fecha_creacion: { type: Date, default: Date.now }
});

const ubicacionSchema = new mongoose.Schema({
    id_pais : { type: String, required: true},
    id_region: { type: String, required: true},
    id_ciudad: { type: String, required: true},
    id_comuna: { type: String, required: true},
    id_calle: { type: String, required: true},
    numeracion: { type: String, required: true},
    codigo_postal: { type: String}
});

const OrganizacioSchema = new mongoose.Schema({
  id_organizacion: { 
    type: String, 
    required: true, 
    unique: true 
  },
  index_organizacion: { 
    type: Number,
    unique: true
  },
  total_usuarios: { 
    type: Number, 
    default: 0 
  },
  nombre: { type: String, required: true },
  descripcion: { type: String },
  direccion_comercial: { type: ubicacionSchema },
  tipo_organizacion: { type: String, 
        enum: [ 'centro_padres', 'colegio', 'club_deportivo', 'grupo_scout', 'junta__vecinos', 'local_minorista', 'comercial', 'municipalidad'] 
    },
  duracion_database: { type: String, enum: ['mensual', 'anual', 'unica']},
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: Date.now }
});


/////////////////////////////////////////////////////////////////////////////////////////////
/// DB Testting
/////////////////////////////////////////////////////////////////////////////////////////////

async function test_db() {

}

/// DB Conection
/////////////////////////////////////////////////////////////////////////////////////////////

async function connectToDB(year = '', url_server = 'http://localhost:5001') {
  const db_password = config_env.DB_PASSWORD;
  const db_user = config_env.DB_USER;
  const db_uri = config_env.DB_URL;
  const db_database_name = config_env.DB_MAIN_DATABASE_NAME

  console.log(`Conectando a la base de datos url: ${db_uri}`);

  const uri = db_uri.replace('${db_user}', db_user).replace('${db_password}', db_password).replace('${db_database_name}', db_database_name)
  try {
    await mongoose.connect(db_uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Conexión exitosa a MongoDB Atlas');
    test_db();
  } catch (err) {
    console.error('Error de conexión:', err);
  }
}


/////////////////////////////////////////////////////////////////////////////////////////////
/// Variable and Methods Export
/////////////////////////////////////////////////////////////////////////////////////////////

module.exports.connectToDB = connectToDB;
module.exports.hermanosMapDB = mongoose.model('nombreHermanosMap', hermanosMapSchema, 'organizaciones');
module.exports.perfilesDB = mongoose.model('perfiles', perfilSchema, 'perfiles');