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

        // Comparacion case-insensitive: el correo del login puede diferir en
        // mayus/minus respecto al apoderado_email guardado en la BD.
        const emailRegex = new RegExp('^' + user_email.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
        const hijos = await db_support.hermanosMapDB.find({$and:[{apoderado_email:{$exists:true}},{apoderado_email: emailRegex}]});
        console.log(`${tag} hijos con apoderado ${user_email}: `, hijos.length);

        res.json(hijos);
    } catch (err) {
        console.log(`${tag} Unexpected error: `, err);
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
      let apoderado_email = '';
      const hermanoInfo = await db_support.hermanosMapDB.findOne({ id: nombreAlumno });
      if (hermanoInfo && hermanoInfo.apoderado_email && hermanoInfo.apoderado_email.length > 0) {
        apoderado_email = hermanoInfo.apoderado_email[0];
        apoderado = apoderado_email;
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
        apoderado_email,
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

    const pagosNuevos = [];
    
    const pasarelas_de_pago = ['flow', 'transbank', "mercado pago"];

    for (const pasarela of pasarelas_de_pago) {
      // 1. Buscar paymentOrders pagadas (status 200) de este usuario
      const ordenesPagadas = await db_support.paymentOrdersDB.find({ 
        email: user_email, 
        estado_del_pago: 'pagado',
        status: 200,
        pasarela_de_pagos: pasarela
      });

      if (!ordenesPagadas || ordenesPagadas.length === 0) {
        //return res.json({ reconciliados: 0, pagos_nuevos: [] });
        continue; // No hay órdenes pagadas para esta pasarela, continuar con la siguiente
      }

      // 2. Para cada orden pagada, verificar si ya existe un pago con ese commerce_order
      for (const orden of ordenesPagadas) {
        const commerceOrder = String(orden.commerceOrder);
        const existePago = await db_support.pagosDB.findOne({ commerce_order: commerceOrder, tipo: pasarela });
        
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
            tipo: pasarela,
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
    }
    console.log(`${tag} Reconciliados: ${pagosNuevos.length} de ${pagosNuevos.length} órdenes`);
    res.json({ reconciliados: pagosNuevos.length, pagos_nuevos: pagosNuevos });

  } catch (err) {
    console.error(`${tag} Error:`, err);
    res.status(500).json({ error: 'Error al reconciliar pagos' });
  }
});


// Consulta Listas de Curso (para pruebas y herramientas internas)
// Queries: id_organizacion=cpa_patrona, curso=1A, cpa_pagado=true, hermanos=true
router.get('/consulta/listas_curso', async (req, res) => {
  const tag = '[GET /api/consulta/listas_curso]';
  try {
    const { id_organizacion, curso, cpa_pagado = 'false', hermanos = 'false' } = req.query;

    // Verificar que id_organizacion esté presente
    if (!id_organizacion) {
      return res.status(400).json({ error: 'Parámetro "id_organizacion" es requerido' });
    }
    // Verificar que curso esté presente
    if (!curso) {
      return res.status(400).json({ error: 'Parámetro "curso" es requerido' });
    }
    
    // Convertir cpa_pagado y hermanos a booleanos
    const cpaPagadoBool = cpa_pagado === 'true';
    const hermanosBool = hermanos === 'true';

    // Buscar listado de curso
    const listadoCurso = await db_support.listadoCursosDB.findOne({ id: curso }).lean();
    if (!listadoCurso || !listadoCurso.listaCurso) {
      return res.status(404).json({ error: `No se encontró listado para curso ${curso}` });
    }

    let alumnos = listadoCurso.listaCurso;

    // Filtrar aquellos que no tienen apoderados registrados
    const lista_hermanos = await db_support.hermanosMapDB.find({ id: { $in: alumnos } }).lean();
    //console.log(`${tag} Total alumnos en listado: ${alumnos.length}, con info en hermanosMapDB: ${lista_hermanos.length}`);

    const alumnosSinApoderado = lista_hermanos.filter(alumno => !alumno.apoderado_email || alumno.apoderado_email.length === 0).map(alumno => alumno.id);
    alumnos = alumnos.filter(alumno => alumnosSinApoderado.includes(alumno));

    const mapaHermanos = lista_hermanos.reduce((acc, alumno) => {
      acc[alumno.id] = alumno.hermanos || [];
      return acc;
    }, {});

    // Convertir a lista de objetos con información adicional: nombre, cpa_pagado, hermanos, entradas
    let lista_alumnos = alumnos.map(nombre => { return { nombre: nombre, cpa_pagado: false, hermanos: mapaHermanos[nombre].length-1, entradas_pagadas: 0 }; });
    //console.log(`${tag} Total alumnos: ${alumnos.length}, lista_alumnos: ${lista_alumnos.length}`);
    // Si se requiere filtrar por hermanos registrados
    if (hermanosBool) {
      //console.log(`${tag} Filtrando alumnos con hermanos registrados...`);
      const alumnosConHermanos = lista_hermanos.filter(alumno => alumno.hermanos.length > 1).map(alumno => alumno.id);
      alumnos = alumnos.filter(alumno => alumnosConHermanos.includes(alumno));
    }


    const lista_pagos = await db_support.pagosDB.find({ cuota_cpa: true, id: { $in: alumnos } }).lean();
    const alumnosConPago = lista_pagos.map(pago => pago.id);
    // Actualizar lista_alumnos con cpa_pagado = true para los que tienen pago
    //console.log(`${tag} Total lista_alumnos: ${lista_alumnos.length}, con CPA pagado: ${alumnosConPago.length}`);
    lista_alumnos = lista_alumnos.map(alumno => {
      if (alumnosConPago.includes(alumno.nombre)) {
        return { ...alumno, cpa_pagado: true };
      }
      return alumno;
    });
    //console.log(`${tag} Total lista_alumnos actualizada: ${lista_alumnos.length}, con CPA pagado: ${alumnosConPago.length}`);

    // Si se requiere filtrar por CPA pagado
    if (cpaPagadoBool) {
      alumnos = alumnos.filter(alumno => alumnosConPago.includes(alumno));
    }

    // Remover de lista_alumnos aquellos que no están en alumnos (filtrados)
    lista_alumnos = lista_alumnos.filter(alumno => alumnos.includes(alumno.nombre));

    res.json({ alumnos: lista_alumnos });
  } catch (err) {
    console.error(`${tag} Error:`, err);
    res.status(500).json({ error: `Error inesperado al consultar listas de curso: ${err.message}` });
  }
});

/*router.get('/consulta/database/name', async (req, res) => {
  const tag = '[GET /api/consulta/database/name]';
  try {
    const currentDatabaseName = db_support.current_database_name;
    console.log(`${tag} currentDatabaseName: `, currentDatabaseName);
    res.json({ currentDatabaseName });
  } catch (error) {
    console.error(`${tag} Error: `, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});*/

router.get('/consulta/database/name', async (req, res) => {
  const tag = '[GET /api/consulta/database/name]';
  try {
    // 1. Obtener la conexión activa desde db_support o mongoose
    const connection = db_support.connection || db_support.mongoose?.connection;

    // 2. Extraer el nombre de la BD utilizando las distintas propiedades posibles de Mongoose/MongoDB Native Driver
    let currentDatabaseName = 
      connection?.name || 
      connection?.db?.databaseName || 
      '';

    // 3. Fallback: Parsear desde la cadena de conexión en config_env si sigue vacío
    if (!currentDatabaseName && config_env.MONGODB_URI) {
      try {
        const uri = new URL(config_env.MONGODB_URI);
        currentDatabaseName = uri.pathname.replace('/', '');
      } catch (e) {
        // Si no es un formato URL estándar, parsear manualmente
        const match = config_env.MONGODB_URI.match(/\/([^/?]+)(\?|$)/);
        if (match) currentDatabaseName = match[1];
      }
    }

    console.log(`${tag} currentDatabaseName: `, currentDatabaseName);
    currentDatabaseName = 'cpa_patrona_' + config_env.DATABASE_YEAR_NAME;
    res.json({ currentDatabaseName });
  } catch (error) {
    console.error(`${tag} Error: `, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Consultar informacion si una lista de estudiantes son hermanos o no, y si tienen apoderado registrado
router.get('/consulta/estudiantes/relacion', async (req, res) => {
  const tag = '[GET /api/consulta/estudiantes/relacion]';
  try {
    let { estudiantes = '' } = req.query;

    //console.log(`${tag} estudiantes: `, estudiantes);
    //console.log(`${tag} req.query: `, req.query);

    estudiantes = JSON.parse(estudiantes);

    if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
      return res.status(400).json({ error: 'Parámetro "estudiantes" debe ser un array no vacío' });
    }

    // Normalizador: ignora espacios extra al inicio/fin y espacios internos
    // duplicados. Evita que un nombre con espacio accidental (ej. "vicente ")
    // rompa la deteccion de hermanos y dispare el falso error de "familias sin mergear".
    const normNombre = (s) => (s || '').trim().replace(/\s+/g, ' ');

    const result_relacion = [];
    const excluir_estudiantes = new Set();

    for (const estudiante of estudiantes) {
      if (typeof estudiante !== 'string' || estudiante.trim() === '') {
        return res.status(400).json({ error: 'Todos los elementos en "estudiantes" deben ser strings no vacíos' });
      }
      //console.log(`${tag} Procesando estudiante: ${estudiante}`);
      if (excluir_estudiantes.has(normNombre(estudiante))) {
        //console.log(`${tag} Estudiante ${estudiante} ya fue procesado como hermano de otro estudiante, se omite.`);
        continue; // Omitir estudiantes ya procesados como hermanos
      }
      // Buscar por coincidencia exacta y, si falla, por nombre normalizado (tolerante a espacios)
      let hermanosInfo = await db_support.hermanosMapDB.findOne({ id: estudiante });
      if (!hermanosInfo) {
        const rxNombre = new RegExp('^\\s*' + normNombre(estudiante).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+') + '\\s*$', 'i');
        hermanosInfo = await db_support.hermanosMapDB.findOne({ id: rxNombre });
      }
      if (!hermanosInfo || !hermanosInfo.hermanos || hermanosInfo.hermanos.length === 0) {
        // No tiene hermanos registrados
        return res.status(404).json({ error: `No se encontró información de hermanos para el estudiante: ${estudiante}` });
      }
      //console.log(`${tag} Información de hermanos para ${estudiante}: `, hermanosInfo);
      const apoderadoEmail = hermanosInfo.apoderado_email;
      const hermanos = hermanosInfo.hermanos;

      // Verificar si todos los estudiantes proporcionados son hermanos entre sí
      // (comparacion normalizada, tolerante a espacios extra en cualquiera de los lados)
      const hermanosNorm = hermanos.map(normNombre);
      const sonHermanos = estudiantes.every(est => hermanosNorm.includes(normNombre(est)));
      //console.log(`${tag} Verificando si todos los estudiantes son hermanos entre sí: ${sonHermanos}`);
      if (sonHermanos) {
        //console.log(`${tag} Los estudiantes ${estudiantes.join(', ')} son hermanos entre sí.`);
        return res.json([{ estudiante, nombre_familia: hermanosInfo.nombre_familia , apoderadoEmail, hermanos }]);
      }

      hermanos.forEach(h => excluir_estudiantes.add(normNombre(h)));

      // No son todos hermanos
      result_relacion.push({
        estudiante,
        nombre_familia: hermanosInfo.nombre_familia,
        apoderadoEmail,
        hermanos
      });
    }
    res.json(result_relacion);
    // Aquí iría la lógica para consultar la relación entre estudiantes
    // res.json({ message: 'Consulta de relación de estudiantes no implementada aún' });
  } catch (error) {
    console.error(`${tag} Error: `, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Consultar si los hijos pertenecen a otros subgrupos como talleres, deportes, etc, para habilitar opciones relacionadas con esa pertenencia
router.get('/consulta/estudiantes/subpertenencia', async (req, res) => {
  const tag = '[GET /api/consulta/estudiantes/subpertenencia]';
  try {
    let { estudiantes = '', id_organizacion = '' } = req.query;
    
    estudiantes = JSON.parse(estudiantes);

    if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
      return res.status(400).json({ error: 'Parámetro "estudiantes" debe ser un array no vacío' });
    }

    // Aquí iría la lógica para consultar los subgrupos a los que pertenecen los estudiantes

    const subpertenencia = {};

    const perteneceHuilen = await db_support.HuilenMapDB.find({ id: { $in: estudiantes } }).lean();

    if (perteneceHuilen && perteneceHuilen.length > 0) {
      for (const estudiante of perteneceHuilen) {
        if (!subpertenencia[estudiante.id]) subpertenencia[estudiante.id] = [];
        subpertenencia[estudiante.id].push(estudiante.value);
      }
    }

    res.json(subpertenencia);
  } catch (error) {
    console.error(`${tag} Error: `, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Obtener todos los usuarios con hijos registrados (para pruebas y herramientas internas)
router.get('/consulta/usuarios_con_hijos', async (req, res) => {
  const tag = '[GET /api/consulta/usuarios_con_hijos]';
  try {
    // Buscar todos los usuarios que tengan hijos registrados en hermanosMapDB
    const usuariosConHijos = await db_support.hermanosMapDB.find({ apoderado_email: { $exists: true, $not: { $size: 0 } } }).lean();
    
    // Extraer los emails de los apoderados
    const apoderadosEmails = usuariosConHijos.flatMap(usuario => usuario.apoderado_email || []);
    
    // Eliminar duplicados
    const apoderadosEmailsUnicos = [...new Set(apoderadosEmails)];

    res.json({ total_usuarios_con_hijos: apoderadosEmailsUnicos.length, apoderados_emails: apoderadosEmailsUnicos });
  } catch (error) {
    console.error(`${tag} Error: `, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;

