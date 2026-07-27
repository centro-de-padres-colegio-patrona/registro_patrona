const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');


const SECRET_API_KEY = config_env.API_KEY;


router.get('/consulta/hijos', apiKeyAuth, async (req, res) => {
    const tag = '[GET /api/consulta/hijos]';
    let hijos = null;

    try {
        const { user_email = '' } = req.query;

        if (!user_email) {
            console.log(`${tag} Faltan parámetros: user_email es requerido`);
            return res.status(400).json({ error: 'Faltan parámetros: user_email es requerido' });
        }

        const hijos = await db_support.hermanosMapDB.find({$and:[{apoderado_email:{$exists:true}},{apoderado_email:user_email}]});
        console.log(`${tag} hijos con apoderado ${user_email}: `, hijos.length);

        res.json(hijos);
    } catch (err) {
        console.log(`${tag} Unexpected error: `, error);
        return res.status(500).json({ ok: false, error: 'Unexpected error' });
  }
});

/*router.get('/consulta/familias', apiKeyAuth, async (req, res) => {
    const tag = '[GET /api/consulta/familias]';
    let apoderados = null;

    try {
        const { hijos = '' } = req.query;

        if (!hijos) {
            err_msg = 'Faltan parámetros: hijos (array) es requerido';
            console.log(`${tag} `, err_msg);
            return res.status(400).json({ error: err_msg });
        }

        const hijos = await db_support.hermanosMapDB.find({$and:[{apoderado_email:{$exists:true}},{apoderado_email:user_email}]});
        console.log(`${tag} hijos con apoderado ${user_email}: `, hijos.length);

        res.json(hijos);
    } catch (err) {
        console.log(`${tag} Unexpected error: `, error);
        return res.status(500).json({ ok: false, error: error.message });
  }
});*/

router.get('/consulta/apoderados', apiKeyAuth, async (req, res) => {
    const tag = '[GET /api/consulta/apoderados]';

    try {
        let { hijos = [] } = req.query;

        // Hijos es requerido
        if (!hijos) {
            console.log(`${tag} Faltan parámetros: hijos es requerido`);
            return res.status(400).json({ error: 'Faltan parámetros: hijos es requerido' });
        }

        // Parsear hijos si viene como String JSON desde la query
        if (typeof hijos === 'string') {
            try {
                hijos = JSON.parse(hijos);
            } catch (parseErr) {
                console.log(`${tag} Error parseando parámetro hijos:`, parseErr);
                return res.status(400).json({ error: 'El parámetro hijos no es un JSON válido' });
            }
        }

        // Asegurarse de que sea un Array
        if (!Array.isArray(hijos)) {
            hijos = [hijos];
        }

        // Consulta DB
        //console.log(`${tag} Hijos: `, hijos);
        const familias = await db_support.hermanosMapDB.find({apoderado_email:{$exists:true},id:{$in:hijos}});
        console.log(`${tag} familias: `, familias.length);

        //const apoderados_emails = familias.map(familia => familia.apoderado_email);
        // Usamos flatMap para aplanar arreglos (por si apoderado_email es Array o String) 
        // y filtramos valores nulos/vacíos
        const apoderados_emails = familias
            .flatMap(familia => familia.apoderado_email)
            .filter(Boolean);
        
        const apoderados_emails_unicos = [...new Set(apoderados_emails)];
        console.log(`${tag} Hijos: ${JSON.stringify(hijos)} => apoderados: `, apoderados_emails_unicos);
        res.json(apoderados_emails_unicos);
    } catch (err) {
        console.log(`${tag} Unexpected error: `, err);
        return res.status(500).json({ ok: false, error: 'Unexpected error' });
  }
});

router.get('/consulta/hijos_registrados', apiKeyAuth, async (req, res) => {
    const tag = '[GET /api/consulta/apoderados]';

    try {
        // Consulta DB
        const familias = await db_support.hermanosMapDB.find({apoderado_email:{$exists:true},id:{$in:hijos}});
        console.log(`${tag} familias: `, familias.length);

        //const apoderados_emails = familias.map(familia => familia.apoderado_email);
        // Usamos flatMap para aplanar arreglos (por si apoderado_email es Array o String) 
        // y filtramos valores nulos/vacíos
        const nombres_estudiantes = familias
            .flatMap(familia => familia.id )
            .filter(Boolean);
        
        // No debiera ser necesario esto
        const estudiantes = [...new Set(nombres_estudiantes)];

        const listados_curso = db_support.listadoCursosDB.find({});

        // 
        const mapaCursos = listado_curso.reduce((acc, item) => {
            if (Array.isArray(item.listaCurso)) {
                item.listaCurso.forEach(nombre => {
                acc[nombre] = item.id;
                });
            }
            return acc;
        }, {});

        // Filtrar solo aquellos que estan en nombres_estudiantes
        const mapaFiltrado = Object.fromEntries(
            Object.entries(mapaCursos).filter(([nombre]) => nombres_estudiantes.includes(nombre))
        );

        // Mapa inverso
        const mapaInversoObjeto = Object.entries(mapaFiltrado).reduce((acc, [estudiante, cursoId]) => {
            acc[cursoId] = acc[cursoId] || [];
            acc[cursoId].push(estudiante);
            return acc;
        }, {});

        //console.log(`${tag} Cursos: `, mapaInversoObjeto);
        res.json(mapaInversoObjeto);
    } catch (err) {
        console.log(`${tag} Unexpected error: `, err);
        return res.status(500).json({ ok: false, error: 'Unexpected error' });
  }
});


module.exports = router;

