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

router.post('/update/nombrehermanos', apiKeyAuth, async (req, res) => {
  const tag = '[POST /api/update/nombrehermanos]';
  const url_server = config_env.URL_SERVER || 'https://registro-patrona.onrender.com';
  let mapaHijosPadres = null;
  try {
    // Iterar sobre cada item de db_support.hermanosMapDB => nombre_hijo
    
    // Si el campo apoderado_email no esta vacio => 
    //  mapaHijosPadres = fetch /api/hijos-padres

    //  si nombre_hijo esta en 

    //S
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
  }
);

app.get('/api/hijos-padres', apiKeyAuth, async (req, res) => {
  try {
    // 1. Obtenemos solo los campos necesarios de los usuarios
    const usuarios = await User.find({}, 'email hijos');

    const mapaHijosPadres = {};

    // 2. Recorremos los usuarios (padres)
    usuarios.forEach(padre => {
      if (padre.hijos && padre.hijos.length > 0) {
        padre.hijos.forEach(hijo => {
          // Usamos el _id del hijo como clave (o sustituye por el campo unico del hijo)
          const nombre = hijo.nombre;

          const email = padre.email;

          // Si el hijo aún no está en el mapa, inicializamos su arreglo
          if (!mapaHijosPadres[nombre]) {
            mapaHijosPadres[nombre] = [];
          }

          // Agregamos el padre al arreglo del hijo
          mapaHijosPadres[nombre].push(email);
        });
      }
    });

    // 3. Retornamos el mapa como JSON
    res.json(mapaHijosPadres);

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener la relación de hijos y padres' });
  }
});
