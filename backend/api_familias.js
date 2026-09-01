const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');
const { BASEURL } = require('../backend/git_branch');


const SECRET_API_KEY = config_env.API_KEY;


router.post('/api/familias/merge', apiKeyAuth, async (req, res) => {
    const tag = '[POST /api/familias/merge]';
    const url_server = config_env.URL_SERVER || BASEURL;
    try {
        const { id_organizacion, estudiantes , user_email} = req.body;

        // Validar que estudiantes sea un arreglo
        if (!Array.isArray(estudiantes)) {
            return res.status(400).json({ error: 'El campo "estudiantes" debe ser un arreglo.' });
        }

        // Verificar id_organizacion
        if (!id_organizacion) {
            return res.status(400).json({ error: 'El campo "id_organizacion" es obligatorio.' });
        }

        if (!user_email) {
            return res.status(400).json({ error: 'El campo "user_email" es obligatorio.' });
        }

        // Obtener la información de los estudiantes desde la base de datos
        const estudiantesInfo = await db_support.hermanosMapDB.find({ id: { $in: estudiantes } }).lean();
        const listaFamilias = {};
        const listas_hermanos = [];
        const estudiantesAnalizados = new Set();
        for (const estudianteInfo of estudiantesInfo) {
        


            // Anular todas las entradas de eventos.
            const id_evento = 'fiesta_chilena_2026';
            for (const estudiante of estudiantesInfo) {
                const result = await fetch(`${url_server}/api/entrada/desactivar`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': SECRET_API_KEY
                    },
                    body: JSON.stringify({
                        id_organizacion,
                        id_evento,
                        familia: estudiante.nombre_familia,
                    })
                });
                await result.json();
            }
        }
    } catch (error) {
        console.error(`${tag} Error al procesar la solicitud:`, error);
        res.status(500).json({ message: 'Error interno del servidor', error });
    }
});

module.exports = router;
