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
        const perfiles = await db_support.perfilesDB.find({});
        // Log para debug: mostrar cuántos presidentes hay
        const presidentes = perfiles.filter(p => p.rol === 'presidente');
        if (presidentes.length > 0) {
            console.log(`${tag} Presidentes encontrados: ${presidentes.length}`, presidentes.map(p => `${p.email}/${p.rol}/activo:${p.activo}/_id:${p._id}`));
        }
        res.json(perfiles);
    } catch (error) {
        console.error('Error verificando el perfil:', error);
        res.status(500).json({ error: 'Error verificando el perfil' });
    }
});

// Endpoint para crear un perfil (delegado a server.js que tiene validación de duplicados)
// Este endpoint se mantiene como respaldo por compatibilidad
router.post('/perfiles', async (req, res, next) => {
    // Delegar al siguiente handler (server.js) que tiene validación completa
    next();
});

// Endpoint para eliminar un perfil (delegado a server.js que tiene la lógica completa)
// La ruta DELETE /api/perfiles/:email se maneja en server.js



module.exports = router;
