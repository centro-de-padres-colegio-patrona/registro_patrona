const express = require('express');
const router = express.Router();
const Familia = require('../models/Familia');

// Validador sencillo
function validarCampos(lista, camposObligatorios) {
  return lista.every(item => 
    camposObligatorios.every(campo => item[campo] && item[campo].trim() !== '')
  );
}

router.post('/registro', async (req, res) => {
  const { hijos, padres, invitados } = req.body;

  // Validar hijos
  if (!validarCampos(hijos, ['nombre', 'apellido', 'run', 'curso'])) {
    return res.status(400).json({ error: 'Faltan campos obligatorios en los hijos.' });
  }

  // Validar padres
  if (!validarCampos(padres, ['nombre', 'apellido', 'run', 'correo', 'parentesco'])) {
    return res.status(400).json({ error: 'Faltan campos obligatorios en los padres.' });
  }

  // Validar invitados (correo y teléfono son opcionales)
  if (!validarCampos(invitados, ['nombre', 'apellido', 'run', 'correo'])) {
    return res.status(400).json({ error: 'Faltan campos obligatorios en los invitados.' });
  }

  try {
    const familia = new Familia({ hijos, padres, invitados });
    await familia.save();
    res.status(201).json({ mensaje: 'Registro exitoso 🎉' });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar los datos.' });
  }
});

module.exports = router;
