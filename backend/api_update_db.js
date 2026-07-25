// ./backend/api_entradas.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');


const SECRET_API_KEY = config_env.API_KEY;

/*router.post('/update/nombrehermanos', apiKeyAuth, async (req, res) => {
  const tag = '[/update/nombrehermanos]';
  const url_server = config_env.URL_SERVER || 'https://registro-patrona.onrender.com';
  try {
    //console.log(JSON.stringify(req.body));
    const { 
            id_organizacion,
            id_evento,
            imagen_ticket_path,
            familia, 
            nombre_completo, 
            num_listado, 
            curso, 
            jornada,
            bloques,
            tipo,
            save_file
          } = req.body;

        }
      }
);*/