// ./backend/api_entradas.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');

const { send_email_from_cpa_account } = require('../api-correo/send_fiesta_chilena_email.js');
const { BASEURL } = require('../backend/git_branch');


const SECRET_API_KEY = config_env.API_KEY;


// endpoint para enviar un correo sin adjuntos
router.post('/enviarCorreo', apiKeyAuth, async (req, res) => {
  const tag = '[POST /api/enviarCorreo]';
  const { correo, asunto, mensaje } = req.body;

  if (!correo || !asunto || !mensaje) {
    return res.status(400).json({ error: 'Faltan datos de correo, asunto o mensaje' });
  }

  try {
    await send_email_from_cpa_account({email_destinatario: correo, asuntoCorreo: asunto, mensajeCorreo: mensaje});
    console.log(`${tag} Correo enviado a ${correo}`);
    res.status(200).json({ message: `Correo enviado exitosamente a ${correo}` });
  } catch (error) {
    console.error(`${tag} Error al enviar correo:`, error);
    res.status(500).json({ message: `Error al enviar correo a ${correo}`, error });
  }
});

module.exports = router;
