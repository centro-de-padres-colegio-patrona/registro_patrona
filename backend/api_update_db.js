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


/*
/// POST /api/update/nombrehermanos
/// Actualiza el campo apoderado_email en la colección hermanosMapDB
/// Recorre todos los documentos en hermanosMapDB y verifica si el campo apoderado_email está vacío.
/// Si está vacío, hace una solicitud a /api/hijos_padres para obtener un mapa de hijos a padres.
/// Luego, si el nombre del hijo está en el mapa, actualiza el campo apoderado_email con el valor correspondiente.
/// Retorna un JSON con la cantidad de documentos actualizados.
*/
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

/// GET /api/hijos_padres
/// Retorna un mapa de hijos a padres en formato JSON
/// La estructura del JSON es: { "nombre_hijo": ["email_padre1", "email_padre2", ...], ... }
/// Se obtiene de la colección usersDB, donde cada usuario tiene un arreglo de hijos
/// Se filtra para obtener solo los campos necesarios (email y hijos)
/// Se recorre cada usuario y se construye el mapa de hijos a padres
/// Se retorna el mapa como JSON
///
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


/// DELETE /api/update/user
/// Elimina un usuario de la colección usersDB y actualiza hermanosMapDB para remover su email de apoderado_email
/// Requiere el parámetro user_email en la query string
/// Retorna un mensaje de éxito o error

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
    res.status(500).json({ ok: false, error: error.message });
  }
});


/// DELETE /api/update/user/apoderado_email
/// Elimina los apoderados del user de la colección hermanosMapDB y actualiza los registros correspondientes
/// Requiere el parámetro user_email en la query string
/// Retorna todos los itemes de la colleccion hermanoMapDB que contenian el email del apoderado eliminado

router.delete('/update/user/apoderado_email', apiKeyAuth, async (req, res) => {
  const tag = '[DEL /api/update/user/apoderado_email]';
  try {
    const { user_email } = req.query;
    if ( !user_email ) {
      const err_msg = `${tag} user_email parameter required`;
      console.log(err_msg);  
      res.status(400).json(err_msg);
      return;
    }

    const userInfo = await db_support.usersDB.findOne({ email: user_email });
    if (!userInfo) {
      const error_msg = `${tag} user ${user_email} not found`;
      console.log(error_msg);
      return res.status(404).json({ error: error_msg });
    }

    // Remover pagos por user_email
    const pagosResult = await db_support.pagosDB.find({ email: user_email }).lean();
    if (pagosResult.length > 0) {
      const pagosDeleteResult = await db_support.pagosDB.deleteMany({ email: user_email });
      console.log(`${tag} user ${user_email} pagos removed: `, pagosDeleteResult.deletedCount);
    } else {
      console.log(`${tag} user ${user_email} no pagos found to remove`);
    }

    // Remover pagos por cada hijo del usuario
    for ( const hijo of userInfo.hijos || [] ) {
      const pagosHijoResult = await db_support.pagosDB.find({ id: hijo.nombre }).lean();
      if (pagosHijoResult.length > 0) {
        //console.log(`${tag} user ${user_email} hijo ${hijo.nombre} pagos found: `, pagosHijoResult.length);
        const pagosHijoDeleteResult = await db_support.pagosDB.deleteMany({ id: hijo.nombre });
        console.log(`${tag} user ${user_email} hijo ${hijo.nombre} pagos removed: `, pagosHijoDeleteResult.deletedCount);
      } else {
        console.log(`${tag} user ${user_email} hijo ${hijo.nombre} no pagos found to remove`);
      }
    }

    // Remover payments por user_email  
    const paymentsResult = await db_support.paymentOrdersDB.deleteMany({ email: user_email });
    console.log(`${tag} user ${user_email} payments removed: `, paymentsResult.deletedCount);

    // Remove hijos from userInfo.hijos if they exist
    if ( userInfo.hijos && userInfo.hijos.length > 0 ) {
      await db_support.usersDB.updateOne(
        { email: user_email },
        { $set: { hijos: [], invitados: [] } }
      );
    }
    if (userInfo.invitados && userInfo.invitados.length > 0) {
      await db_support.usersDB.updateOne(
        { email: user_email },
        { $set: { invitados: [] } }
      );
    }

    const info = await db_support.usersDB.findOne({ email: user_email }).lean();
    console.log(`${tag} user ${user_email} hijos removed: `, info.hijos);
    console.log(`${tag} user ${user_email} invitados removed: `, info.invitados);

    // Remove apoderado_email from hermanosMapDB
    const email_apoderados = userInfo.padres.map(p => p.correo);
    if (!email_apoderados.length) {
      const error_msg = `${tag} user ${user_email} has no apoderado_email to remove`;
      console.log(error_msg);
      return res.status(400).json({ error: error_msg });
    }

    const targetDocs = await db_support.hermanosMapDB.find({ apoderado_email: user_email });

    if (!targetDocs.length) {
      const error_msg = `${tag} No documents matched condition (user_email ${user_email} not present or no matching apoderados found in hermanosMapDB)`;
      console.log(error_msg);
      return res.status(404).json({ error: error_msg });
    }

    const filter = {
      $and: [
        { apoderado_email: user_email },
        { apoderado_email: { $in: email_apoderados } }
      ]
    };    
    const updatedResult = await db_support.hermanosMapDB.updateMany(
      filter,
      { $pull: { apoderado_email: { $in: email_apoderados } } } // Remueve el email del arreglo
    );

    // Verificar si realmente se eliminó algún documento
    if (updatedResult.matchedCount === 0) {
      const error_msg = `${tag} user ${user_email} not found or could not be updated in hermanosMapDB`;
      console.log(error_msg);
      return res.status(404).json({ error: error_msg });
    }

    const updatedDocs = targetDocs.map(doc => {
      const obj = doc.toObject ? doc.toObject() : { ...doc };
      if (Array.isArray(obj.apoderado_email)) {
        obj.apoderado_email = obj.apoderado_email.filter(email => !email_apoderados.includes(email));
      }
      return obj;
    });

    res.status(200).json({
      message: `apoderados [${email_apoderados.join('|')}] of user ${user_email} have been deleted from hermanosMapDB`,
      updatedResult: updatedResult,
      updatedDocs: updatedDocs

    });

  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    res.status(500).json({ ok: false, error: error.message });
  }
});


module.exports = router;
