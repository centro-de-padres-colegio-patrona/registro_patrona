const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');

const SECRET_API_KEY = config_env.API_KEY;


router.get('/config', async (req, res) => {
  const tag = '[GET /api/config]';
  try {
    const { email = '' } = req.query;

    /*if (!email) {
      return res.status(400).json({ error: 'El parámetro email es obligatorio' });
    }*/

    // Buscamos el perfil del usuario
    const profile = await db_support.perfilesDB.findOne({ email: email.trim() });

    //console.log(`${tag} ${JSON.stringify({email, profile})}`);

    // Validamos existencia, estado activo y permisos de acceso (mínimo Validador)
    if (profile && profile.activo && db_support.hasValidadorAccessRights(profile.rol)) {
      return res.json({
        apiKey: config_env.API_KEY || ''
      });
    }

    //console.log('[GET /api/config] req.session: ', req.session)
    // Verificamos que tenga una session activa
    if (req.session && ( req.session.usuario || req.session.passport)) {
      return res.json({
        apiKey: config_env.API_KEY || ''
      });
    }

    // Si no cumple las condiciones, devolvemos 403 Forbidden
    console.warn(`${tag} Acceso denegado para email: ${email}`);
    return res.status(403).json({
      error: `El usuario ${email} no está autorizado o no posee los permisos necesarios.`
    });

  } catch (err) {
    console.error(`${tag} Unexpected error:`, err);
    return res.status(500).json({ 
      message: 'Error interno del servidor', 
      error: err.message || err 
    });
  }
});



module.exports = router;
