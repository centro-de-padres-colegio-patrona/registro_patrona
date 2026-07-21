const express = require('express');
const router = express.Router();
const path = require('path');

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const { genEntradaCanvas } = require('../src/generateTicket'); 

// Obtener todos los perfiles desde DB y devolverlos como JSON
router.get('/perfiles', async (req, res) => {
    const perfiles = await db_support.perfilesDB.find();
    res.json(perfiles);
});

// Obtener un perfil específico por ID desde DB y devolverlo como JSON
router.get('/perfiles', async (req, res) => {
    const {email, rut, nombre_completo, rol} = req.query;
    if (email) {
        const perfil = await db_support.perfilesDB.findOne({ email, activo: true });
        return res.json(perfil);
    }
    if (rut) {
        const perfil = await db_support.perfilesDB.findOne({ rut, activo: true });
        return res.json(perfil);
    }
    if (nombre_completo) {
        const perfil = await db_support.perfilesDB.findOne({ nombre_completo, activo: true });
        return res.json(perfil);
    }
    if (rol) {
        const perfiles = await db_support.perfilesDB.find({ rol, activo: true });
        return res.json(perfiles);
    }
    res.status(400).json({ error: 'Debe proporcionar email, rut, nombre_completo o rol como parámetro de consulta' });
});

// Endpoint para crear un perfil
router.post('/perfiles', async (req, res) => {
    const { email, rut, nombre_completo, rol } = req.body;
    try {
        const nuevoPerfil = await db_support.perfilesDB.create({ email, rut, nombre_completo, rol, activo: true });
        res.status(201).json(nuevoPerfil);
    } catch (error) {
        console.error('Error creando el perfil:', error);
        res.status(500).json({ error: 'Error creando el perfil' });
    }
});



module.exports = router;
