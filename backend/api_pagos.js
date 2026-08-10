const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');



// Endpoint para obtener la lista de pagos del CPA por curso
router.get('/pagos/:curso/:seccion?', apiKeyAuth, async (req, res) => {
    const tag = '[GET /api/pagos/:curso/:seccion]';
    const { curso, seccion  = '' } = req.params;
    //console.log(`${tag} `, {curso, seccion});
    try {
        const lista_curso = await db_support.listadoCursosDB.findOne({id: `${curso.toUpperCase()}${seccion.toUpperCase()}`});

        if (!lista_curso) return res.status(404).json({ error: 'Curso no encontrado' });

        const listaEstudiantes = lista_curso.listaCurso || [];
        //console.log(`${tag} listaEstudiantes: `, listaEstudiantes);

        if (listaEstudiantes.length === 0) return res.status(404).json({ error: 'No hay estudiantes registrados para este curso' });

        const lista_pagos = await db_support.pagosDB.find({ cuota_cpa: true, id: { $in: listaEstudiantes } });
        
        if (!lista_pagos || lista_pagos.length === 0) return res.status(404).json({ error: 'No se encontraron pagos para los estudiantes de este curso' });

        const pagos = lista_pagos.map(pago => pago.id);

        res.json(pagos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los pagos' });
    }
});

router.get('/estado_pago_evento', apiKeyAuth, async (req, res) => {
    const tag = '[GET /api/pagos/estado_pago_evento]';
    // testGetPagos({user_email: 'l.herreramena@gmail.com'});
    const { user_email , id_evento, id_organizacion} = req.query;
    //console.log(`${tag} user_email: `, user_email);
    try {
        if (!user_email) return res.status(400).json({ error: 'Falta parámetro user_email' });
        if (!id_evento) return res.status(400).json({ error: 'Falta parámetro id_evento' });
        if (!id_organizacion) return res.status(400).json({ error: 'Falta parámetro id_organizacion' });
        
        // Buscar usuario
        const user = await db_support.usersDB.findOne({ email: user_email });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        console.log(`${tag} hijos: `, user.hijos);
        
        // Buscar pagos asociados a los hijos del usuario
        const pagos = [];
        if (user.hijos !== undefined && user.hijos.length > 0) {
            for ( let childInfo of user.hijos ) {
                const estudiante = childInfo['nombre'];
                //console.log(estudiante);
                const pagos_estudantes = await db_support.pagosDB.find({id: estudiante});
                //console.log(`[/api/estado_pago_cpa] pago user: ${JSON.stringify(pago)}`);
                pagos.push(...pagos_estudantes);
            }
        } else {
            return res.status(404).json({ error: 'Usuario no tiene hijos registrados' });
        }

        // Buscar información del evento
        const eventoInfo = await db_support.EventDB.findOne({ id_evento });
        if (!eventoInfo) return res.status(404).json({ error: 'Evento no encontrado' });

        const { regla_de_negocios_entradas } = eventoInfo;
        if (!regla_de_negocios_entradas) return res.status(404).json({ error: 'Regla de negocios de entradas no definida para este evento' });

        // Aquí puedes agregar más lógica para determinar el estado de pago del usuario según el tipo de entrada y el precio
        // Por ejemplo, podrías verificar si el usuario ha pagado la cantidad correcta según el tipo de entrada
        const estado_de_pago = {};
        for ( const [id_rule, regla_info] of Object.entries(regla_de_negocios_entradas) ) {
            // Regla de acuerdo con 
            const { compromiso_name, pases_por_compromiso, compromisos_maximo, compromiso_maximo_alcanzado } = regla_info;
            estado_de_pago[id_rule] = pagos.filter(pago => pago.tipo === compromiso_name || (pago.compromisos_de_pago && pago.compromisos_de_pago.includes(compromiso_name)));
        }
        res.json(estado_de_pago);  
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el estado de pago' });
    }

});

module.exports = router;
