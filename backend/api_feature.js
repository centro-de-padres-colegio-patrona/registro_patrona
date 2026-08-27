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
  const id_pagina = req.query.id_pagina;
  const feature = req.query.feature;
  const key = req.query.key;
  const defaultValue = req.query.default;
  const features = req.query.features ? JSON.parse(req.query.features) : null;

  if (!feature && (!features || features.length === 0)) {
    return res.status(400).json({ error: 'Missing feature parameter' });
  }

  const options = {};
  if (key && defaultValue) {
    options[key] = defaultValue;
  }

  console.log('Opciones recibidas: ', options);

  try {
    console.log(`Fetching feature option for id_organizacion: ${id_organizacion}, id_pagina: ${id_pagina}, feature: ${feature}`);
    const value = await db_support.FrontEndFeaturesDB.findOne({ id_organizacion, id_pagina }).lean();
    if (!value) {
      // If the document does not exist, create it with the default value for the feature option
      if (feature) {
        const result = await db_support.FrontEndFeaturesDB.updateOne(
          { id_organizacion, id_pagina },
          { $push: { features: { feature, enabled: defaultValue === 'true', options } } },
          { upsert: true }
        );
      
        console.log('Feature options document created with default value:', result);
        console.log(`Returning default value for feature: ${feature}, enabled: ${defaultValue === 'true'}`);
        return res.json({ feature, enabled: defaultValue === 'true' });
      } else if (features) {
        const featureOptions = features.map(f => ({ feature: f, enabled: defaultValue === 'true', options }));
        const result = await db_support.FrontEndFeaturesDB.updateOne(
          { id_organizacion, id_pagina },
          { $push: { features: { $each: featureOptions } } },
          { upsert: true }
        );
      
        console.log('Feature options document created with default values:', result);
        console.log(`Returning default values for features: ${JSON.stringify(featureOptions)}`);
        return res.json(featureOptions);
      }
    }

    if (!features || features.length === 0) {
      const featureOption = value.features.find(f => f.feature === feature);
      if (!featureOption) {
          // If the feature option does not exist, return the default value
          // Add the feature option to the database with the default value
          const result = await db_support.FrontEndFeaturesDB.updateOne(
            { id_organizacion, id_pagina },
            { $push: { features: { feature, enabled: defaultValue === 'true', options } } },
            { upsert: true }
          );

          console.log('Feature option added with default value:', result);
          console.log(`Returning default value for feature: ${feature}, enabled: ${defaultValue === 'true'}`);
          return res.json({ feature, enabled: defaultValue === 'true' });
      }
      console.log(`Returning feature option for feature: ${feature}, enabled: ${featureOption.enabled}`);
      res.json({ feature, enabled: featureOption.enabled });
    } else if (features) {
      console.log(`Fetching feature options retrieved from DB: `, features);
      const featureOptions = features.map(f => {
        const featureOption = value.features.find(opt => opt.feature === f);
        console.log(`Feature option for ${f}: ${featureOption ? JSON.stringify(featureOption) : 'not found'}`);
        if (!featureOption) {
          // If the feature option does not exist, return the default value
          // Add the feature option to the database with the default value
          db_support.FrontEndFeaturesDB.updateOne(
            { id_organizacion, id_pagina },
            { $push: { features: { feature: f, enabled: defaultValue === 'true', options } } },
            { upsert: true }
          ).then(result => {
            console.log('Feature option added with default value:', result);
            console.log(`Saved data: ${JSON.stringify({ feature: f, enabled: defaultValue === 'true' })}`);
          }).catch(err => {
            console.error('Error adding feature option:', err);
          });
          return { feature: f, enabled: defaultValue === 'true', options };
        }
        return { feature: f, enabled: featureOption.enabled, options: featureOption.options || {} };
      });
      console.log(`Returning feature options for features: ${features}, featureOptions: ${JSON.stringify(featureOptions)}`);
      res.json(featureOptions);
    }
  } catch (error) {
    console.error('Error fetching feature option:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
