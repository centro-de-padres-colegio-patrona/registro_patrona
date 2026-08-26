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
    //console.log('Received report request:', req.body);
    try {
        const { problemDescription, user_email, issue_type , id_organizacion} = req.body;

        if (!problemDescription || !user_email || !issue_type || !id_organizacion) {
            return res.status(400).json({ message: 'Faltan parámetros requeridos' });
        }

        //console.log('Received report:', { problemDescription, user_email, issue_type, id_organizacion });
        // Aquí puedes agregar la lógica para guardar el reporte en la base de datos
        const user_report = await db_support.UserReportIssueDB.findOne({ user_email, id_organizacion });
        if (user_report) {
            // Si ya existe un reporte para este usuario y organización, agregamos el nuevo reporte al array
            user_report.reports.push({
                descripcion: problemDescription,
                issue_type: issue_type || 'general', // Puedes ajustar esto según tus necesidades
            });
            await user_report.save();
        } else {
            // Si no existe, creamos un nuevo documento
            const newReport = await db_support.UserReportIssueDB.create({
                id_organizacion: id_organizacion,
                user_email: user_email,
                reports: [{
                    descripcion: problemDescription,
                    issue_type: issue_type || 'general', // Puedes ajustar esto según tus necesidades
                }]
            });
            if (!user_report) {
                await newReport.save();
            }
        }
        res.status(200).json({ message: 'Reporte recibido correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al procesar el reporte' });
    }
});

module.exports = router;
