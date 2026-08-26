const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');


const SECRET_API_KEY = config_env.API_KEY;


router.post('/report/problem', apiKeyAuth, async (req, res) => {
    try {
        const { problemDescription, user_email, issue_type , id_organizacion} = req.body;

        // Aquí puedes agregar la lógica para guardar el reporte en la base de datos
        const newReport = new db_support.UserReportIssueDB({
            id_organizacion: id_organizacion,
            user_mail: user_mail,
            reports: [{
                descripcion: problemDescription,
                issue_type: issue_type || 'general', // Puedes ajustar esto según tus necesidades
            }]
        });
        await newReport.save();

        res.status(200).json({ message: 'Reporte recibido correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al procesar el reporte' });
    }
});

module.exports = router;
