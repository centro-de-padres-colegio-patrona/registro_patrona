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

router.put('/eventos/actualizar', apiKeyAuth, async (req, res) => {
  try {
    const { id_evento, ...campos } = req.body;
    if (!id_evento) {
      return res.status(400).json({ error: 'id_evento requerido' });
    }
    const resultado = await db_support.EventDB.findOneAndUpdate(
      { id_evento },
      { $set: campos },
      { new: true }
    );
    if (!resultado) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    console.log(`[/api/eventos/actualizar] Evento ${id_evento} actualizado.`);
    res.json(resultado);
  } catch (error) {
    console.error('[/api/eventos/actualizar] Error:', error);
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
});


router.get('/eventos/max_invitados', apiKeyAuth, async (req, res) => {
  const tag = '[/api/eventos/max_invitados]';
  try {
    const { id_evento , id_organizacion, cursos } = req.query;

    if (!cursos) {
      return res.status(400).json({ error: 'El parámetro cursos es requerido' });
    }
    let cursosArray;
    try {
      cursosArray = JSON.parse(cursos);
    } catch (error) {
      return res.status(400).json({ error: 'El parámetro cursos debe ser un JSON válido', cursos });
    }

    if (!id_evento || !id_organizacion || !cursosArray || !Array.isArray(cursosArray) || cursosArray.length === 0) {
      return res.status(400).json({ error: 'id_evento, id_organizacion y cursos son requeridos y cursos debe ser un arreglo no vacío', received: { id_evento, id_organizacion, cursos } });
    }

    const evento = await db_support.EventDB.findOne({ id_evento });
    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    // Calcular el máximo de invitados entre los cursos proporcionados
    const max_invitados = cursosArray.reduce((max, idCurso) => {
      const infoCurso = Object.values(evento.cursoBloqueMap).find(item => item.id === idCurso);

      if (!infoCurso) {
        console.warn(`${tag} No se encontró información para el curso: ${idCurso}`);
        return max;
      }

      return Math.max(max, infoCurso.pases_invitados || 0);
    }, 0);

    res.json({ max_invitados });
  } catch (error) {
    console.error('[/api/eventos/max_invitados] Error:', error);
    res.status(500).json({ error: 'Error al obtener max_invitados' });
  }
});







module.exports = router;
