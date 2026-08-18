// ./backend/api_entradas.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const { genEntradaCanvas, genQrEntradaCanvas, genQrData } = require('../src/generateTicket'); 
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');
//const { info } = require('console');
const { send_email_from_cpa_account } = require('../api-correo/send_fiesta_chilena_email.js');
const { generarPdfDesdeBuffers, save_pdf } = require('./pdf_helper.js');
const { BASEURL } = require('../backend/git_branch');



// Get features from the database
// GET /api/feature/options?id_organizacion=some_id&id_evento=some_id&key=some_key&default=some_default
router.get('/feature/options', async (req, res) => {
  const id_organizacion = req.query.id_organizacion;
  //const id_evento = req.query.id_evento;
  const id_seccion = req.query.id_seccion
  const feature = req.query.feature;
  const defaultValue = req.query.default;

  if (!feature) {
    return res.status(400).json({ error: 'Missing feature parameter' });
  }

  try {
    console.log(`Fetching feature option for id_organizacion: ${id_organizacion}, id_seccion: ${id_seccion}, feature: ${feature}`);
    const value = await db_support.FrontEndFeaturesDB.findOne({ id_organizacion, id_seccion }).lean();
    if (!value) {
      return res.status(404).json({ error: 'Feature options not found' });
    }

    const featureOption = value.features.find(f => f.feature === feature);
    if (!featureOption) {
        // If the feature option does not exist, return the default value
        // Add the feature option to the database with the default value
        const result = await db_support.FrontEndFeaturesDB.updateOne(
          { id_organizacion, id_seccion },
          { $push: { features: { feature, enabled: defaultValue } } },
          { upsert: true }
        );

        console.log('Feature option added with default value:', result);
        console.log(`Returning default value for feature: ${feature}, enabled: ${defaultValue}`);
        return res.json({ feature: {enabled: defaultValue} });
    }
    console.log(`Returning feature option for feature: ${feature}, enabled: ${featureOption.enabled}`);
    res.json({ feature: {enabled: featureOption.enabled} });
  } catch (error) {
    console.error('Error fetching feature option:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
