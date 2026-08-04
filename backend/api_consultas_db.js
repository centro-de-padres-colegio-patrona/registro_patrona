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
    const tag = '[GET /api/consulta/hijos_registrados]';

    try {
        const { output } = req.query;

        // Consulta DB
        const familias = await db_support.hermanosMapDB.find({apoderado_email:{$exists:true, $not: { $size: 0 }}});
        console.log(`${tag} familias: `, familias.length);

        //const apoderados_emails = familias.map(familia => familia.apoderado_email);
        // Usamos flatMap para aplanar arreglos (por si apoderado_email es Array o String) 
        // y filtramos valores nulos/vacíos
        const nombres_estudiantes = familias
            .flatMap(familia => familia.id )
            .filter(Boolean);
        
        // No debiera ser necesario esto
        const estudiantes = [...new Set(nombres_estudiantes)];
        if ( output === 'listado' ) {
            res.json(estudiantes);
            return;
        }
        const listados_curso = await db_support.listadoCursosDB.find({});

        // 
        const mapaCursos = listados_curso.reduce((acc, item) => {
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


// Endpoint: Estado CPA por Curso (para presidentes de curso)
router.get('/estado_cpa_curso', async (req, res) => {
  const tag = '[GET /api/estado_cpa_curso]';
  try {
    const { curso, seccion } = req.query;

    if (!curso) {
      return res.status(400).json({ error: 'Parámetro "curso" es requerido' });
    }

    // Mapa de curso legible a código
    const curso_map = {
      "Prekínder": 'PK', "Kínder": 'K',
      "1° Básico": '1', "2° Básico": '2', "3° Básico": '3', "4° Básico": '4',
      "5° Básico": '5', "6° Básico": '6', "7° Básico": '7', "8° Básico": '8',
      "I° Medio": '1M', "II° Medio": '2M', "III° Medio": '3M', "IV° Medio": '4M'
    };

    const cursoCode = curso_map[curso] || '';
    const cursoId = cursoCode + (seccion || '');
    console.log(`${tag} Buscando curso: ${curso} ${seccion || ''} -> id: ${cursoId}`);

    if (!cursoId) {
      return res.status(400).json({ error: 'Curso no válido' });
    }

    // 1. Obtener lista completa de alumnos del curso desde listado_cursos
    const cursoDB = await db_support.listadoCursosDB.findOne({ id: cursoId });
    if (!cursoDB || !cursoDB.listaCurso || cursoDB.listaCurso.length === 0) {
      console.log(`${tag} No se encontró listado para curso ${cursoId}`);
      return res.json([]);
    }

    const listaAlumnos = cursoDB.listaCurso;
    console.log(`${tag} Total alumnos en ${cursoId}: ${listaAlumnos.length}`);

    // 2. Para cada alumno, verificar si tiene pago CPA y buscar apoderado
    const alumnos = [];
    for (const nombreAlumno of listaAlumnos) {
      // Verificar pago CPA (búsqueda case-insensitive para mayor robustez)
      const nombreRegex = new RegExp('^' + nombreAlumno.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
      const pagos = await db_support.pagosDB.find({ id: { $regex: nombreRegex } });
      const cpaPagado = Array.isArray(pagos) && pagos.some(p => p.cuota_cpa === true || p.tipo === 'cuota_cpa');

      // Buscar apoderado (desde hermanosMapDB o users)
      let apoderado = '—';
      const hermanoInfo = await db_support.hermanosMapDB.findOne({ id: nombreAlumno });
      if (hermanoInfo && hermanoInfo.apoderado_email && hermanoInfo.apoderado_email.length > 0) {
        apoderado = hermanoInfo.apoderado_email[0];
        // Intentar obtener nombre del apoderado desde users
        const userApoderado = await db_support.usersDB.findOne({ email: hermanoInfo.apoderado_email[0] });
        if (userApoderado && userApoderado.padres && userApoderado.padres.length > 0) {
          const padre = userApoderado.padres.find(p => p.es_usuario_cuenta) || userApoderado.padres[0];
          const nombrePadre = ((padre.nombre || '') + ' ' + (padre.apellido || '')).trim();
          if (nombrePadre) apoderado = nombrePadre;
        }
      }

      alumnos.push({
        nombre: nombreAlumno,
        curso: curso,
        seccion: seccion || '',
        apoderado,
        cpa_pagado: cpaPagado
      });
    }

    // 3. Ordenar: primero pendientes, luego pagados, alfabéticamente dentro de cada grupo
    alumnos.sort((a, b) => {
      if (a.cpa_pagado !== b.cpa_pagado) return a.cpa_pagado ? 1 : -1;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });

    console.log(`${tag} Total: ${alumnos.length}, Pagados: ${alumnos.filter(a => a.cpa_pagado).length}, Pendientes: ${alumnos.filter(a => !a.cpa_pagado).length}`);
    res.json(alumnos);

  } catch (err) {
    console.error(`${tag} Error:`, err);
    res.status(500).json({ error: 'Error al consultar estado CPA del curso' });
  }
});


// Endpoint: Reconciliar pagos confirmados en paymentOrders que no tienen registro en pagos
router.get('/reconciliar_pagos', async (req, res) => {
  const tag = '[GET /api/reconciliar_pagos]';
  try {
    const { user_email } = req.query;
    if (!user_email) return res.status(400).json({ error: 'user_email requerido' });

    // 1. Buscar paymentOrders pagadas (status 200) de este usuario
    const ordenesPagadas = await db_support.paymentOrdersDB.find({ 
      email: user_email, 
      status: '200'
    });

    if (!ordenesPagadas || ordenesPagadas.length === 0) {
      return res.json({ reconciliados: 0, pagos_nuevos: [] });
    }

    // 2. Para cada orden pagada, verificar si ya existe un pago con ese commerce_order
    const pagosNuevos = [];
    for (const orden of ordenesPagadas) {
      const commerceOrder = String(orden.commerceOrder);
      const existePago = await db_support.pagosDB.findOne({ commerce_order: commerceOrder });
      
      if (!existePago) {
        // No tiene registro en pagos — crearlo
        const optional = orden.optional ? (typeof orden.optional === 'string' ? JSON.parse(orden.optional) : orden.optional) : {};
        const nombresHijos = optional['Nombre Hijos'] ? optional['Nombre Hijos'].split(',') : [];
        const primerHijo = nombresHijos[0] || '';
        
        // Determinar tipo/subtipo
        const subject = orden.subject || '';
        const esCuotaCpa = subject.toLowerCase().includes('cuota') && subject.toLowerCase().includes('cpa');
        const esInvitacion = subject.toLowerCase().includes('invitacion') || subject.toLowerCase().includes('fiesta') || subject.toLowerCase().includes('adicional');
        
        // Si no tiene subject, inferir por monto
        let subtipo = subject;
        if (!subtipo) {
          if (orden.amount === 5000) subtipo = 'invitaciones_fiesta_chilena';
          else if (orden.amount >= 20000) subtipo = 'cuota_cpa';
          else subtipo = 'otro';
        }

        const nuevoPago = {
          id: primerHijo,
          num_folio: parseInt(commerceOrder) || 0,
          tipo: orden.payment_method || 'flow',
          subtipo: subtipo,
          cuota_cpa: esCuotaCpa,
          monto: orden.amount || 0,
          cantidad_agendas: 0,
          entrega_agendas: 0,
          fecha: new Date().toLocaleDateString('es-CL'),
          comentarios: 'Reconciliado automáticamente',
          entradas_pagadas: 0,
          payment_method: orden.payment_method || 'flow',
          commerce_order: commerceOrder,
        };

        await db_support.pagosDB.create(nuevoPago);
        pagosNuevos.push(nuevoPago);
        console.log(`${tag} Pago reconciliado: ${commerceOrder} -> ${subtipo} $${orden.amount}`);
      }
    }

    console.log(`${tag} Reconciliados: ${pagosNuevos.length} de ${ordenesPagadas.length} órdenes`);
    res.json({ reconciliados: pagosNuevos.length, pagos_nuevos: pagosNuevos });

  } catch (err) {
    console.error(`${tag} Error:`, err);
    res.status(500).json({ error: 'Error al reconciliar pagos' });
  }
});


module.exports = router;

