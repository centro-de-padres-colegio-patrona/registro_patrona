const express = require('express');
const router = express.Router();
const path = require('path');

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend

// Obtener un perfil específico por ID desde DB y devolverlo como JSON
router.get('/perfiles', async (req, res) => {
    const tag = '[GET /api/perfiles]';
    try {
        const {email, rut, nombre_completo, rol} = req.query;
        if (email) {
            //console.log(`${tag} Verificando perfil por email: ${email}`);
            const perfil = await db_support.perfilesDB.findOne({ email, activo: true });
            //console.log(`${tag} Perfil encontrado: ${perfil ? JSON.stringify(perfil) : 'No encontrado'}`);
            return res.json(perfil);
        }
        if (rut) {
            //console.log(`${tag} Verificando perfil por rut: ${rut}`);
            const perfil = await db_support.perfilesDB.findOne({ rut, activo: true });
            //console.log(`${tag} Perfil encontrado: ${perfil ? JSON.stringify(perfil) : 'No encontrado'}`);
            return res.json(perfil);
        }
        if (nombre_completo) {
            //console.log(`${tag} Verificando perfil por nombre completo: ${nombre_completo}`);
            const perfil = await db_support.perfilesDB.findOne({ nombre_completo, activo: true });
            //console.log(`${tag} Perfil encontrado: ${perfil ? JSON.stringify(perfil) : 'No encontrado'}`);
            return res.json(perfil);
        }
        if (rol) {
            //console.log(`${tag} Verificando perfiles por rol: ${rol}`);
            const perfiles = await db_support.perfilesDB.find({ rol, activo: true });
            //console.log(`${tag} Perfiles encontrados: ${perfiles.length > 0 ? perfiles.map(p => JSON.stringify(p)) : 'No encontrados'}`);
            return res.json(perfiles);
        }
        const perfiles = await db_support.perfilesDB.find();
        res.json(perfiles);
        //res.status(400).json({ error: 'Debe proporcionar email, rut, nombre_completo o rol como parámetro de consulta' });
    } catch (error) {
        console.error('Error verificando el perfil:', error);
        res.status(500).json({ error: 'Error verificando el perfil' });
    }
});

// Endpoint para crear un perfil
router.post('/perfiles', async (req, res) => {
    const tag = '[POST /api/perfiles]';
    //console.log(`${tag} Creando nuevo perfil: ${JSON.stringify(req.body)}`);
    try {
        const { email, rut, nombre_completo, rol } = req.body;
        const nuevoPerfil = await db_support.perfilesDB.create({ email, rut, nombre_completo, rol, activo: true });
        res.status(201).json(nuevoPerfil);
    } catch (error) {
        console.error('Error creando el perfil:', error);
        res.status(500).json({ error: 'Error creando el perfil' });
    }
});



module.exports = router;
