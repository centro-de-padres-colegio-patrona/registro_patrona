const mongoose = require('mongoose');

const cursoSchema = new mongoose.Schema({
  id: String,
  estudiantesCurso: Object,      // e.g., "Básico", "Medio"
  listadoCurso: Array,       // e.g., 1, 2, 3...
  prof_jefe: Array
});

module.exports = mongoose.model('listado_cursos', cursoSchema);
