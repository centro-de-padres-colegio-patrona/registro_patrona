const fs = require('fs');
const path = require('path');

// Si existe db_support.local.js, usarlo como mock local (ignorado por Git)
const localMockPath = path.join(__dirname, 'db_support.local.js');
if (fs.existsSync(localMockPath)) {
  module.exports = require('./db_support.local');
} else {

const mongoose = require('mongoose');
const test_api = require('./test_api');

let dbUri = '';

const hijoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  rut: { type: String, required: true },
  curso: { type: String, required: true },
  seccion: { type: String, required: true }
});

const padreSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  rut: { type: String, required: true },
  correo: { type: String, required: true },
  telefono: String,
  parentesco: { type: String, required: true },
  es_usuario_cuenta: { type: Boolean, default: false }
});

const invitadoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  rut: { type: String, required: true },
  correo: { type: String, required: true },
  telefono: String,
  parentesco: { type: String, required: true }
});

const familiaSchema = new mongoose.Schema({
  hijos: [hijoSchema],
  padres: [padreSchema],
  invitados: [invitadoSchema],
  fechaRegistro: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  googleId: String,
  displayName: String,
  email: String,
  photo: String,
  hijos: [hijoSchema],
  padres: [padreSchema],
  invitados: [invitadoSchema],
  fechaRegistro: { type: Date, default: Date.now },
  pagos: Object,
  correoEntradas: Object,
  estado_pago: Object,
  jornadasFiesta: Object,
  entradas_enviadas: Boolean,
  notificacion_enviada: Boolean,
  fecha_notificacion: Date,
  fecha_envio_entradas: Date,
  correo_validado: Boolean,
  password: String,
  intentosFallidos: Number,
  bloqueadoHasta: Date,
  passwordHash: String,
});

  const nombreCursoSchema = new mongoose.Schema({
    id: String,
    value: String,
  });

  const compromisosPagoSchema = new mongoose.Schema({
    id: String,
    nombre: String,
    descripcion: String,
    monto: Number,
    tipo: String,
    limite_maximo_por_cliente: String,
    clientes: Array,
    beneficios: Array
  });

  const hermanosMapSchema = new mongoose.Schema({
    id: String,
    nombre_familia: String,
    hermanos: Array,
    serial: Number,
    apoderado_email: Array,
  });

const bingo_solidario = new mongoose.Schema({ 
  email: String,
  });

  const deliverySchema = new mongoose.Schema({
  familia: String,
  nombre_completo: String, 
  bloques: Array, 
  serial: Number, 
  total: Number, 
  num_listado: Number, 
  curso: String, 
  jornada: String, 
  tipo: String,
  nombreArchivo: String,
  fecha_delivery: { type: Date, default: Date.now },
  hora_delivery: {
    type: String,
    default: () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }});

/// --------------------------------
const cursoSchema = new mongoose.Schema({
  id: String,
  estudiantesCurso: Object,      // e.g., "Básico", "Medio"
  listaCurso: Array,       // e.g., 1, 2, 3...
  prof_jefe: Array,
  numeroInvitados: Number,
  bloque: Object,
});

const commerceSchema = new mongoose.Schema({
  apiKey: String,
  commerceOrder: String,
  currency: String,
  amount: Number,
  email: String,
  paymentMethod: Number,
  urlConfirmation: String,
  urlReturn: String,
  optional: String,
  timeout: Number,
  checkout_timeout: Number,
  merchantId: String,
  payment_currency: String,
  timestamp: String,
  timeout: Number,
  merchantId: String,
  sign: String,
  token: String,
  url: String,
  flowOrder: String,
  pending_info: Object,
  paymentData: Object,
  status: String,
  statusText: String,
  requestDate: String,
  
});

const pagosSchema = new mongoose.Schema({
  id: String,
  num_folio: Number,
  tipo: String,
  subtipo: String,
  cuota_cpa: Boolean,
  monto: Number,
  cantidad_agendas: Number,
  entrega_agendas: Number,
  fecha: String,
  comentarios: String,
  entradas_pagadas: Number,
  payment_method: String,
  commerce_order: String,
});

/// --------------------------------------
const registradosSchema = new mongoose.Schema({
  nombre: String,
  rut: String,
  curso: String,
  seccion: String,
  tipo: String,
  parents: [String]
});

const cursoBloqueMapSchema = new mongoose.Schema({
  id: String,
  bloque: String,
  jornada: String,
  color: String
});

const registroEntradasSchema = new mongoose.Schema({
  id: String,
  registros: Object,
});

const commerceOrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Ejemplo: 'pagos_flow'
  secuencia: { type: Number, default: 0 }
});

const perfilSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  rut: { type: String, required: true },
  nombre_completo: { type: String, required: true },
  rol: { type: String, required: true, enum: ['administrador', 'apoderado', 'validador', 'supervisor'] },
  activo: { type: Boolean, default: true },
  fecha_creacion: { type: Date, default: Date.now }
});

const EventoSchema = new mongoose.Schema({
  id_evento: { 
    type: String, 
    required: true, 
    unique: true 
  },
  index_evento: { 
    type: Number,
    unique: true
  },
  total_entradas: { 
    type: Number, 
    default: 0 
  },
  nombre: { type: String, required: true },
  fecha: { type: Date, required: true },
  descripcion: { type: String },
  lugar: { type: String },
  tipo_evento: { type: String, enum: ['fiesta', 'bingo', 'otro'] },
  hora_inicio: { type: String },
  hora_termino: { type: String },
  hora_apertura_puertas: { type: String },
  entradas_disponibles: { type: Number, default: 0 },
  entradas_vendidas: { type: Number, default: 0 },
  entradas_usadas: { type: Number, default: 0 },
  precio_entrada: { type: Number, default: 0 },
  url_imagen: { type: String },
  url_imagen_ticket: { type: String },
  imagen_png: { type: Buffer },
  imagen_ticket_png: { type: Buffer },
  imagen_path: { type: String },
  imagen_ticket_path: { type: String },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: Date.now }
});

// Middleware para autoincrementar el index_evento globalmente
EventoSchema.pre('save', async function (next) {
  const doc = this;
  if (doc.isNew) {
    try {
      // Usamos el modelo CommerceOrders como generador de secuencias generales
      const secuenciaActualizada = await mongoose.model('CommerceOrders').findOneAndUpdate(
        { id: 'secuencia_eventos_global' },
        { $inc: { secuencia: 1 } },
        { new: true, upsert: true }
      );
      doc.index_evento = secuenciaActualizada.secuencia;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

const EventDB = mongoose.model('eventos', EventoSchema, 'eventos');


const ticketEventoSchema = new mongoose.Schema({
  id_evento: { type: String, required: true },
  folio: { type: Number, unique: true },
  familia: { type: String, required: true },
  nombre_completo: String,
  tipo: String,
  jornada: String,
  curso: String,
  bloque: String,
  num_listado: Number,
  total: Number,
  fecha_generacion: { type: Date, default: Date.now },
  estado: { type: String, default: 'pendiente' },
  fecha_uso: Date,
  validado_por: String,
  imagen_ticket: Buffer
});

// Forzamos que la combinación de id_evento y folio sea única en la BD
ticketEventoSchema.index({ id_evento: 1, folio: 1 }, { unique: true });

// Pre-save Middleware: Autogenerar el correlativo de forma atómica
ticketEventoSchema.pre('save', async function (next) {
  const doc = this;

  // Solo generamos el correlativo si el documento es nuevo
  if (doc.isNew) {
    try {
      const eventoActualizado = await EventDB.findOneAndUpdate(
        { id_evento: doc.id_evento },
        { $inc: { total_entradas: 1 } },
        { 
          new: true,      // Retorna el documento modificado (con el número ya incrementado)
          upsert: false   // El evento debiera existir previamente; no queremos crear uno nuevo aquí
        }
      );

      if (!eventoActualizado) {
        return next(new Error(`El evento con id_evento '${doc.id_evento}' no existe.`));
      }
      
      // Asignamos el número correlativo generado al ticket actual
      doc.folio = eventoActualizado.total_entradas;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

const TicketEventoDB = mongoose.model('TicketEvento', ticketEventoSchema, 'ticketEventos');





async function connectToDB(year = '', url_server = 'http://localhost:5001') {
  //return;
  const db_year = year ? `_${year}` : '';
  const db_password = 'tPyw2Cvb2Hco8HM3'
  const db_user = 'lherreramena_db_user'
  const db_uri = `mongodb+srv://${db_user}:${db_password}@old-data.g2qp95c.mongodb.net/cpa_patrona${db_year}?retryWrites=true&w=majority&appName=old-data`
  dbUri = db_uri;
  console.log(`Conectando a la base de datos url: ${db_uri}`);
  try {
    await mongoose.connect(db_uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Conexión exitosa a MongoDB Atlas');
    test_api.lauch_test_api(500, url_server, db_uri);
  } catch (err) {
    console.error('Error de conexión:', err);
  }
}

//module.exports = mongoose.model('users', userSchema);
module.exports.connectToDB = connectToDB;

module.exports.usersDB = mongoose.model('users', userSchema);
module.exports.listadoCursosDB = mongoose.model('listado_cursos', cursoSchema);
module.exports.pagosDB = mongoose.model('pagos', pagosSchema);
module.exports.cursoBloqueMap = mongoose.model('cursoBloqueMap', cursoBloqueMapSchema);
module.exports.registroEntradasDB = mongoose.model('registro_entradas', registroEntradasSchema);
module.exports.deliveryDB = mongoose.model('delivery_entradas', deliverySchema);
module.exports.hermanosMapDB = mongoose.model('nombreHermanosMap', hermanosMapSchema, 'nombreHermanosMap');
module.exports.nombreCursoMapDB = mongoose.model('nombreCursoMap', nombreCursoSchema, 'nombreCursoMap');
module.exports.compromisosPagoDB = mongoose.model('compromisosPagoApoderados', compromisosPagoSchema, 'compromisosPagoApoderados');
module.exports.paymentOrdersDB = mongoose.model('paymentOrders', commerceSchema, 'paymentOrders');
module.exports.commerceOrderDB = mongoose.model('CommerceOrders', commerceOrderSchema, 'CommerceOrders');
module.exports.perfilesDB = mongoose.model('perfiles', perfilSchema, 'perfiles');
module.exports.EventDB = EventDB;
module.exports.TicketEventoDB = TicketEventoDB;
module.exports.dbUri = dbUri;
//module.exports.ticketsDB = mongoose.model('tickets', ticketSchema, 'tickets');

} // fin else (conexión Atlas)
