const mongoose = require('mongoose');

const hijoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  run: { type: String, required: true },
  curso: { type: String, required: true },
  seccion: { type: String, required: true }
});

const padreSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  run: { type: String, required: true },
  correo: { type: String, required: true },
  telefono: String,
  parentesco: { type: String, required: true }
});

const invitadoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  run: { type: String, required: true },
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
});


/// --------------------------------
const cursoSchema = new mongoose.Schema({
  id: String,
  estudiantesCurso: Object,      // e.g., "Básico", "Medio"
  listaCurso: Array,       // e.g., 1, 2, 3...
  prof_jefe: Array,
  numeroInvitados: Number,
  bloque: Object,
});



/// --------------------------------------
const registrados = new mongoose.Schema({
  nombre: { type: String, required: true },
  run: { type: String, required: true },
  curso: { type: String, required: true },
  seccion: { type: String, required: true },
  tipo: { type: String, required: true },
  parents: [{ type: String, required: true}]
});


const uri = "mongodb+srv://centrodepadres:HGnFAObh72WfE5Sv@cluster0.fkoa22c.mongodb.net/cpa_patrona?retryWrites=true&w=majority&appName=Cluster0"

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Conexión exitosa a MongoDB Atlas'))
.catch(err => console.error('Error de conexión:', err));

//module.exports = mongoose.model('users', userSchema);

module.exports.usersDB = mongoose.model('users', userSchema);
module.exports.listadoCursosDB = mongoose.model('listado_cursos', cursoSchema);
//module.exports = mongoose.model('Familia', familiaSchema);

