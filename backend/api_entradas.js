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
//const { info } = require('console');
const { send_email_from_cpa_account } = require('../api-correo/send_fiesta_chilena_email.js');
const { generarPdfDesdeBuffers, save_pdf } = require('./pdf_helper.js');


const SECRET_API_KEY = config_env.API_KEY;

// Mapeo auxiliar de jornadas
const JORNADA_MAP = { 'manana': 'Mañana', 'tarde': 'Tarde' };


async function append_qr_data(qr_str, filename = 'qr_data.txt') {
  try {
    if (!qr_str) {
      console.warn('[append_qr_data] No se proporcionó ningún texto para guardar.');
      return false;
    }

    // Directorio de salida (ajusta la ruta según lo requieras)
    const outputDir = path.join(__dirname, '../logs');
    const filePath = path.join(outputDir, filename);

    // Asegurar que la carpeta exista antes de escribir
    await fs.mkdir(outputDir, { recursive: true });

    // Agregar el texto seguido de un salto de línea
    const dataToAppend = `${qr_str.trim()}\n`;

    // 'a' es el flag por defecto de appendFile (crea el archivo si no existe, o añade al final)
    await fs.appendFile(filePath, dataToAppend, 'utf8');

    // console.log(`[append_qr_data] QR registrado con éxito en: ${filePath}`);
    return true;

  } catch (error) {
    console.error('[append_qr_data] Error al escribir el archivo:', error);
    return false;
  }
}


async function save_png(buffer, filename = null) {
  try {
    // Definir directorio de destino (ej. ./tickets_png)
    const outputDir = path.join(__dirname, '../tickets_png');

    // Crear el directorio si no existe
    await fs.mkdir(outputDir, { recursive: true });

    const png_extension = filename.endsWith('.png') ? '' : '.png'
    // Definir nombre del archivo (si no viene uno, genera un timestamp)
    const name = filename 
      ? `${filename}${png_extension}` 
      : `ticket.png`;

    const filePath = path.join(outputDir, name);

    // Escribir el buffer directamente en el disco
    await fs.writeFile(filePath, buffer);
    //console.log(`[save_png] Imagen guardada correctamente en: ${filePath}`);
    
    return filePath;
  } catch (error) {
    console.error('[save_png] Error al guardar el archivo PNG:', error);
  }
}

  // 1. POST: Generar entrada Canvas
router.post('/entrada/create', apiKeyAuth, async (req, res) => {
  const tag = '[/api/entrada/create]';
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


    const ticket = await db_support.TicketEventoDB.create({
      id_organizacion: id_organizacion,
      id_evento: id_evento,
      familia: familia || '',
      nombre_completo: nombre_completo || '',
      tipo: tipo || '',
      jornada: jornada || '',
      curso: curso || '',
      bloques: bloques || '',
      num_listado: parseInt(num_listado) || 0,
      fecha_generacion: new Date(),
      usado: false,
      validado_por: null,
      //imagen_ticket: null,
      historial: [{accion: 'creacion', descripcion: ''}]
    });
    const folio = ticket.folio || 0;
    //console.log(`[/api/entrada/create] Ticket ${folio} guardado en BD`);

    const ticketInfo = {...req.body, folio, url_server };
    const [buffer, qr_str] = await genEntradaCanvas(ticketInfo);

    if (buffer) {
      // Update the ticket with the generated image
      await db_support.TicketEventoDB.findOneAndUpdate(
        { folio, id_evento: id_evento, nombre_completo: nombre_completo },
        //{ $set: { imagen_ticket: buffer, qr_str } }
        { $set: { qr_str } }
      );
      if (save_file)
        await save_png(buffer, `f${folio.toString().padStart(4,'0')}_${familia.replace(' ', '_')}`);
      else 
        await append_qr_data(qr_str);
    } else {
      console.log(`${tag} image buffer null`)
    }
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'POST /entrada/create Error no especifico' });
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
    const todos = await db_support.TicketEventoDB.find({});

    const resultados = todos.filter(ticket => {
      const campos = [
        String(ticket.folio || ''),
        normalizar(ticket.familia),
        normalizar(ticket.nombre_completo),
        normalizar(ticket.curso),
        normalizar(ticket.bloques)
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
    const { folio, familia, tipo_output = 'html' } = req.query;
    if (!folio) {
      if (tipo_output === 'json') {
        return res.status(400).json({ error: 'Error de Consulta. Falta el parámetro folio' });
      }
      return res.status(400).send('<h2>Error: Error de Consulta. El parámetro "folio" es requerido.</h2>');
    }

    const ticket = await db_support.TicketEventoDB.findOne({ folio: parseInt(folio) });

    if ( tipo_output === 'json' ) {
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
        bloques: ticket.bloques,
        num_listado: ticket.num_listado,
        folio: ticket.folio,
        estado: ticket.estado
      });
    }
    if ( tipo_output === 'html') {
const serial = String(folio).padStart(4, '0');

      // Escenario 1: Ticket no existe
      if (!ticket) {
        return res.send(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Entrada Inválida - Fiesta a la Chilena</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #fdf2f2; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
              .card { background: white; border-radius: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 400px; width: 100%; text-align: center; padding: 30px 20px; border-top: 6px solid #d32f2f; }
              .icon { font-size: 3.5rem; color: #d32f2f; margin-bottom: 10px; }
              h1 { color: #d32f2f; font-size: 1.4rem; margin-bottom: 10px; }
              p { font-size: 0.95rem; color: #666; margin-bottom: 15px; }
              .folio-box { background: #f8d7da; color: #721c24; padding: 8px 15px; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 1.1rem; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">⚠️</div>
              <h1>Entrada No Registrada</h1>
              <p>El ticket consultado no existe o no se encuentra registrado en el sistema.</p>
              <div class="folio-box">Folio N°: ${serial}</div>
            </div>
          </body>
          </html>
        `);
      }

      // Preparar variables para renderizar si el ticket existe
      const jornadaDisplay = JORNADA_MAP[ticket.jornada] || ticket.jornada || '—';
      const fechaUsoFormatted = ticket.fecha_uso 
        ? new Date(ticket.fecha_uso).toLocaleString('es-CL', { timeZone: 'America/Santiago' })
        : '—';

      // Configurar badges de estado
      const isUsado = ticket.usado;
      const statusBadge = isUsado 
        ? `<span class="badge badge-usado">🚫 ENTRADA UTILIZADA</span>`
        : `<span class="badge badge-valido">✅ ENTRADA VÁLIDA</span>`;

      // Escenario 2 y 3: Renderizado de la tarjeta del ticket
      return res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Estado de Entrada - Fiesta a la Chilena</title>
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
              background: ${isUsado ? 'linear-gradient(135deg, #757575, #424242)' : 'linear-gradient(135deg, #e53935, #d32f2f)'};
              padding: 24px 20px;
              text-align: center;
              color: white;
            }
            .ticket-header h1 { font-size: 1.4rem; margin-bottom: 4px; }
            .ticket-header p { font-size: 0.85rem; opacity: 0.9; }
            .ticket-body { padding: 24px 20px; }
            .status-container {
              text-align: center;
              margin-bottom: 20px;
            }
            .badge {
              display: inline-block;
              font-size: 0.85rem;
              font-weight: 700;
              padding: 6px 14px;
              border-radius: 20px;
            }
            .badge-valido { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
            .badge-usado { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
            
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
              color: ${isUsado ? '#616161' : '#e53935'};
              letter-spacing: 3px;
            }
            .ticket-serial small {
              display: block;
              font-size: 0.75rem;
              color: #999;
              margin-top: 2px;
            }
            .uso-info {
              background: #fff8e1;
              border-left: 4px solid #ffb300;
              padding: 10px;
              border-radius: 4px;
              font-size: 0.8rem;
              color: #5d4037;
              margin-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="ticket-card">
            <div class="ticket-header">
              <h1>🎉 Fiesta a la Chilena</h1>
              <p>Colegio Patrona de Lourdes</p>
            </div>
            <div class="ticket-body">
              <div class="status-container">
                ${statusBadge}
              </div>

              <div class="ticket-row">
                <span class="ticket-label">Tipo</span>
                <span class="ticket-value">${ticket.tipo || '—'}</span>
              </div>
              <div class="ticket-row">
                <span class="ticket-label">Nombre</span>
                <span class="ticket-value">${ticket.nombre_completo || '—'}</span>
              </div>
              <div class="ticket-row">
                <span class="ticket-label">Familia</span>
                <span class="ticket-value">${ticket.familia || '—'}</span>
              </div>
              <div class="ticket-row">
                <span class="ticket-label">Jornada</span>
                <span class="ticket-value">${jornadaDisplay}</span>
              </div>
              <div class="ticket-row">
                <span class="ticket-label">Curso</span>
                <span class="ticket-value">${ticket.curso || '—'}</span>
              </div>
              <div class="ticket-row">
                <span class="ticket-label">Bloque</span>
                <span class="ticket-value">${ticket.bloques || '—'}</span>
              </div>

              ${isUsado ? `
                <div class="uso-info">
                  📌 <strong>Validado el:</strong> ${fechaUsoFormatted}<br>
                  👤 <strong>Validado por:</strong> ${ticket.validado_por || 'desconocido'}
                </div>
              ` : ''}

              <div class="ticket-serial">
                <small>N° FOLIO</small>
                <span>${serial}</span>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('[/api/entrada/consultar] Error:', error);
    res.status(500).json('<h2>Error interno del servidor al consultar la entrada</h2>');
  }
});

// 4. POST: Marcar ticket/entrada como usado (validar)
router.post('/entrada/validar', apiKeyAuth, async (req, res) => {
  try {
    const { folio, validado_por } = req.body;
    if (!folio) return res.status(400).json({ error: 'Falta folio' });

    const ticket = await db_support.TicketEventoDB.findOne({ folio: parseInt(folio) });

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

    await db_support.TicketEventoDB.findOneAndUpdate(
      { folio: parseInt(folio) },
      { 
        $set: { 
          usado: true, 
          fecha_uso: new Date(), 
          validado_por: validado_por || 'desconocido',
          estado: 'usada'
        },
        $push: {
          historial: {
            accion: 'ingreso',
            descripcion: `ingreso validado por ${validado_por}`
          }
        }
      }
    );

    console.log(`[/api/entrada/validar] Ticket ${folio} marcado como usado por ${validado_por}`);
    res.json({ status: 'ok', mensaje: 'Ticket validado correctamente' });
  } catch (error) {
    console.error('[/api/entrada/validar] Error:', error);
    res.status(500).json({ error: 'Error al validar entrada' });
  }
});

// 5. GET: Endpoint JSON para datos completos de una entrada (QR)
router.get('/entrada/qr_data', apiKeyAuth, async (req, res) => {
  try {
    const { familia, jornada, tipo, folio } = req.query;
    const jornadaDisplay = JORNADA_MAP[jornada] || jornada;

    let info = null;
    if (folio) {
      info = await db_support.deliveryDB.findOne({ serial: parseInt(folio) });
    }

    res.json({
      familia: familia || '—',
      nombre_completo: info?.nombre_completo || familia || '—',
      tipo: tipo || '—',
      jornada: jornadaDisplay,
      curso: info?.curso || '—',
      bloques: info?.bloques ? (Array.isArray(info.bloques) ? info.bloques.join('/') : info.bloques) : '—',
      num_listado: info?.num_listado || '—',
      folio: folio || '—'
    });
  } catch (error) {
    console.error('[/api/entrada/qr_data] Error:', error);
    res.status(500).json({ error: 'Error al obtener datos de entrada' });
  }
});

// 6. GET: Vista HTML presentable de la Entrada QR
router.get('/entrada/qr', apiKeyAuth, async (req, res) => {
  try {
    const { familia, jornada, tipo, folio } = req.query;
    const jornadaDisplay = JORNADA_MAP[jornada] || jornada;

    let info = null;
    if (folio) {
      info = await db_support.deliveryDB.findOne({ serial: parseInt(folio) });
    }

    const nombre = info?.nombre_completo || familia || '—';
    const curso = info?.curso || '—';
    const bloques = info?.bloques || '—';
    const numListado = info?.num_listado || '—';
    const serial = String(folio).padStart(4, '0');

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

// 7. Get Imagen del Ticket
router.get('/entrada/imagen', apiKeyAuth, async (req, res) => {
  const tag = '[/api/entrada/imagen]';
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
          } = req.query;


    const ticketInfo = await db_support.TicketEventoDB.findOne({
      id_organizacion: id_organizacion,
      id_evento: id_evento,
      familia: familia,
      nombre_completo: nombre_completo,
      tipo: tipo,
      folio: folio
    });

    //const ticketInfo = {...ticket, folio, url_server };
    const [buffer, qr_str] = await genEntradaCanvas({...ticketInfo, url_server});

    res.set('Content-Type', 'image/png');
    if (buffer) {
      res.send(buffer);
    } else {
      console.log(`${tag} image buffer null`);
      res.status(500).json({ error: 'POST /entrada/imagen Error imagen no disponible' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'POST /entrada/imagen Error no especifico' });
  }
});


// 8. Get tickets de una familia
router.get('/entrada/familia', apiKeyAuth, async (req, res) => {
  const tag = '[/api/entrada/familia]';
  const url_server = config_env.URL_SERVER || 'https://registro-patrona.onrender.com';
  try {
    console.log(`${tag} req.query`, JSON.stringify(req.query));
    let id_familia = null;
    const { 
            id_organizacion,
            id_evento,
            familia, 
            nombre_completo, 
            folio
          } = req.query;

    const estudiantes = [];

    if (familia) {
      id_familia = familia;
    } else if (nombre_completo) {
      const familiaInfo = await db_support.hermanosMapDB.findOne({ 'id': nombre_completo });
      const { nombre_familia, hermanos } = familiaInfo || {};
      id_familia = nombre_familia;
    } else if (folio) {
      const ticketInfo = await db_support.TicketEventoDB.findOne({id_organizacion, id_evento, folio});
      id_familia = ticketInfo.familia;
    }
    if (id_familia) {
      const tickets = await db_support.TicketEventoDB.find({ id_organizacion, id_evento, familia: id_familia});
      if (tickets) {
        //console.log(`${tag} ${tickets.length} tickets encontrados para familia ${familia}`);
        res.status(200).json(tickets);
      } else {
        console.log(`${tag} No se encontraron tickets asociados a familia ${familia}`);
        res.status(401).json({error: `no se encontraron tickets asociados a la familia ${familia}`});
      }
    } else {
      console.log(`${tag} Error en id_familia para familia ${familia}`);
      res.status(500).json({ error: `${tag} familia no encontrada` });  
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `${tag}  Error no especifico` });
  }
});



router.get('/entradas/pre_generar', apiKeyAuth, async (req, res) => {
  const tag = '[/api/entradas/pre_generar]';
  const nombres_estudiantes = [];
  try {
    const id_organizacion = req.query.id_organizacion;
    const id_evento = req.query.id_evento;

    //console.log(`${tag} ${JSON.stringify({id_organizacion, id_evento})}`);
    
    // Obtener informacion del evento:
    const infoEvento = await db_support.EventDB.findOne({id_evento});
    const curso_bloques = infoEvento ? infoEvento.cursoBloqueMap : {};
    //console.log(`${tag} infoEvento: `, infoEvento);
    const imagen_ticket_path = infoEvento.imagen_ticket_path;

    // Obtener listado de cursos desde la base de datos
    const listadoCursos = await db_support.listadoCursosDB.find();
    
    // Iterar sobre los cursos obtenidos
    for (const curso of listadoCursos) {
      // Procesar cada curso
      console.log(`${tag} pre-generando entradas para el curso: ${curso.id}`);
      //console.log(`Estudiantes curso: ${curso.estudiantesCurso}`);
      // Iterando sobre objecto estudiantesCurso
      //console.log(`${tag} curso.estudiantesCurso: `, curso.estudiantesCurso);
      for (const nombre_completo of Object.keys(curso.estudiantesCurso)) {
        //console.log(`${tag} nombre_completo: `, nombre_completo);
        // Verificar si nombre_complete ya existe en nombres_estudiantes para evitar duplicados
        if (!nombres_estudiantes.includes(nombre_completo)) {
          // Generar entrada para la familia del estudiante
          //console.log(`${tag} calling generarEntradaParaFamilia(${JSON.stringify({id_organizacion, id_evento, imagen_ticket_path, nombre_completo, curso_bloques})})`);
          const nombres = await generarEntradaParaFamilia(id_organizacion, id_evento, imagen_ticket_path, nombre_completo, curso_bloques);
          if (!nombres || !nombres.length) {
            console.log(`${tag} failed creating entradas para familia de ${nombres_estudiantes}`);
            return;
          }
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

async function generarEntradaParaFamilia(id_organizacion, id_evento, imagen_ticket_path, nombre_completo, curso_bloques, save_file) {
  const tag = '[generarEntradaParaFamilia]';
  const lista_entradas = [];
  // Detecta si está en producción según NODE_ENV o si existe URL_SERVER
  const localPort = process.env.PORT || 5001;
  const baseUrl = localPort !== 5001 
    ? config_env.URL_SERVER
    : `http://localhost:5001`;  
  //console.log(`generarEntradaParaFamilia: ${JSON.stringify({id_evento, imagen_ticket_path, nombre_completo})}`);
  //console.log(`${tag} url_server: ${baseUrl}`);
  try {
    //console.log(`Generando entrada para la familia del estudiante: ${nombre_completo} en el evento: ${id_evento}`);
    // Buscar la familia en la base de datos usando el nombre completo del estudiante
    const familiaInfo = await db_support.hermanosMapDB.findOne({ 'id': nombre_completo });
    const { nombre_familia, hermanos } = familiaInfo || {};

    // Arreglos
    const cursos = new Set();
    const jornadas = new Set();
    const bloques = new Set();
    const personas = [];
    let max_apoderados = 0;
    let max_invitados = 0;
    
    const jornadaMap = { manana: 'AM', tarde: 'PM'};

    const infoPersona = {id_organizacion, id_evento, imagen_ticket_path, familia: nombre_familia, save_file};

    // Buscar Cursos
    for (const nombre_estudiante of hermanos || []) {
      const estudianteInfo = await db_support.nombreCursoMapDB.findOne({ 'id': nombre_estudiante });
      const curso = estudianteInfo.value;
      cursos.add(curso);
      const bloqueInfo = curso_bloques[curso];
      jornadas.add(jornadaMap[bloqueInfo.jornada] || bloqueInfo.jornada);
      bloques.add(bloqueInfo.bloque);
      max_apoderados = Math.max(max_apoderados, bloqueInfo.pases_apoderados);
      max_invitados = Math.max(max_invitados, bloqueInfo.pases_invitados);
      const cursoInfo = await db_support.listadoCursosDB.findOne({ id: curso});
      const num_listado = cursoInfo.estudiantesCurso[nombre_estudiante].no_lista;
      const persona = { ...infoPersona, nombre_completo: nombre_estudiante, curso, num_listado};
      personas.push(persona);
    }

    const jornada = [...jornadas].join('/');
    const bloque_str = [...bloques].toSorted().join('/').replaceAll('_', ' ');

    for ( const estudiante of personas ) {
      estudiante['tipo'] = 'estudiante';
      estudiante['jornada'] = jornada;
      estudiante['bloques'] = bloque_str;
    }
    
    infoPersona['jornada'] = jornada;
    infoPersona['bloques'] = bloque_str;

    for ( let i = 1; i <= max_apoderados; i++ ) {
      personas.push({...infoPersona, nombre_completo: `Apoderado ${i}`, tipo: 'apoderado'});
    }
    for ( let i = 1; i <= max_invitados; i++ ) {
      personas.push({...infoPersona, nombre_completo: `Invitado ${i}`, tipo: 'invitado'});
    }

    for ( const entrada of personas ) {
      const result_create = await fetch(`${baseUrl}/api/entrada/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify(entrada)
      });
      if (result_create.status != 200 ) {
        const errBody = await result_create.json().catch(() => ({ error: 'Error no especificado' }));
        console.log(`${tag} La entrada para ${entrada.nombre_completo} no se pudo crear. status: ${result_create.status} | error: ${errBody.error}`);
        continue;
      }
      if (entrada.tipo === 'estudiante') {
        lista_entradas.push(entrada.nombre_completo);
      }
    }
    return lista_entradas;
    // Pending
  } catch (error) {
    console.error(`${tag} Error al generar entrada para la familia del estudiante ${nombre_completo}:`, error);
  }
  return [];
}

router.post('/entradas/generar/familia', apiKeyAuth, async (req, res) => {
  const tag = '[POST /api/entradas/generar/familia]';
  try {
    const { id_organizacion, id_evento, imagen_ticket_path, nombre_completo, curso_bloques, save_file} = req.body;
    if (!id_organizacion || !id_evento || !nombre_completo) {
      return res.status(400).json({ error: 'Faltan parámetros: id_organizacion, id_evento y nombre_completo son requeridos' });
    }

    const nombres_estudiantes = await generarEntradaParaFamilia(id_organizacion, id_evento, imagen_ticket_path, nombre_completo, curso_bloques, save_file);
    
    console.log(`${tag} Entradas generadas para la familia del estudiante ${nombre_completo}: ${nombres_estudiantes.join(', ')}`);
    res.json({ status: 'ok', estudiantes: nombres_estudiantes });
  } catch (error) {
    console.error(`${tag} Error al generar entradas para la familia del estudiante ${req.body.nombre_completo}:`, error);
    res.status(500).json({ error: 'Error al generar entradas para la familia' });
  }
});





router.delete('/entradas', apiKeyAuth, async (req, res) => {
  // Drop ticketEventos collection
  try {
    const { id_evento } = req.query;
    const filter = id_evento ? { id_evento } : {};
    const drop_result = await db_support.TicketEventoDB.deleteMany(filter);
    // Modificar el numero total de entradas del evento id_evento
    const eventos = await db_support.EventDB.find({id_evento});
    for ( const evento of eventos )
    {
      evento.total_entradas = 0;
      const update_collection = await db_support.EventDB.findOneAndUpdate({id_evento: evento.id_evento}, { $set: evento })
    }
    res.status(200).json({
      message: 'collection TicketEventoDB deleted',
      deletedCount: drop_result.deletedCount
    });
  } catch (err) {
    console.error('[DELETE /api/entradas] Error al vaciar la colección:', err);
    res.status(500).json({error: 'drop collection failed'})

  }
});



router.post('/entradas/send_email', apiKeyAuth, async (req, res) => {
  const tag = '[POST /entradas/send_email]';
  const url_server = config_env.URL_SERVER || 'https://registro-patrona.onrender.com';
  try {
    const { email_destinatario, asuntoCorreo, mensajeCorreo, tickets, save_file, tipo_attachment = 'png'} = req.body;

    if (!email_destinatario || !asuntoCorreo || !mensajeCorreo || !tickets || !tickets.length) {
      console.log(`${tag} Argument missing: `, {email_destinatario, asuntoCorreo, mensajeCorreo});
      res.status(400).json({message: 'Argument missing', err: ''});
      return;
    }

    //seriales = []
    let attachments = null;

    if ( tipo_attachment === 'png') {
      attachments = await Promise.all(
        tickets.map(async (ticket_info) => {
          const eventInfo = await db_support.EventDB.findOne({id_evento: ticket_info.id_evento});
          const imagen_ticket_path = eventInfo ? eventInfo.imagen_ticket_path : '';
          //console.log(`${tag} imagen_ticket_path: `, imagen_ticket_path);
          //const {ticket_info} = entrada
          //console.log(`ticket_info: ${JSON.stringify(ticket_info)}`);
          const [buffer, qr_str] = await genEntradaCanvas({...ticket_info, imagen_ticket_path, url_server});
          const {nombre_completo, jornada, tipo, folio, id_evento, familia} = ticket_info;
          //seriales.push(folio)
          //const nombreArchivo = `${id_evento.replace(/ /g, "_")}_${jornada}_${String(folio).padStart(4, '0')}.png`;
          const tailoredName = tipo === 'estudiante' ? nombre_completo : `${familia.replace(/ /g, "_")}_${tipo}` ;
          const nombreArchivo = `${id_evento.replace(/ /g, "_")}_${String(folio).padStart(4, '0')}_${tailoredName}.png`;

          /*if (qr_str && buffer)
            console.log(`${tag} save_file: ${save_file}, qr_str: `, qr_str);
          if (save_file)
            await save_png(buffer, `f${folio.toString().padStart(4,'0')}_${familia.replace(' ', '_')}`);*/

          if (save_file) {
            //await save_png(buffer, `f${folio.toString().padStart(4,'0')}_${familia.replace(' ', '_')}`);
            await save_png(buffer, nombreArchivo);
            await append_qr_data(qr_str, 'qr_send_email_png.txt');
          }
          return {
            filename: nombreArchivo,
            content: buffer,
            contentType: 'image/png'
          };
        })
      );
    }
    if ( tipo_attachment === 'pdf' ) {
      let id_evento = null;
      let familia = null;
      // 1. Generar los Buffers PNG de cada entrada a partir de genEntradaCanvas
      const buffersPNG = await Promise.all(
        tickets.map(async (ticket_info) => {
          if (!id_evento) id_evento = ticket_info.id_evento;
          if (!familia) familia = ticket_info.id_evento;
          const eventInfo = await db_support.EventDB.findOne({id_evento: ticket_info.id_evento});
          const imagen_ticket_path = eventInfo ? eventInfo.imagen_ticket_path : '';
          const [resultadoCanvas, qr_str] = await genEntradaCanvas({...ticket_info, imagen_ticket_path, url_server});
          if ( save_file ) {
            await append_qr_data(qr_str, 'qr_send_email_pdf.txt');
          }
          // genEntradaCanvas retorna un arreglo [bufferPNG, qrData]
          return resultadoCanvas;
        })
      );

      // Filtrar buffers nulos si ocurrió algún error en la generación individual
      const buffersValidos = buffersPNG.filter(buf => buf !== null);

      if (buffersValidos.length === 0) {
        return { status: 'error', message: 'No se pudieron generar las entradas.' };
      }

      // 2. Generar el documento PDF compilado directamente en memoria (Buffer)
      const pdfBuffer = await generarPdfDesdeBuffers(buffersValidos);

      // 3. Formatear el adjunto según las especificaciones de nodemailer / send_email_from_cpa_account
      const nombreArchivo = `${id_evento.replace(/ /g, "_")}_${familia.replace(/ /g, "_")}.pdf`;
      attachments = [
        {
          filename: nombreArchivo,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ];
      if ( save_file ) {
        console.log(`${tag} pdf: ${nombreArchivo}`)
        await save_pdf(pdfBuffer, nombreArchivo);
      }
    }

    const email_body = {email_destinatario, asuntoCorreo, mensajeCorreo, attachments};
    const send_email_result = await send_email_from_cpa_account(email_body);

    if (send_email_result.status === 'ok') {
      res.status(200).json(send_email_result);
    } else {
      res.status(400).json(send_email_result);
    }

  } catch (err) {
    console.log(`${tag} Error: `, err);
    res.status(500).json({message: 'Unexpected error', err});
  }
});


router.post('')

module.exports = router;