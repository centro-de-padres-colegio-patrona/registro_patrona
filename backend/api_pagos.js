const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');



// Endpoint para obtener la lista de pagos del CPA por curso
router.get('/pagos/:curso/:seccion?', apiKeyAuth, async (req, res) => {
    const tag = '[GET /api/pagos/:curso/:seccion]';
    const { curso, seccion  = '' } = req.params;
    //console.log(`${tag} `, {curso, seccion});
    try {
        const lista_curso = await db_support.listadoCursosDB.findOne({id: `${curso.toUpperCase()}${seccion.toUpperCase()}`});

        if (!lista_curso) return res.status(404).json({ error: 'Curso no encontrado' });

        const listaEstudiantes = lista_curso.listaCurso || [];
        //console.log(`${tag} listaEstudiantes: `, listaEstudiantes);

        if (listaEstudiantes.length === 0) return res.status(404).json({ error: 'No hay estudiantes registrados para este curso' });

        const lista_pagos = await db_support.pagosDB.find({ cuota_cpa: true, id: { $in: listaEstudiantes } });
        
        if (!lista_pagos || lista_pagos.length === 0) return res.status(404).json({ error: 'No se encontraron pagos para los estudiantes de este curso' });

        const pagos = lista_pagos.map(pago => pago.id);

        res.json(pagos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los pagos' });
    }
});

// testGetPagos('1B', 'A');

module.exports = router;
