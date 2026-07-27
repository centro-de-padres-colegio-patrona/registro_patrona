const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');
const { BASEURL } = require('../backend/git_branch');

const SECRET_API_KEY = config_env.API_KEY;

/*router.post('/update/nombrehermanos', apiKeyAuth, async (req, res) => {
  const tag = '[POST /api/update/nombrehermanos]';
  const url_server = config_env.URL_SERVER || BASEURL;
  let mapaHijosPadres = null;
  try {
    // Iterar sobre cada item de db_support.hermanosMapDB => nombre_hijo
    
    // Si el campo apoderado_email no esta vacio => 
    //  mapaHijosPadres = fetch /api/hijos-padres

    //  si nombre_hijo esta en mapaHijosPadres =>
    //    update db_support.hermanosMapDB nombre_hijo, mapaHijosPadres[nombre_hijo]
    //    salir del loop

    // retirnar ok
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
  }
);*/


router.post('/update/nombrehermanos', apiKeyAuth, async (req, res) => {
  const tag = '[POST /api/update/nombrehermanos]';
  const localPort = process.env.PORT || 5001;
  const baseUrl = localPort !== 5001 
    ? config_env.URL_SERVER
    : `http://localhost:5001`;  
  let mapaHijosPadres = null;
  let actualizados = 0;
 
  try {
    // Iterar sobre cada item de db_support.hermanosMapDB => nombre_hijo
    {
      const familiaList = await db_support.hermanosMapDB.find({});  //{$or:[{email_apoderado:{$exists:false}},{email_apoderado:''},{email_apoderado:{$type:6}}]}
      const familiaSinApoderados = familiaList.filter(familia => !familia.apoderado_email || !familia.apoderado_email.length );
      console.log(`${tag} familiaSinApoderados; `, familiaSinApoderados.length);
    }
    const familiaSinApoderados = await db_support.hermanosMapDB.find({$or:[{apoderado_email:{$exists:false}},{apoderado_email:''},{apoderado_email:{$type:6}}]});
    console.log(`${tag} familiaSinApoderados; `, familiaSinApoderados.length);

    if (familiaSinApoderados.length) {
      const resp = await fetch(`${baseUrl}/api/hijos_padres`, {
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });

      if (!resp.ok) {
        throw new Error(`No se pudo obtener /api/hijos_padres: ${resp.status}`);
      }

      mapaHijosPadres = await resp.json();
      const hijosConApoderadoEmail = Object.keys(mapaHijosPadres);

      // Filtrar aquellas familias que coincida el id con la key del mapa
      const familiasToUpdate = familiaSinApoderados.filter(familiaInfo => hijosConApoderadoEmail.includes(familiaInfo.id));
      console.log(`${tag} familiasToUpdate; `, familiasToUpdate.length);

      for (const familiaInfo of familiasToUpdate) {
        const nombreHijo = familiaInfo.id;
        //console.log(`${tag} nombreHijo`, nombreHijo);

        // si nombre_hijo esta en mapaHijosPadres => update db_support.hermanosMapDB
        if (mapaHijosPadres[nombreHijo]) {
          familiaInfo.apoderado_email = mapaHijosPadres[nombreHijo];
          await familiaInfo.save();
          actualizados++;
        }
      }
    }
    console.log(`${tag} actualizados: `, actualizados);
    return res.json({ ok: true, actualizados });
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});


router.get('/hijos_padres', apiKeyAuth, async (req, res) => {
  const tag = '[GET /api/hijos_padres]';
  try {
    console.log(`${tag} Starting`);
    // 1. Obtenemos solo los campos necesarios de los usuarios
    const usuarios = await db_support.usersDB.find({}, 'email hijos');

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

    //console.log(`${tag} mapaHijosPadres: `, Object.keys(mapaHijosPadres).length);

    // 3. Retornamos el mapa como JSON
    res.json(mapaHijosPadres);

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener la relación de hijos y padres' });
  }
});


router.delete('/update/user', apiKeyAuth, async (req, res) => {
  const tag = '[DEL /api/update/user]';
  try {
    const { user_email } = req.query;
    if ( !user_email ) {
      const err_msg = `${tag} user_email parameter required`;
      console.log(err_msg);  
      res.status(400).json(err_msg);
      return;
    }

    await db_support.hermanosMapDB.updateMany(
      { apoderado_email: user_email },
      { $pull: { apoderado_email: user_email } } // Remueve el email del arreglo
    );

    const deletedResult = await db_support.usersDB.deleteOne({email: user_email});

    // Verificar si realmente se eliminó algún documento
    if (deletedResult.deletedCount === 0) {
      const error_msg = `${tag} user ${user_email} not found or could not be deleted`;
      console.log(error_msg);
      return res.status(404).json({ error: error_msg });
    }

    res.status(200).json(`user ${user_email} has been deleted`);

  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
  }
});

module.exports = router;
