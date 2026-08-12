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
    console.log(`${tag} `, {curso, seccion});
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

router.get('/evento/estado_de_pago', apiKeyAuth, async (req, res) => {
    let tag = '[GET /api/evento/estado_de_pago]';
    // testGetPagos({user_email: 'l.herreramena@gmail.com'});
    const { user_email , id_evento, id_organizacion} = req.query;
    //console.log(`${tag} user_email: `, user_email);
    try {
        if (!user_email) return res.status(400).json({ error: 'Falta parámetro user_email' });
        if (!id_evento) return res.status(400).json({ error: 'Falta parámetro id_evento' });
        if (!id_organizacion) return res.status(400).json({ error: 'Falta parámetro id_organizacion' });
       
        tag = tag + `[user_email: ${user_email}]`;
        // Buscar usuario
        const user = await db_support.usersDB.findOne({ email: user_email });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        //console.log(`${tag} hijos: `, user.hijos);

        // Buscar pagos asociados a los hijos del usuario
        const pagos = [];
        if (user.hijos !== undefined && user.hijos.length > 0) {
            for ( let childInfo of user.hijos ) {
                const estudiante = childInfo['nombre'];
                //console.log(estudiante);
                const pagos_estudantes = await db_support.pagosDB.find({id: estudiante}).lean();
                //console.log(`[/api/estado_pago_cpa] pagos user: ${JSON.stringify(pagos_estudantes)}`);
                pagos.push(...pagos_estudantes);
            }
        } else {
            return res.status(404).json({ error: 'Usuario no tiene hijos registrados' });
        }

        //console.log(`${tag} pagos encontrados: `, pagos);

        // Obtener todos los compromisos de pago
        const compromisos_de_pago_bd = await db_support.compromisosPagoDB.find().lean();

        const pagos_estudiantes_splitted_by_compromiso = [];
        for ( const pago of pagos ) {
            if (!pago.compromisos_de_pago || pago.compromisos_de_pago.length === 0 || !pago.cantidades || Object.keys(pago.cantidades).length === 0) {
                const compromiso = compromisos_de_pago_bd.find(c => c.id === pago.tipo);
                if (compromiso && compromiso.monto > 0) {
                    const cantidad = pago.monto / compromiso.monto; // Evitar división por cero
                    pago.cantidad = cantidad;
                }
                pagos_estudiantes_splitted_by_compromiso.push(pago);
                continue;
            }
            /*const pagos_splitted = pago.cantidades.map(({ compromiso, cantidad }) => ({
                ...pago,
                tipo: compromiso,
                monto: cantidad * compromisos_de_pago_bd.find(c => c.compromiso === compromiso)?.monto || 0,
            }));*/
            // Convertimos el objeto { clave: cantidad } a un arreglo de pares [compromiso, cantidad]
            const pagos_splitted = Object.entries(pago.cantidades).map(([compromiso, cantidad]) => {
                const compromisoBD = compromisos_de_pago_bd.find(c => c.id === compromiso);
                const montoUnitario = compromisoBD ? compromisoBD.monto : 0;

                return {
                    ...pago,
                    tipo: compromiso,
                    monto: cantidad * montoUnitario,
                    cantidad: cantidad,
                };
            });            
            pagos_estudiantes_splitted_by_compromiso.push(...pagos_splitted);
        }

        //console.log(`${tag} pagos spliteados: `, pagos_estudiantes_splitted_by_compromiso);

        // Reducir pagos por tipo de compromiso.
        pagos_reducidos_por_compromiso = {};
        for ( const pago of pagos_estudiantes_splitted_by_compromiso ) {
            if (!pagos_reducidos_por_compromiso[pago.tipo]) {
                pagos_reducidos_por_compromiso[pago.tipo] = pago;
            } else {
                pagos_reducidos_por_compromiso[pago.tipo].monto += pago.monto;
                pagos_reducidos_por_compromiso[pago.tipo].cantidad += pago.cantidad;
            }
        }

        //console.log(`${tag} pagos reducidos por compromiso: `, pagos_reducidos_por_compromiso);

        // Buscar información del evento
        const eventoInfo = await db_support.EventDB.findOne({ id_evento }).lean();
        if (!eventoInfo) return res.status(404).json({ error: 'Evento no encontrado' });

        const { regla_de_negocios_entradas } = eventoInfo;
        if (!regla_de_negocios_entradas) return res.status(404).json({ error: 'Regla de negocios de entradas no definida para este evento' });

        //console.log(`${tag} regla_de_negocios_entradas: `, regla_de_negocios_entradas);
        //console.log(`${tag} type of regla_de_negocios_entradas: `, typeof regla_de_negocios_entradas);

        const reglas_de_negocios_para_cada_tipo_de_entrada = {};
        //console.log(`${tag} Procesando reglas de negocios para cada tipo de entrada..., Object.entries(regla_de_negocios_entradas): `, Object.entries(regla_de_negocios_entradas));
        for ( const [tipo_pase, lista_id_reglas] of Object.entries(regla_de_negocios_entradas) ) {
            //console.log(`${tag} tipo_pase: ${tipo_pase}, lista_id_reglas: `, lista_id_reglas);
            for ( const id_rule of lista_id_reglas ) {
                const rule_info = await db_support.PaseRuleDB.findOne({ id_rule });
                if (!rule_info) {
                    console.warn(`${tag} No se encontró información para la regla: ${id_rule}`);
                    continue;
                }
                if (!reglas_de_negocios_para_cada_tipo_de_entrada[tipo_pase]) {
                    reglas_de_negocios_para_cada_tipo_de_entrada[tipo_pase] = [rule_info];
                } else {
                    reglas_de_negocios_para_cada_tipo_de_entrada[tipo_pase].push(rule_info);
                }
            }
        }
        //console.log(`${tag} reglas_de_negocios_para_cada_tipo_de_entrada: `, reglas_de_negocios_para_cada_tipo_de_entrada);

        const pagos_por_tipo_entradas = {};
        for ( const [tipo_pase, lista_reglas_info] of Object.entries(reglas_de_negocios_para_cada_tipo_de_entrada) ) {
            //console.log(`${tag} tipo_pase: ${tipo_pase}, lista_reglas_info: `, lista_reglas_info);
            for ( const regla_info of lista_reglas_info ) {
                //console.log(`${tag} regla_info: `, regla_info);
                const { compromiso_name, pases_por_compromiso, compromisos_maximo, compromiso_maximo_alcanzado } = regla_info;
                console.log(`${tag} compromiso_name: ${compromiso_name}, pases_por_compromiso: ${pases_por_compromiso}, compromisos_maximo: ${compromisos_maximo}, compromiso_maximo_alcanzado: ${compromiso_maximo_alcanzado}`);
                //console.log(`${tag} Filtrando pagos para compromiso_name: ${compromiso_name}, pagos: `, pagos);
                //const pago_filtered = pagos_reducidos_por_compromiso.filter(pago => pago.tipo === compromiso_name || (pago.compromisos_de_pago && pago.compromisos_de_pago.includes(compromiso_name)));
                if ( !Object.hasOwn(pagos_reducidos_por_compromiso, compromiso_name ) ) continue; 
                const pago_filtered = pagos_reducidos_por_compromiso[compromiso_name];
                //console.log(`${tag} pago_filtered for compromiso_name ${compromiso_name}: `, pago_filtered);
                if (!pago_filtered) continue; // No hay pagos para este compromiso, pasar al siguiente

                // Evaluar Regla
                const isCompromisoMaximoAlcanzado = pago_filtered.cantidad >= compromisos_maximo;
                pago_filtered.compromiso_maximo_alcanzado = isCompromisoMaximoAlcanzado;
                pago_filtered.pases_por_compromiso = pases_por_compromiso;
                pago_filtered.accion_maximo_alcanzado = compromiso_maximo_alcanzado
                //console.log(`${tag} pagos_reducidos for compromiso_name ${compromiso_name}: `, pagos_reducidos.length);
                if (!pagos_por_tipo_entradas[tipo_pase]) {
                    pagos_por_tipo_entradas[tipo_pase] = [pago_filtered];
                } else {
                    pagos_por_tipo_entradas[tipo_pase].push(pago_filtered);
                }
            }
        }

        const estado_de_pagos = {}
        /*for ( const [tipo_pase, lista_pagos] of Object.entries(pagos_por_tipo_entradas) ) {
            const total_pagos = lista_pagos.length;*/
            

        res.json(pagos_por_tipo_entradas);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el estado de pago' });
    }

});

module.exports = router;
