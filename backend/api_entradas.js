// ./backend/api_entradas.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const { genEntradaCanvas } = require('../src/generateTicket'); 
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');

const SECRET_API_KEY = config_env.API_KEY;

// Mapeo auxiliar de jornadas
const JORNADA_MAP = { 'manana': 'Mañana', 'tarde': 'Tarde' };

async function save_png(buffer, filename = null) {
  try {
    // Definir directorio de destino (ej. ./tickets_png)
    const outputDir = path.join(__dirname, '../tickets_png');

    // Crear el directorio si no existe
    await fs.mkdir(outputDir, { recursive: true });

    // Definir nombre del archivo (si no viene uno, genera un timestamp)
    const name = filename 
      ? `${filename}.png` 
      : `ticket.png`;

    const filePath = path.join(outputDir, name);

    // Escribir el buffer directamente en el disco
    await fs.writeFile(filePath, buffer);
    console.log(`[save_png] Imagen guardada correctamente en: ${filePath}`);
    
    return filePath;
  } catch (error) {
    console.error('[save_png] Error al guardar el archivo PNG:', error);
  }
}

  // 1. POST: Generar entrada Canvas
router.post('/entrada/create', apiKeyAuth, async (req, res) => {
  const url_server = config_env.URL_SERVER || 'https://registro-patrona.onrender.com';
  console.log('POST /api/entrada/create:  started')
  try {
    console.log(JSON.stringify(req.body));
    const { 
            id_evento,
            imagen_ticket_path,
            familia, 
            nombre_completo, 
            colores, 
            num_listado, 
            curso, 
            jornada,
            bloques,
            tipo
          } = req.body;

    const bloqueText = Array.isArray(colores) ? colores.join('/') : colores;

    let buffer = null;

    const ticket = await db_support.ticketsDB.create({
      id_evento: id_evento,
      familia,
      nombre_completo,
      tipo,
      jornada,
      curso,
      bloque: bloqueText,
      num_listado: parseInt(num_listado) || 0,
      total: parseInt(total) || 0,
      fecha_generacion: new Date(),
      usado: false,
      validado_por: null,
      imagen_ticket: buffer
    });
    const folio = ticket.folio || 0;
    console.log(`[/api/entrada/create] Ticket ${folio} guardado en BD`);

    const ticketInfo = {...req.body, folio, url_server };
    buffer = await genEntradaCanvas(ticketInfo);
    // Update the ticket with the generated image
    await db_support.ticketsDB.findOneAndUpdate(
      { id_evento: id_evento, nombre_completo: nombre_completo },
      { $set: { imagen_ticket: buffer } }
    );

    save_png(buffer);
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generando entrada' });
  }
});

// 2. GET: Buscar Entradas (Supervisor)
router.get('/entrada/buscar', apiKeyAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Ingrese al menos 2 caracteres para buscar' });
    }

    const normalizar = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const busqueda = normalizar(q.trim());
    const todos = await db_support.ticketsDB.find({});

    const resultados = todos.filter(ticket => {
      const campos = [
        String(ticket.correlativo || ''),
        normalizar(ticket.familia),
        normalizar(ticket.nombre_completo),
        normalizar(ticket.curso),
        normalizar(ticket.bloque)
      ].join(' ');
      return campos.includes(busqueda);
    });

    res.json(resultados);
  } catch (error) {
    console.error('[/api/entrada/buscar] Error:', error);
    res.status(500).json({ error: 'Error al buscar entradas' });
  }
});

// 3. GET: Consultar estado de una entrada. Endpoint Publico. No requiere autenticación. Se puede usar para validar QR.
router.get('/entrada/consultar', async (req, res) => {
  try {
    const { folio, familia } = req.query;
    if (!folio) return res.status(400).json({ error: 'Falta folio' });

    const ticket = await db_support.ticketsDB.findOne({ correlativo: parseInt(correlativo) });

    if (!ticket) {
      return res.json({ existe: false, mensaje: 'Ticket no registrado en el sistema' });
    }

    return res.json({
      existe: true,
      usado: ticket.usado || false,
      fecha_uso: ticket.fecha_uso || null,
      validado_por: ticket.validado_por || null,
      familia: ticket.familia,
      nombre_completo: ticket.nombre_completo,
      tipo: ticket.tipo,
      jornada: ticket.jornada,
      curso: ticket.curso,
      bloque: ticket.bloque,
      num_listado: ticket.num_listado,
      total: ticket.total,
      correlativo: ticket.correlativo
    });
  } catch (error) {
    console.error('[/api/entrada/consultar] Error:', error);
    res.status(500).json({ error: 'Error al consultar entrada' });
  }
});

// 4. POST: Marcar ticket/entrada como usado (validar)
router.post('/entrada/validar', apiKeyAuth, async (req, res) => {
  try {
    const { correlativo, validado_por } = req.body;
    if (!correlativo) return res.status(400).json({ error: 'Falta correlativo' });

    const ticket = await db_support.ticketsDB.findOne({ correlativo: parseInt(correlativo) });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado en el sistema' });
    }

    if (ticket.usado) {
      return res.status(409).json({
        error: 'Este ticket ya fue utilizado',
        fecha_uso: ticket.fecha_uso,
        validado_por: ticket.validado_por
      });
    }

    await db_support.ticketsDB.findOneAndUpdate(
      { correlativo: parseInt(correlativo) },
      { $set: { usado: true, fecha_uso: new Date(), validado_por: validado_por || 'desconocido' } }
    );

    console.log(`[/api/entrada/validar] Ticket ${correlativo} marcado como usado por ${validado_por}`);
    res.json({ status: 'ok', mensaje: 'Ticket validado correctamente' });
  } catch (error) {
    console.error('[/api/entrada/validar] Error:', error);
    res.status(500).json({ error: 'Error al validar entrada' });
  }
});

// 5. GET: Endpoint JSON para datos completos de una entrada (QR)
router.get('/entrada/qr_data', apiKeyAuth, async (req, res) => {
  try {
    const { familia, jornada, tipo, correlativo } = req.query;
    const jornadaDisplay = JORNADA_MAP[jornada] || jornada;

    let info = null;
    if (correlativo) {
      info = await db_support.deliveryDB.findOne({ serial: parseInt(correlativo) });
    }

    res.json({
      familia: familia || '—',
      nombre_completo: info?.nombre_completo || familia || '—',
      tipo: tipo || '—',
      jornada: jornadaDisplay,
      curso: info?.curso || '—',
      bloque: info?.bloques ? (Array.isArray(info.bloques) ? info.bloques.join('/') : info.bloques) : '—',
      num_listado: info?.num_listado || '—',
      total: info?.total || '—',
      correlativo: correlativo || '—'
    });
  } catch (error) {
    console.error('[/api/entrada/qr_data] Error:', error);
    res.status(500).json({ error: 'Error al obtener datos de entrada' });
  }
});

// 6. GET: Vista HTML presentable de la Entrada QR
router.get('/entrada/qr', apiKeyAuth, async (req, res) => {
  try {
    const { familia, jornada, tipo, correlativo } = req.query;
    const jornadaDisplay = JORNADA_MAP[jornada] || jornada;

    let info = null;
    if (correlativo) {
      info = await db_support.deliveryDB.findOne({ serial: parseInt(correlativo) });
    }

    const nombre = info?.nombre_completo || familia || '—';
    const curso = info?.curso || '—';
    const bloque = info?.bloques || '—';
    const numListado = info?.num_listado || '—';
    const serial = String(correlativo).padStart(4, '0');

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Entrada - Fiesta a la Chilena</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', Tahoma, sans-serif;
            background: #f1f4f9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .ticket-card {
            background: white;
            border-radius: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.12);
            max-width: 420px;
            width: 100%;
            overflow: hidden;
          }
          .ticket-header {
            background: linear-gradient(135deg, #e53935, #d32f2f);
            padding: 24px 20px;
            text-align: center;
            color: white;
          }
          .ticket-header h1 { font-size: 1.4rem; margin-bottom: 4px; }
          .ticket-header p { font-size: 0.85rem; opacity: 0.9; }
          .ticket-body { padding: 24px 20px; }
          .ticket-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          .ticket-row:last-child { border-bottom: none; }
          .ticket-label {
            font-size: 0.8rem;
            font-weight: 700;
            color: #888;
            text-transform: uppercase;
          }
          .ticket-value {
            font-size: 0.95rem;
            font-weight: 600;
            color: #333;
            text-align: right;
          }
          .ticket-serial {
            text-align: center;
            margin-top: 16px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .ticket-serial span {
            font-size: 1.8rem;
            font-weight: 800;
            color: #e53935;
            letter-spacing: 3px;
          }
          .ticket-serial small {
            display: block;
            font-size: 0.75rem;
            color: #999;
            margin-top: 2px;
          }
          .badge {
            display: inline-block;
            background: #e8f5e9;
            color: #2e7d32;
            font-size: 0.8rem;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 20px;
          }
        </style>
      </head>
      <body>
        <div class="ticket-card">
          <div class="ticket-header">
            <h1>🎉 Fiesta a la Chilena 2025</h1>
            <p>Colegio Patrona de Lourdes</p>
          </div>
          <div class="ticket-body">
            <div class="ticket-row">
              <span class="ticket-label">Tipo</span>
              <span class="ticket-value"><span class="badge">${tipo || '—'}</span></span>
            </div>
            <div class="ticket-row">
              <span class="ticket-label">Nombre</span>
              <span class="ticket-value">${nombre}</span>
            </div>
            <div class="ticket-row">
              <span class="ticket-label">Familia</span>
              <span class="ticket-value">${familia || '—'}</span>
            </div>
            <div class="ticket-row">
              <span class="ticket-label">Jornada</span>
              <span class="ticket-value">${jornadaDisplay}</span>
            </div>
            <div class="ticket-row">
              <span class="ticket-label">Curso</span>
              <span class="ticket-value">${curso}</span>
            </div>
            <div class="ticket-row">
              <span class="ticket-label">N° Listado</span>
              <span class="ticket-value">${numListado}</span>
            </div>
            <div class="ticket-serial">
              <small>N° ENTRADA</small>
              <span>${serial}</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('[/api/entrada/qr] Error:', error);
    res.status(500).send('Error al cargar entrada');
  }
});

router.get('/entradas/pre_generar', apiKeyAuth, async (req, res) => {
  const tag = '[/api/entradas/pre_generar]';
  const nombres_estudiantes = [];
  try {
    const id_evento = req.query.id_evento;
    // Obtener listado de cursos desde la base de datos
    const listadoCursos = await db_support.listadoCursosDB.find();

    // Iterar sobre los cursos obtenidos
    for (const curso of listadoCursos) {
      // Procesar cada curso
      console.log(`${tag} pre-generando entradas para el curso: ${curso.id}`);
      //console.log(`Estudiantes curso: ${curso.estudiantesCurso}`);
      // Iterando sobre objecto estudiantesCurso
      for (const nombre_completo of Object.keys(curso.estudiantesCurso)) {
        // Verificar si nombre_complete ya existe en nombres_estudiantes para evitar duplicados
        if (!nombres_estudiantes.includes(nombre_completo)) {
          // Generar entrada para la familia del estudiante
          const nombres = await generarEntradaParaFamilia(id_evento, nombre_completo);
          // Agregar nombres generados a la lista de nombres_estudiantes
          nombres_estudiantes.push(...nombres);
        }
      }
    }
    console.log(`${tag} Pre-generación de entradas completada. Total estudiantes procesados: ${nombres_estudiantes.length}`);
    res.json({ status: 'ok', total_estudiantes: nombres_estudiantes.length });
  } catch (error) {
    console.error('[/api/entradas/pre_generar] Error:', error);
    res.status(500).json({ error: 'Error al pre-generar entradas' });
  }
});

async function generarEntradaParaFamilia(id_evento, imagen_ticket_path, nombre_completo) {
  const lista_entradas = [];
  // Detecta si está en producción según NODE_ENV o si existe URL_SERVER
  const PORT = process.env.PORT;
  const baseUrl = PORT !== 5001 
    ? config_env.URL_SERVER
    : `http://localhost:5001`;  
  try {
    //console.log(`Generando entrada para la familia del estudiante: ${nombre_completo} en el evento: ${id_evento}`);
    // Buscar la familia en la base de datos usando el nombre completo del estudiante
    const familiaInfo = await db_support.hermanosMapDB.findOne({ 'id': nombre_completo });
    const { nombre_familia, hermanos } = familiaInfo || {};
    // Buscar Cursos
    const cursos = []
    for (const nombre_estudiante of hermanos || []) {
      const estudianteInfo = await db_support.nombreCursoMapDB.findOne({ 'id': nombre_estudiante });
      const curso = estudianteInfo.value;
      cursos.push(curso);
      const cursoInfo = await db_support.listadoCursosDB.findOne({ id: curso});
      const num_listado = cursoInfo.estudiantesCurso[nombre_estudiante].no_lista;
      // , , , , , , jornada, bloques
      const result_create = await fetch(`${baseUrl}/api/entrada/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify({
          id_evento,
          imagen_ticket_path,
          familia: nombre_familia,
          nombre_completo: nombre_estudiante,
          tipo: 'estudiante',
          curso,
          num_listado
          })
        });
      if (result_create.status != 200 ) {
        console.log(`La entrada para ${nombre_estudiante} no se pudo crear`);
        continue;
      }
      lista_entradas.push(nombre_estudiante);
      //console.log(`Estudiante: ${nombre_estudiante}, Curso: ${estudianteInfo.value}`);
    }
    return hermanos;
    // Pending
  } catch (error) {
    console.error(`Error al generar entrada para la familia del estudiante ${nombre_completo}:`, error);
  }
  return [];
}

router.post('/entradas/generar/familia', apiKeyAuth, async (req, res) => {
  const tag = '[POST /api/entradas/generar/familia]';
  try {
    const { id_evento, imagen_ticket_path, nombre_completo } = req.body;
    if (!id_evento || !nombre_completo) {
      return res.status(400).json({ error: 'Faltan parámetros: id_evento y nombre_completo son requeridos' });
    }

    const nombres_estudiantes = await generarEntradaParaFamilia(id_evento, imagen_ticket_path, nombre_completo);
    
    console.log(`${tag} Entradas generadas para la familia del estudiante ${nombre_completo}: ${nombres_estudiantes.join(', ')}`);
    res.json({ status: 'ok', estudiantes: nombres_estudiantes });
  } catch (error) {
    console.error(`${tag} Error al generar entradas para la familia del estudiante ${req.body.nombre_completo}:`, error);
    res.status(500).json({ error: 'Error al generar entradas para la familia' });
  }
});




//// Api Eventos
router.post('/eventos/crear', apiKeyAuth, async (req, res) => {
  try {
    const { id_evento, 
            nombre, 
            fecha, 
            descripcion, 
            hora_inicio,
            hora_termino,
            hora_apertura_puertas,
            imagen_ticket_path 
          } = req.body;
    const evento = await db_support.EventDB.find({ id_evento });
    if (evento.length > 0) {
      console.log(`Evento con id_evento ${id_evento} ya existe.`);
      return res.status(400).json({ error: 'Evento ya existe' });
    }

    const nuevoEvento = new db_support.EventDB({
      id_evento,
      nombre,
      fecha: new Date(fecha),
      descripcion,
      hora_inicio,
      hora_termino,
      hora_apertura_puertas,
      imagen_ticket_path
    });

    await nuevoEvento.save();
    console.log(`Evento ${nombre} creado con éxito.`);  
    res.json(evento);
  } catch (error) {
    console.error('[/api/eventos/crear] Error:', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

router.get('/eventos/buscar', apiKeyAuth, async (req, res) => {
  try {
    const { id_evento } = req.query;
    const evento = await db_support.EventDB.find({ id_evento });
    if (evento.length === 0) {
      console.log(`Evento con id_evento ${id_evento} no encontrado.`);
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    res.json(evento);
  } catch (error) {
    console.error('[/api/eventos/buscar] Error:', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

module.exports = router;