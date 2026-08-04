const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend


const SECRET_API_KEY = config_env.API_KEY;


router.get('/correo_tipo', async (req, res) => {
    const tag = '[GET /api/correo_tipo]';
    console.log(`${tag} req.query: `, req.query);
    try {
        const id_organizacion = req.query.id_organizacion;
        const id_evento = req.query.id_evento;

        if (!id_organizacion || !id_evento) {
            return res.status(400).json({ error: 'Faltan parámetros requeridos: id_organizacion o id_evento' });
        }

        // Buscar en la base de datos el correo tipo correspondiente
        const correoTipo = await db_support.correosTipoDB.findOne({ id_organizacion, id_evento });

        if (!correoTipo) {
            console.log(`${tag} No se encontró el correo tipo para id_organizacion: ${id_organizacion}, id_evento: ${id_evento}`);
            return res.status(404).json({ error: 'No se encontró el correo tipo para los parámetros proporcionados' });
        }

        res.json(correoTipo);
    } catch (error) {
        console.error(`${tag} Error al obtener el correo tipo:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/correo_tipo', apiKeyAuth, async (req, res) => {
    const tag = '[POST /api/correo_tipo]';
    try {
        const { id_organizacion, id_evento, asuntoCorreo, mensajeCorreo, tipo_attachment } = req.body;

        if (!id_organizacion || !id_evento || !asuntoCorreo || !mensajeCorreo || !tipo_attachment) {
            return res.status(400).json({ error: 'Faltan parámetros requeridos en el cuerpo de la solicitud' });
        }

        // Crear un nuevo documento de correo tipo
        const nuevoCorreoTipo = new db_support.correosTipoDB({
            id_organizacion,
            id_evento,
            asuntoCorreo,
            mensajeCorreo,
            tipo_attachment
        });

        // Guardar en la base de datos
        await nuevoCorreoTipo.save();

        res.status(201).json({ message: 'Correo tipo creado exitosamente', correoTipo: nuevoCorreoTipo });
    } catch (error) {
        console.error(`${tag} Error al crear el correo tipo:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.delete('/correo_tipo', apiKeyAuth, async (req, res) => {
    const tag = '[DELETE /api/correo_tipo]';
    try {
        const { id_organizacion, id_evento } = req.body;

        if (!id_organizacion || !id_evento) {
            return res.status(400).json({ error: 'Faltan parámetros requeridos en el cuerpo de la solicitud' });
        }

        // Eliminar el correo tipo correspondiente
        const resultado = await db_support.correosTipoDB.deleteOne({ id_organizacion, id_evento });

        if (resultado.deletedCount === 0) {
            return res.status(404).json({ error: 'No se encontró el correo tipo para eliminar' });
        }

        res.json({ message: 'Correo tipo eliminado exitosamente' });
    } catch (error) {
        console.error(`${tag} Error al eliminar el correo tipo:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.put('/correo_tipo', apiKeyAuth, async (req, res) => {
    const tag = '[PUT /api/correo_tipo]';
    try {
        const { id_organizacion, id_evento, asuntoCorreo, mensajeCorreo, tipo_attachment } = req.body;

        if (!id_organizacion || !id_evento) {
            return res.status(400).json({ error: 'Faltan parámetros requeridos en el cuerpo de la solicitud' });
        }

        // Actualizar el correo tipo correspondiente
        const correoTipoActualizado = await db_support.correosTipoDB.findOneAndUpdate(
            { id_organizacion, id_evento },
            { asuntoCorreo, mensajeCorreo, tipo_attachment },
            { new: true } // Devuelve el documento actualizado
        );

        if (!correoTipoActualizado) {
            return res.status(404).json({ error: 'No se encontró el correo tipo para actualizar' });
        }

        res.json({ message: 'Correo tipo actualizado exitosamente', correoTipo: correoTipoActualizado });
    }
    catch (error) {
        console.error(`${tag} Error al actualizar el correo tipo:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;