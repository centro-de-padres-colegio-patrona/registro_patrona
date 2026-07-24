const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');

const SECRET_API_KEY = config_env.API_KEY;


//// Api Eventos
router.post('/eventos/crear', apiKeyAuth, async (req, res) => {
  try {
    const { id_evento, 
            nombre, 
            fecha, 
            descripcion, 
            hora_inicio,
            hora_termino,
            hora_apertura_puertas,
            imagen_ticket_path,
            cursoBloqueMap
          } = req.body;
    const evento = await db_support.EventDB.find({ id_evento });
    if (evento.length > 0) {
      console.log(`Evento con id_evento ${id_evento} ya existe.`);
      return res.status(400).json({ error: 'Evento ya existe' });
    }

    const nuevoEvento = new db_support.EventDB({
      id_evento,
      nombre,
      fecha: new Date(fecha),
      descripcion,
      hora_inicio,
      hora_termino,
      hora_apertura_puertas,
      imagen_ticket_path,
      cursoBloqueMap
    });

    await nuevoEvento.save();
    console.log(`Evento ${nombre} creado con éxito.`);  
    res.json(evento);
  } catch (error) {
    console.error('[/api/eventos/crear] Error:', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

router.get('/eventos/buscar', apiKeyAuth, async (req, res) => {
  try {
    const { id_evento } = req.query;
    console.log(`/api/eventos/buscar: id_evento: ${id_evento}`);
    const evento = await db_support.EventDB.findOne({ id_evento });
    if (evento.length === 0) {
      console.log(`Evento con id_evento ${id_evento} no encontrado.`);
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    res.json(evento);
  } catch (error) {
    console.error('[/api/eventos/buscar] Error:', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});




module.exports = router;
