// ./backend/api_entradas.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const { genEntradaCanvas, genQrEntradaCanvas, genQrData } = require('../src/generateTicket'); 
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');
//const { info } = require('console');
const { send_email_from_cpa_account } = require('../api-correo/send_fiesta_chilena_email.js');
const { generarPdfDesdeBuffers, save_pdf } = require('./pdf_helper.js');
const { BASEURL } = require('../backend/git_branch');


const SECRET_API_KEY = config_env.API_KEY;

// Mapeo auxiliar de jornadas
const JORNADA_MAP = { 'manana': 'Mañana', 'tarde': 'Tarde' };

// Normaliza un nombre para comparaciones tolerantes a espacios extra:
// recorta extremos y colapsa espacios internos duplicados. Evita que un
// nombre guardado como "reyes san martin agatha " (con espacio final) no
// haga match con "reyes san martin agatha" al activar entradas.
const normalizarNombre = (str) => (str || '').trim().replace(/\s+/g, ' ');

// Construye una regex para hacer match del campo 'familia' de forma tolerante a
// mayus/minus y a espacios extra. Necesario porque las entradas de una misma
// familia pueden haberse guardado con distinta capitalizacion del apellido
// (p.ej. "Ramirez silva" vs "ramirez silva"); un filtro exacto dejaria fuera
// parte de las entradas al leerlas por familia.
const rxFamilia = (familia) => {
  const escaped = normalizarNombre(familia)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/ /g, '\\s+');
  return new RegExp('^\\s*' + escaped + '\\s*$', 'i');
};

// Determina si la cuota CGPA (clave interna cuota_cpa) esta pagada para alguno
// de los estudiantes indicados. Cuando la cuota CGPA esta pagada, las
// invitaciones vienen incluidas, por lo que al activar en lote se consideran
// cubiertos todos los pases de invitado de la familia.
// Recibe una lista de nombres de estudiantes (tal como estan en pagosDB.id).
async function familiaTieneCuotaCpaPagada(nombresEstudiantes) {
  const tag = '[familiaTieneCuotaCpaPagada]';
  try {
    const nombres = (Array.isArray(nombresEstudiantes) ? nombresEstudiantes : [])
      .map(n => normalizarNombre(n))
      .filter(Boolean);
    if (!nombres.length) return false;

    // Match tolerante a mayusculas/espacios: se arma un regex exacto por nombre.
    const regexes = nombres.map(n => new RegExp('^' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'));
    const pagos = await db_support.pagosDB.find({ id: { $in: regexes } }).lean();
    const pagada = Array.isArray(pagos) && pagos.some(p => p.cuota_cpa === true || p.tipo === 'cuota_cpa');
    console.log(`${tag} estudiantes=${JSON.stringify(nombres)} cuota_cpa_pagada=${pagada}`);
    return pagada;
  } catch (err) {
    console.error(`${tag} Error:`, err);
    return false;
  }
}

const current_server = config_env.LOCAL_PORT === 5001 ? `http://localhost:${config_env.LOCAL_PORT}` : config_env.URL_SERVER || BASEURL;
console.log(`[api_entradas.js] current_server: ${current_server}, BASEURL: ${BASEURL}, config_env.URL_SERVER: ${config_env.URL_SERVER}, config_env.LOCAL_PORT: ${config_env.LOCAL_PORT}`);

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
  const url_server = config_env.URL_SERVER || BASEURL;
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
    const folio = ticket.folio || '';
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

// Enriquecer una lista de tickets con el nombre del validador.
// El ticket guarda 'validado_por' como email; aqui se resuelve a nombre y
// apellido consultando perfilesDB una sola vez por cada email distinto.
// Devuelve objetos planos (lean) con un campo extra 'validado_por_nombre'.
async function agregarNombreValidador(tickets) {
  const lista = (tickets || []).map(t => (typeof t.toObject === 'function' ? t.toObject() : t));

  // Recolectar emails distintos de validadores (ignorando vacios/'desconocido')
  const emails = [...new Set(
    lista
      .map(t => (t.validado_por || '').trim())
      .filter(e => e && e.toLowerCase() !== 'desconocido')
  )];

  if (emails.length === 0) {
    return lista.map(t => ({ ...t, validado_por_nombre: '' }));
  }

  // Mapear email -> nombre_completo desde perfilesDB. La comparacion se hace
  // case-insensitive porque el email guardado en el ticket (validado_por) puede
  // tener distinta capitalizacion que el registrado en el perfil.
  const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexEmails = emails.map(e => new RegExp('^' + escaparRegex(e.trim()) + '$', 'i'));
  const perfiles = await db_support.perfilesDB.find({ email: { $in: regexEmails } });
  const nombrePorEmail = {};
  for (const p of perfiles) {
    if (p.email) nombrePorEmail[p.email.toLowerCase().trim()] = p.nombre_completo || '';
  }

  return lista.map(t => {
    const emailVal = (t.validado_por || '').toLowerCase().trim();
    // Si no hay perfil, se usa el email como respaldo para no dejar vacio
    const nombre = nombrePorEmail[emailVal] || (emailVal && emailVal !== 'desconocido' ? t.validado_por : '');
    return { ...t, validado_por_nombre: nombre };
  });
}

// 2. GET: Buscar Entradas (Supervisor)
router.get('/entrada/buscar', apiKeyAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Ingrese al menos 2 caracteres para buscar' });
    }

    const normalizar = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const busqueda = normalizar(q.trim());
    // Se excluyen las entradas anuladas (borrado lógico): no deben aparecer en
    // los resultados de búsqueda.
    const todos = await db_support.TicketEventoDB.find({ estado: { $ne: 'anulada' } });

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

    const resultadosConNombre = await agregarNombreValidador(resultados);
    res.json(resultadosConNombre);
  } catch (error) {
    console.error('[/api/entrada/buscar] Error:', error);
    res.status(500).json({ error: 'Error al buscar entradas' });
  }
});

// 2b. GET: Listar todas las entradas (paginado)
router.get('/entrada/listar', apiKeyAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Se excluyen las entradas anuladas (borrado lógico) del listado y de los
    // conteos, para que no se muestren ni se cuenten como vigentes.
    const filtroVigentes = { estado: { $ne: 'anulada' } };
    const total = await db_support.TicketEventoDB.countDocuments(filtroVigentes);
    const validadas = await db_support.TicketEventoDB.countDocuments({ ...filtroVigentes, usado: true });
    const porValidar = total - validadas;
    const entradas = await db_support.TicketEventoDB.find(filtroVigentes)
      .sort({ folio: 1, familia: 1, nombre_completo: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const entradasConNombre = await agregarNombreValidador(entradas);

    res.json({ entradas: entradasConNombre, total, validadas, porValidar, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('[/api/entrada/listar] Error:', error);
    res.status(500).json({ error: 'Error al listar entradas' });
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
      const [ticketConNombre] = await agregarNombreValidador([ticket]);
      // Contar las entradas de tipo invitado de la misma familia/evento.
      // Se usa rxFamilia para tolerar diferencias de mayus/minus y espacios en
      // el campo 'familia' (mismo criterio que /entrada/familia).
      let cantidad_invitados = 0;
      try {
        const filtroInvitados = { familia: rxFamilia(ticket.familia), tipo: 'invitado' };
        if (ticket.id_organizacion) filtroInvitados.id_organizacion = ticket.id_organizacion;
        if (ticket.id_evento) filtroInvitados.id_evento = ticket.id_evento;
        cantidad_invitados = await db_support.TicketEventoDB.countDocuments(filtroInvitados);
      } catch (e) { /* si falla el conteo, se deja en 0 */ }
      return res.json({
        existe: true,
        usado: ticket.usado || false,
        fecha_uso: ticket.fecha_uso || null,
        validado_por: ticket.validado_por || null,
        validado_por_nombre: (ticketConNombre && ticketConNombre.validado_por_nombre) || '',
        familia: ticket.familia,
        cantidad_invitados,
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
      //const isUsado = ticket.usado || ticket.estado !== 'activo';
      const estadoMap = {
        'inactiva' : `<span class="badge badge-usado">⚪ ENTRADA INACTIVA</span>`,
        'activa' : `<span class="badge badge-valido">🟢 ENTRADA VÁLIDA</span>`,
        'usada' : `<span class="badge badge-valido">🔴 ENTRADA USADA</span>`,
        'anulada' : `<span class="badge badge-valido">🚫 ENTRADA ANULADA</span>`
      }
      const statusBadge = estadoMap[ticket.estado];

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
            .footer-link {
              text-align: center;
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px dashed #e0e0e0;
            }
            .footer-link a {
              color: #e53935;
              font-size: 0.85rem;
              font-weight: 600;
              text-decoration: none;
            }
            .footer-link a:hover {
              text-decoration: underline;
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

              <div class="footer-link">
                <a href="https://registro-patrona.onrender.com" target="_blank" rel="noopener noreferrer">Ir al Registro Patrona</a>
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
    const { folio, email } = req.body;
    if (!folio) return res.status(400).json({ error: 'Falta folio' });

    const ticket = await db_support.TicketEventoDB.findOne({ folio: parseInt(folio) });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado en el sistema' });
    }

    if (ticket.usado || ticket.estado !== 'activa' ) {
      return res.status(409).json({
        error: 'Este ticket ya fue utilizado',
        fecha_uso: ticket.fecha_uso,
        validado_por: ticket.validado_por
      });
    }

    const fechaUso = new Date();

    await db_support.TicketEventoDB.findOneAndUpdate(
      { folio: parseInt(folio) },
      { 
        $set: { 
          usado: true, 
          fecha_uso: fechaUso, 
          validado_por: email || 'desconocido',
          estado: 'usada'
        },
        $push: {
          historial: {
            accion: 'ingreso',
            descripcion: `ingreso validado por ${email}`
          }
        }
      }
    );

    console.log(`[/api/entrada/validar] Ticket ${folio} marcado como usado por ${email}`);

    // Marcar como usados el resto de tickets de la misma familia en este evento.
    // Al validar una entrada, toda la familia queda con sus entradas validadas.
    // Las entradas de cortesía quedan EXCLUIDAS de la validación familiar: son
    // individuales y no pertenecen a una familia real, por lo que validar una
    // cortesía no arrastra a otras entradas, ni la validación de una entrada
    // normal marca entradas de cortesía.
    let entradasFamilia = 0;
    // Folios afectados por esta validacion: siempre incluye el escaneado y, si
    // corresponde, los del resto de la familia. Permite al frontend actualizar
    // todas las filas involucradas sin recargar.
    let foliosValidados = [parseInt(folio)];
    if (ticket.familia && ticket.id_evento && ticket.tipo !== 'cortesia') {
      const filtroFamilia = {
        id_organizacion: ticket.id_organizacion,
        id_evento: ticket.id_evento,
        familia: ticket.familia,
        folio: { $ne: parseInt(folio) },
        tipo: { $ne: 'cortesia' },
        usado: { $ne: true },
        estado: 'activa'
      };

      // Capturar los folios que se van a validar antes de actualizarlos.
      const pendientes = await db_support.TicketEventoDB.find(filtroFamilia).select('folio').lean();
      const foliosFamilia = (pendientes || []).map(t => t.folio);

      const resultadoFamilia = await db_support.TicketEventoDB.updateMany(
        filtroFamilia,
        {
          $set: {
            usado: true,
            fecha_uso: fechaUso,
            validado_por: email || 'desconocido',
            estado: 'usada'
          },
          $push: {
            historial: {
              accion: 'ingreso',
              descripcion: `ingreso validado por ${email} (validación familiar desde folio ${folio})`
            }
          }
        }
      );
      entradasFamilia = resultadoFamilia.modifiedCount || 0;
      foliosValidados = foliosValidados.concat(foliosFamilia);
      if (entradasFamilia > 0) {
        console.log(`[/api/entrada/validar] ${entradasFamilia} entrada(s) adicional(es) de la familia "${ticket.familia}" marcadas como usadas`);
      }
    }

    // Resolver el nombre y apellido del validador para mostrarlo en el listado.
    // Busqueda case-insensitive: el email de la sesion puede venir con distinta
    // capitalizacion que el registrado en el perfil.
    let validado_por_nombre = '';
    try {
      if (email && email.toLowerCase().trim() !== 'desconocido') {
        const emailRegex = new RegExp('^' + email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
        const perfilValidador = await db_support.perfilesDB.findOne({ email: emailRegex });
        validado_por_nombre = (perfilValidador && perfilValidador.nombre_completo) ? perfilValidador.nombre_completo : email;
      }
    } catch (e) { /* si falla la consulta, se deja el nombre vacio */ }

    res.json({
      status: 'ok',
      mensaje: 'Ticket validado correctamente',
      familia: ticket.familia,
      validado_por: email || 'desconocido',
      validado_por_nombre,
      entradas_familia_validadas: entradasFamilia,
      folios_validados: foliosValidados
    });
  } catch (error) {
    console.error('[/api/entrada/validar] Error:', error);
    res.status(500).json({ error: 'Error al validar entrada' });
  }
});

// 4b. POST: Revertir validación (marcar como pendiente)
router.post('/entrada/revertir', apiKeyAuth, async (req, res) => {
  try {
    // El frontend puede enviar el usuario como 'revertido_por' o 'email'.
    const { folio } = req.body;
    const revertido_por = req.body.revertido_por || req.body.email || 'desconocido';
    if (!folio) return res.status(400).json({ error: 'Falta folio' });

    const ticket = await db_support.TicketEventoDB.findOne({ folio: parseInt(folio) });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado en el sistema' });
    }

    if (!ticket.usado || ticket.estado === 'activa') {
      return res.status(409).json({ error: 'Este ticket ya está pendiente' });
    }

    await db_support.TicketEventoDB.findOneAndUpdate(
      { folio: parseInt(folio) },
      { 
        $set: { 
          usado: false, 
          fecha_uso: null, 
          validado_por: null,
          estado: 'activa'
        },
        $push: {
          historial: {
            accion: 'reversion',
            descripcion: `revertido por ${revertido_por}`
          }
        }
      }
    );

    console.log(`[/api/entrada/revertir] Ticket ${folio} revertido a pendiente por ${revertido_por}`);

    // Revertir tambien el resto de tickets usados de la misma familia en este
    // evento (simetrico a la validacion familiar). Las entradas de cortesía
    // quedan EXCLUIDAS: son individuales y no pertenecen a una familia real.
    let entradasFamilia = 0;
    let foliosRevertidos = [parseInt(folio)];
    if (ticket.familia && ticket.id_evento && ticket.tipo !== 'cortesia') {
      const filtroFamilia = {
        id_organizacion: ticket.id_organizacion,
        id_evento: ticket.id_evento,
        familia: ticket.familia,
        folio: { $ne: parseInt(folio) },
        tipo: { $ne: 'cortesia' },
        usado: true,
        estado: 'usada'
      };

      const usados = await db_support.TicketEventoDB.find(filtroFamilia).select('folio').lean();
      const foliosFamilia = (usados || []).map(t => t.folio);

      const resultadoFamilia = await db_support.TicketEventoDB.updateMany(
        filtroFamilia,
        {
          $set: { usado: false, fecha_uso: null, validado_por: null, estado: 'activa' },
          $push: {
            historial: {
              accion: 'reversion',
              descripcion: `revertido por ${revertido_por} (reversión familiar desde folio ${folio})`
            }
          }
        }
      );
      entradasFamilia = resultadoFamilia.modifiedCount || 0;
      foliosRevertidos = foliosRevertidos.concat(foliosFamilia);
      if (entradasFamilia > 0) {
        console.log(`[/api/entrada/revertir] ${entradasFamilia} entrada(s) adicional(es) de la familia "${ticket.familia}" revertidas a pendiente`);
      }
    }

    res.json({
      status: 'ok',
      mensaje: 'Ticket revertido a pendiente',
      familia: ticket.familia,
      entradas_familia_revertidas: entradasFamilia,
      folios_revertidos: foliosRevertidos
    });
  } catch (error) {
    console.error('[/api/entrada/revertir] Error:', error);
    res.status(500).json({ error: 'Error al revertir entrada' });
  }
});


async function hasSupervisorAccessRights(user_email) {
  if (!user_email)
    return false;
  const perfil = await db_support.perfilesDB.findOne({email: user_email});
  if (!perfil) return false;
  return await db_support.hasSupervisorAccessRights(perfil.rol);
}

async function hasValidadorAccessRights(user_email) {
  const perfil = await db_support.perfilesDB.findOne({email: user_email});
  if (!perfil) return false;
  return await db_support.hasValidadorAccessRights(perfil.rol);
}


// Devolver el historial de la entrada
router.get('/entrada/historial', apiKeyAuth, async (req, res) => {
  const tag = 'GET /api/entrada/historial';
  try {
    // Obtener parametros de la consulta
    const { id_organizacion, id_evento, folio, user_email } = req.query;

    // Validar parametros
    if (!folio) return res.status(400).json({ error: 'Error de Consulta. Falta el parámetro folio' });

    if (!user_email) return res.status(400).json({ error: 'Error de Consulta. Falta el parámetro user_email' });

    const isValidador = await hasSupervisorAccessRights(user_email);

    if (!isValidador) return res.status(400).json({ error: 'Acceso denegado. Se requiere perfil de Validador o superior' });

    // Buscar ticket
    const ticket = await db_support.TicketEventoDB.findOne({id_organizacion, id_evento, folio})

    const { familia, historial, estado, usado } = ticket;

    return res.status(200).json({ id_organizacion, id_evento, familia, historial, estado, usado });

  } catch(error) {
    return res.status(500).json({error})
  }
});

  async function obtenerPagosEntradas(id_organizacion, id_evento, user_email) {
    let compromiso_maximo_alcanzado = false;
    let numero_entradas = 0;
    // ok indica si la consulta del estado de pago fue efectivamente exitosa.
    // Sirve para distinguir "no hay pases pagados" (ok=true, numero_entradas=0)
    // de "no se pudo consultar" (ok=false), y asi evitar que un fallo de red
    // transitorio provoque una sincronizacion incorrecta de las entradas.
    let ok = false;
    const tag = '[obtenerPagosEntradas]';
    //console.log(`${tag} Obteniendo pagos de entradas para user_email=${user_email}, id_organizacion=${id_organizacion}, id_evento=${id_evento}`);
    const url_server = current_server;
    const local_port = config_env.LOCAL_PORT;
    //console.log(`${tag} current_server:`, url_server, 'local_port:', local_port);
    try {
      
      //console.log(`${tag} Llamando a ${url_server}/api/evento/estado_de_pago`);
      const result = await fetch(`${url_server}/api/evento/estado_de_pago?id_organizacion=${encodeURIComponent(id_organizacion)}&id_evento=${encodeURIComponent(id_evento)}&user_email=${encodeURIComponent(user_email)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      //console.log(`${tag} Resultado de /api/evento/estado_de_pago: status=${result.status}`);
      if ( result.status === 200 ) {
        ok = true;
        const pago_entradas = await result.json();
        const tipo_pase = 'pases_invitados';
        if ( Object.hasOwn(pago_entradas, tipo_pase )) {
          for (const pago of pago_entradas[tipo_pase]) {
            if ( compromiso_maximo_alcanzado ) break;
            compromiso_maximo_alcanzado = pago.compromiso_maximo_alcanzado;
            numero_entradas += pago.cantidad;
          }
        }
      } else {
        //console.warn(`${tag} estado_de_pago respondio status ${result.status}; no se considera una consulta exitosa`);
      }
      //console.log(`${tag} Resultado /api/evento/estado_de_pago: ok=${ok}, compromiso_maximo_alcanzado=${compromiso_maximo_alcanzado}, numero_entradas=${numero_entradas}`);
    } catch (err) {
      // Fallo de red/timeout: ok permanece en false para que el llamador no
      // sincronice las entradas a la baja por un error transitorio.
      //console.log(`${tag} Error obteniendo pagos entradas:`, err);
    }
    return { ok, compromiso_maximo_alcanzado, numero_entradas };
  }

async function obtenerMaxInvitados(id_organizacion, id_evento, hijos) {
  const tag = '[obtenerMaxInvitados]';

  try {
    console.log(`${tag} Calculando máximo invitados...`);
    const url_server = current_server;
    const cursos = [];
    for (const hijo of hijos) {
      const curso = await db_support.nombreCursoMapDB.findOne({id: hijo});
      if (curso && curso.value)
        cursos.push(curso.value);
    }

    console.log(`${tag} id_organizacion=${id_organizacion}, id_evento=${id_evento}, hijos=${JSON.stringify(hijos)}, cursos=${JSON.stringify(cursos)}`); 

    const result = await fetch(`${url_server}/api/eventos/max_invitados?id_organizacion=${encodeURIComponent(id_organizacion)}&id_evento=${encodeURIComponent(id_evento)}&cursos=${encodeURIComponent(JSON.stringify(cursos))}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
    });
    if (!result.ok) throw new Error(`Error al obtener max_invitados: ${result.statusText}`);
    const data = await result.json();
    const max = data.max_invitados;
    //console.log("Maximo Invitados:", max);
    return max;
  } catch (error) {
    console.error('Error al calcular máximo invitados:', error);
  }
  return 0;
}

router.get('/entrada/consolidar', apiKeyAuth, async (req, res) => {
  const tag = '[GET /api/entrada/consolidar]';
  try {
    const { id_organizacion, id_evento, user_email = null} = req.query;
    const user_emails_list_str = req.query.user_emails_list || null;
    if (!id_organizacion || !id_evento) {
      return res.status(400).json({ por_consolidar: -1, error: 'Faltan parámetros requeridos: id_organizacion o id_evento' });
    }
    if (!user_email && !user_emails_list_str) {
      return res.status(400).json({ por_consolidar: -1, error: 'Faltan parámetros requeridos: user_email o user_emails_list' });
    }
    let user_emails_list = null;
    if (user_emails_list_str) {
      try {
        user_emails_list = JSON.parse(user_emails_list_str);
        if (!Array.isArray(user_emails_list)) {
          return res.status(400).json({ por_consolidar: -1, error: 'user_emails_list debe ser un array JSON' });
        }
      } catch (err) {
        return res.status(400).json({ por_consolidar: -1, error: 'user_emails_list no es un JSON válido' });
      }
    }
    //console.log(`${tag} id_organizacion=${id_organizacion}, id_evento=${id_evento}, user_email=${user_email}, user_emails_list=${JSON.stringify(user_emails_list)}`);
    let result = await consultarConsolidarEntradasInvitados(id_organizacion, id_evento, user_email, user_emails_list);
    //console.log(`${tag} Resultado de la consulta de consolidación: `, result);
    if (result) {
      res.status(200).json(result);
    } else {
      res.status(500).json({ por_consolidar: -1, error: 'Error durante la consolidación de entradas' });
    }
  } catch (error) {
    console.error(`${tag} Error:`, error);
    res.status(500).json({ por_consolidar: -1, error: 'Error consolidando entradas' });
  }
});


router.post('/entrada/consolidar', apiKeyAuth, async (req, res) => {
  const tag = '[POST /api/entrada/consolidar]';
  try {
    const { id_organizacion, id_evento, user_email } = req.body;
    let user_emails_list = req.body.user_emails_list || null;

    // Safely parse user_emails_list if it is provided as a string
    if (typeof user_emails_list === 'string') {
      try {
        user_emails_list = JSON.parse(user_emails_list);
      } catch (e) {
        // Fallback for comma-separated email strings
        user_emails_list = user_emails_list.split(',').map(e => e.trim()).filter(Boolean);
      }
    }
    if (!user_email && !user_emails_list) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos: user_email o user_emails_list' });
    }
    let result = {};
    if (user_email) {
      const num_entradas_consolidadas = await consolidarEntradasInvitados(id_organizacion, id_evento, user_email);
      result[user_email] = num_entradas_consolidadas;
    }
    if (user_emails_list)
      for (const email of user_emails_list) {
        result[email] = await consolidarEntradasInvitados(id_organizacion, id_evento, email);
      }
    res.status(200).json(result);
  } catch (error) {
    console.error(`${tag} Error:`, error);
    res.status(500).json({ error: 'Error consolidando entradas' });
  }
});

async function consultarConsolidarEntradasInvitadosByUser(id_organizacion, id_evento, user_email = null) {
  const tag = '[consultarConsolidarEntradasInvitadosByUser]';
  if (!user_email) {
    console.log(`${tag} user_email is required`);
    return { user_email: null, invitados: -1, por_consolidar: -1, message: null, error: 'user_email is required' };
  }
  try {
      //console.log(`${tag} Consultando si se deben consolidar entradas para user_email=${user_email}, id_organizacion=${id_organizacion}, id_evento=${id_evento}`);
      const { compromiso_maximo_alcanzado, numero_entradas } = await obtenerPagosEntradas(id_organizacion, id_evento, user_email);
      //console.log(`${tag} compromiso_maximo_alcanzado=${compromiso_maximo_alcanzado}, numero_entradas=${numero_entradas}`);

      const userInfo = await db_support.usersDB.findOne({email: user_email});
      if (!userInfo) {
        return { user_email, invitados: -1, por_consolidar: -1, message: 'Usuario no encontrado en la base de datos' };
      }
      const { hijos, padres, invitados } = userInfo;
      if ( !hijos || !hijos.length) {
        return { user_email, invitados: -1, por_consolidar: -1, message: 'No tiene hijos registrados' };
      }

      //const num_entradas_esperadas = 
      let tickets = null;
      let tickets_estudiantes = [];
      let tickets_apoderados = [];
      let tickets_invitados = [];

      let activaciones_pendientes = 0;
      
      const nombre_hijo = hijos[0].nombre;
      const hijoInfo = await db_support.hermanosMapDB.findOne({id: nombre_hijo});
      if (hijoInfo) {
        const id_familia = hijoInfo.nombre_familia;
        tickets = await db_support.TicketEventoDB.find({ id_organizacion, id_evento, familia: id_familia}).sort({ folio: 1 }).lean();
        tickets_estudiantes = tickets.filter(ticket => ticket.tipo === 'estudiante' && ticket.estado === 'activa');
        tickets_apoderados = tickets.filter(ticket => ticket.tipo === 'apoderado' && ticket.estado === 'activa');
        tickets_invitados = tickets.filter(ticket => ticket.tipo === 'invitado' && ticket.estado === 'activa');
        activaciones_pendientes = Math.max(0, hijos.length - tickets_estudiantes.length) + Math.max(0, padres.length - tickets_apoderados.length);
      }
      
      let num_invitados = 0
      if (compromiso_maximo_alcanzado) {
        //console.log(`${tag} compromiso_maximo_alcanzado is true, no se pueden agregar más entradas`);
        const nombre_hijos = hijos.map(hijo => hijo.nombre);
        num_invitados = await obtenerMaxInvitados(id_organizacion, id_evento, nombre_hijos);
      } else {
        num_invitados = numero_entradas;
      }
      if (num_invitados > 0 && invitados && invitados.length < num_invitados) {
        //console.log(`${tag} numero_invitados pagados=${numero_entradas}, invitados registrados.length=${invitados.length}`);
        activaciones_pendientes += Math.max(0, num_invitados - invitados.length);
        return { user_email, invitados: invitados.length, por_consolidar: num_invitados, activaciones_pendientes, message: 'Si se requieren cambios en las entradas' };
      }
      activaciones_pendientes += Math.max(0, invitados.length - tickets_invitados.length);
      return { user_email, invitados: invitados.length, por_consolidar: 0, activaciones_pendientes, message: 'No se requieren cambios en las entradas' };

  } catch (error) {
    console.error(`${tag} Error:`, error);
    return { user_email, invitados: -1, por_consolidar: -1, activaciones_pendientes: -1, message: null, error: 'Error consultando consolidación de entradas' };
  }
}

async function consultarConsolidarEntradasInvitadosByBundle(id_organizacion, id_evento, user_emails_list = null) {
  const tag = '[consultarConsolidarEntradasInvitadosByBundle]';
  const respuesta = []
  let current_email = null;
  try {
    if (!user_emails_list) {
      console.log(`${tag} user_emails_list is required`);
      return [{ user_email: null, invitados: -1, por_consolidar: -1, message: null, error: 'user_emails_list is required' }];
    }

    let total_por_consolidar = 0;

    for (const email of user_emails_list) {
      current_email = email;
      //console.log(`${tag} Processing email: ${email}`);
      const result = await consultarConsolidarEntradasInvitadosByUser(id_organizacion, id_evento, email);
      if (result) {
        //console.log(`${tag} email ${email} has result`);
        if (result.por_consolidar > 0) {
          total_por_consolidar += result.por_consolidar;
        }
        respuesta.push(result);
      } else {
        console.log(`${tag} No result for email ${email}`);
      }
    }
    return respuesta;
  } catch (error) {
    console.error(`${tag} Error:`, error);
    respuesta.push({ user_email: current_email, invitados: -1, por_consolidar: -1, activaciones_pendientes: -1, message: null, error: 'Error consultando consolidación de entradas por bundle' });
    return respuesta;
  }
  return respuesta;
}

async function consultarConsolidarEntradasInvitados(id_organizacion, id_evento, user_email = null, user_emails_list = null) {
  const tag = '[consultarConsolidarEntradasInvitados]';
  let result = null;
  //console.log(`${tag} id_organizacion=${id_organizacion}, id_evento=${id_evento}, user_email=${user_email}, user_emails_list=${JSON.stringify(user_emails_list)}`);
  try {
    if (!user_email && !user_emails_list) {
      console.log(`${tag} user_email or user_emails_list is required`);
      return { user_email: null, invitados: -1, por_consolidar: -1, activaciones_pendientes: -1, message: null, error: 'user_email or user_emails_list is required' };
    }

    if (user_email) {
      result = await consultarConsolidarEntradasInvitadosByUser(id_organizacion, id_evento, user_email);
    } else if (user_emails_list) {
      result = await consultarConsolidarEntradasInvitadosByBundle(id_organizacion, id_evento, user_emails_list);
    }
  } catch (error) {
    console.error(`${tag} Error:`, error);
    return { user_email: null, invitados: -1, por_consolidar: -1, activaciones_pendientes: -1, message: null, error: 'Error consultando consolidación de entradas' };
  }
  //console.log(`${tag} Resultado final de la consulta de consolidación: `, result);
  return result;
}

async function consolidarEntradasInvitados(id_organizacion, id_evento, user_email) {
  const tag = '[consolidarEntradasInvitados]';
  try {
    if (!user_email) {
      console.log(`${tag} user_email is required`);
      return { user_email: null, por_consolidar: -1, message: null, error: 'user_email is required' };
    }

    //console.log(`${tag} Consolidando entradas para user_email=${user_email}, id_organizacion=${id_organizacion}, id_evento=${id_evento}`);
    const { ok, compromiso_maximo_alcanzado, numero_entradas } = await obtenerPagosEntradas(id_organizacion, id_evento, user_email);
    //console.log(`${tag} ok=${ok}, compromiso_maximo_alcanzado=${compromiso_maximo_alcanzado}, numero_entradas=${numero_entradas}`);

    // Si la consulta del estado de pago no fue exitosa (fallo de red/timeout o
    // status != 200), NO consolidamos: preferimos no tocar el array de invitados
    // antes que sincronizarlo con un numero_entradas=0 erroneo por un fallo
    // transitorio. Se reintentara en la proxima carga de "Mis Datos".
    if (!ok) {
      console.warn(`${tag} No se pudo obtener el estado de pago (ok=false); se omite la consolidacion para no desincronizar invitados`);
      return -1;
    }

    const userInfo = await db_support.usersDB.findOne({email: user_email});
    if (!userInfo) {
      return -1;
    }
    const { hijos, padres, invitados } = userInfo;
    if ( !hijos || !hijos.length) {
      return -1;
    }

    let num_invitados = 0
    if (compromiso_maximo_alcanzado) {
      console.log(`${tag} compromiso_maximo_alcanzado is true, no se pueden agregar más entradas`);
      const nombre_hijos = hijos.map(hijo => hijo.nombre);
      num_invitados = await obtenerMaxInvitados(id_organizacion, id_evento, nombre_hijos);
    } else {
      num_invitados = numero_entradas;
    }
    if (num_invitados > 0 && invitados && invitados.length < num_invitados) {
      console.log(`${tag} numero_entradas=${numero_entradas}, invitados.length=${invitados.length}`);
      // Actualizar la cantidad de invitados en la base de datos
      await db_support.usersDB.updateOne(
        { email: user_email },
        { $set: { 'invitados': Array(num_invitados).fill({}) } }
      );
      return num_invitados;
    }
    return 0;
  } catch (error) {
    console.error(`${tag} Error:`, error);
    return -1;
  }
}


async function activarEntradasByUserEmail(id_organizacion, id_evento, user_email) {
  const tag = `[activarEntradasByUserEmail]`;
  // Implementar la lógica de activación de entradas para el user_email
      // Activacion en lote de la familia del user_email indicado. Aplica tanto
      // al propio usuario (user_email === sessionEmail) como a un
      // supervisor/admin que emula el acceso (admin_view=1) sobre ese usuario.
  const userInfo = await db_support.usersDB.findOne({email: user_email});
  if (!userInfo) {
    return res.status(404).json({ error: 'usuario no encontrado' });
  }
  const { hijos, padres, invitados } = userInfo;
  if ( !hijos || !hijos.length) {
    return res.status(404).json({ error: 'usuario no tiene hijos enrolados' });
  }

  //console.log(`${tag} userInfo: `, userInfo);
  //console.log(`${tag} `, { hijos, padres, invitados });
  const nombres_hijos = hijos.flatMap(hijo => normalizarNombre(hijo.nombre));
  //console.log(`${tag} nombres_hijos: `, nombres_hijos);

  // Obteniendo la informacion de los hermanos
  const hermanosInfo = await db_support.hermanosMapDB.findOne({id: hijos[0].nombre});
  if ( !hermanosInfo || !hermanosInfo.nombre_familia) return res.status(404).json({ error: 'no se encuentra familia' });

  const familia = hermanosInfo.nombre_familia;

  // Searching for the tickets for the family
  const ticketsFamilia = await db_support.TicketEventoDB.find({id_organizacion, id_evento, familia});

  const tickets_estudiantes = ticketsFamilia.filter( ticket => ticket.tipo === 'estudiante' && nombres_hijos.includes(normalizarNombre(ticket.nombre_completo)));
  const tickets_apoderados = ticketsFamilia.filter( ticket => ticket.tipo === 'apoderado');
  const tickets_invitados = ticketsFamilia.filter( ticket => ticket.tipo === 'invitado');

  const folios_to_update_estudiantes = tickets_estudiantes.filter(t => t.estado === 'inactiva')
                                        .map(t => t.folio);
  const folios_to_update_apoderados = tickets_apoderados.filter(t => t.estado === 'inactiva')
                                        .map(t => t.folio);
  const folios_to_update_invitados = tickets_invitados.filter(t => t.estado === 'inactiva')
                                        .map(t => t.folio);

  console.log(`${tag} `, {folios_to_update_estudiantes, folios_to_update_apoderados, folios_to_update_invitados});

  // Si la cuota CGPA (cuota_cpa) esta pagada, las invitaciones vienen
  // incluidas: se consideran cubiertos todos los pases de invitado de la
  // familia, sin limitar por la cantidad de invitados registrados en el
  // perfil del usuario.
  const cpaPagada = await familiaTieneCuotaCpaPagada(nombres_hijos);

  const cantidad_to_update_apoderados = Math.max(0, padres.length - (tickets_apoderados.length - folios_to_update_apoderados.length));
  const cantidad_to_update_invitados = cpaPagada
    ? folios_to_update_invitados.length
    : Math.max(0, invitados.length - (tickets_invitados.length - folios_to_update_invitados.length));

  console.log(`${tag} `, {padres:padres.length, invitados:invitados.length, cpaPagada});
  console.log(`${tag} `, {tickets_apoderados:tickets_apoderados.length, tickets_invitados:tickets_invitados.length});
  console.log(`${tag} `, {folios_to_update_apoderados:folios_to_update_apoderados.length, folios_to_update_invitados:folios_to_update_invitados.length});
  console.log(`${tag} `, {cantidad_to_update_apoderados, cantidad_to_update_invitados});

  const foliosToUpdate = [
    ...folios_to_update_estudiantes,
    ...folios_to_update_apoderados.slice(0, cantidad_to_update_apoderados),
    ...folios_to_update_invitados.slice(0, cantidad_to_update_invitados)
  ];
  console.log(`${tag} foliosToUpdate: `, foliosToUpdate);

  if (foliosToUpdate.length === 0) {
    const exit_message = { status: 'ok', mensaje: 'No hay entrdas que requieran activaciom', activadas: 0 }
    console.log(`${tag} `, exit_message);
    return exit_message;
  }

  // Actualización masiva (Bulk) para garantizar rendimiento
  const updateResult = await db_support.TicketEventoDB.updateMany(
    { folio: { $in: foliosToUpdate } },
    { 
      $set: { 
        usado: false, 
        fecha_uso: null, 
        validado_por: null,
        estado: 'activa'
      },
      $push: {
        historial: {
          accion: 'activacion',
          descripcion: `activado en lote por ${user_email}`
        }
      }
    }
  );

  console.log(`${tag} Entradas de la familia ${familia} activadas correctamente. Total activadas: ${updateResult.modifiedCount}`);
  return { status: 'ok', mensaje: 'Entradas activadas correctamente', activadas: updateResult.modifiedCount };
}

router.post('/entrada/masivo/activar', apiKeyAuth, async (req, res) => {
  const tag = '[POST /api/entrada/masivo/activar]'
  //console.log(`${tag} Starting ...`);
  try {
    const { id_organizacion, id_evento } = req.body;
    //console.log(`${tag} Continue ...`, {id_organizacion, id_evento, folio, user_email});
    let user_emails_list = req.body.user_emails_list || null;

    if (!id_organizacion) return res.status(400).json({ error: 'Falta id_organizacion' });
    if (!id_evento) return res.status(400).json({ error: 'Falta id_evento' });
    if (!user_emails_list) return res.status(400).json({ error: 'Falta user_emails_list' });
  

    // Safely parse user_emails_list if it is provided as a string
    if (typeof user_emails_list === 'string') {
      try {
        user_emails_list = JSON.parse(user_emails_list);
      } catch (e) {
        // Fallback for comma-separated email strings
        user_emails_list = user_emails_list.split(',').map(e => e.trim()).filter(Boolean);
      }
    }

    for (const user_email of user_emails_list) {
      // Aquí puedes llamar a la función de activación para cada user_email
      // Por ejemplo:
      // await activarEntrada(id_organizacion, id_evento, user_email);
      await activarEntradasByUserEmail(id_organizacion, id_evento, user_email);
    }

  } catch (error) {
    console.error(`${tag} Error:`, error);
    return res.status(500).json({ error: 'Error inesperado' });
  }
  return res.status(200).json({ message: 'Validación exitosa' });
});

// Activar entradas:
// Se activan las entradas de la familia del user_email
// Se activan solo aquellas que estan 'desativadas'. 
// Si estan en otro estado, no se hace nada con la entrada
// Busca las entradas por familia, y de acuerdo a la cantidad enrolada
// y se activan solo esas. 
// Podrian quedar entradas familiares sin activar, 
// por ejemplo, si es solo una mama y un soo invitado, se activa solo eso.
// Si, desde Mis Datos, se eliminan entradas, y se vuelven a activar, 
// se debe usar este mismo endpoint
//
// Parametro de entrada: 
//  - id_organizacion,
//  - id_evento,
//  - user_email,
//  - folio (opcional)
//
router.post('/entrada/activar', apiKeyAuth, async (req, res) => {
  const tag = '[POST /api/entrada/activar]'
  //console.log(`${tag} Starting ...`);
  try {
    const { id_organizacion, id_evento, folio, familia, user_email, admin_view } = req.body;
    //console.log(`${tag} Continue ...`, {id_organizacion, id_evento, folio, user_email});

    if (!id_organizacion) return res.status(400).json({ error: 'Falta id_organizacion' });
    if (!id_evento) return res.status(400).json({ error: 'Falta id_evento' });
    if (!user_email) return res.status(400).json({ error: 'Falta user_email' });
    const sessionEmail = req.user?.emails?.[0]?.value 
      || req.user?.email 
      || req.session?.user?.email 
      || 'unknown';

    // para efectos de debugging
    console.log(`${tag} session comparison ${JSON.stringify({user_email, sessionEmail})}`);

    const esSupervisor = await hasSupervisorAccessRights(user_email);
    console.log(`${tag} user ${user_email} es Supervisor: ${esSupervisor}`);

    // Modo admin (Ver Acceso con admin_view=1): la autorizacion se basa en la
    // sesion del administrador (sessionEmail), no en el user_email del apoderado.
    // Permite que un supervisor/admin active entradas de cualquier familia.
    const adminViewFlag = admin_view === true || admin_view === 'true' || admin_view === 1 || admin_view === '1';
    const sesionEsSupervisor = await hasSupervisorAccessRights(sessionEmail);
    const adminSesionSupervisor = adminViewFlag && sesionEsSupervisor;
    console.log(`${tag} admin_view check ${JSON.stringify({ admin_view, adminViewFlag, sessionEmail, sesionEsSupervisor, adminSesionSupervisor })}`);
    if (adminSesionSupervisor) {
      console.log(`${tag} activacion en modo admin_view por sesion ${sessionEmail} sobre user ${user_email}`);
    }

    if ( user_email !== sessionEmail && !esSupervisor && !adminSesionSupervisor && !adminViewFlag) {
      const err_msg = `unexpected email: ${JSON.stringify({user_email, sessionEmail, esSupervisor})}`;
      console.log(`${tag} ${err_msg} `);
      res.status(400).json({ error: err_msg });
      return;
    }

    if (user_email) {
      await consolidarEntradasInvitados(id_organizacion, id_evento, user_email);
    }

    if (folio && (esSupervisor || adminSesionSupervisor)) {
      const ticket = await db_support.TicketEventoDB.findOne({ folio: parseInt(folio) });

      // El ticket debe existir.
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket no encontrado en el sistema' });
      }

      // Solo se pueden activar entradas que estan inactivas. Si ya esta activa
      // no hay nada que hacer; si fue usada/anulada no debe reactivarse aqui.
      if (ticket.estado !== 'inactiva') {
        const err_msg = `El ticket ${folio} no está inactivo (estado actual: ${ticket.estado}); no se puede activar.`;
        console.log(`${tag} Error: ${err_msg}`);
        return res.status(409).json({ error: err_msg });
      }

      const result = await db_support.TicketEventoDB.findOneAndUpdate(
        { folio: parseInt(folio), estado: 'inactiva' },
        { 
          $set: { 
            usado: false, 
            fecha_uso: null, 
            validado_por: null,
            estado: 'activa'
          },
          $push: {
            historial: {
              accion: 'activacion',
              descripcion: `activado por ${user_email}`
            }
          }
        }
      );
      if (result) {
        return res.status(200).json({status: 'updated'});
      }
    } else if (user_email === sessionEmail || adminSesionSupervisor || (adminViewFlag || user_email)) {
      // Activacion en lote de la familia del user_email indicado. Aplica tanto
      // al propio usuario (user_email === sessionEmail) como a un
      // supervisor/admin que emula el acceso (admin_view=1) sobre ese usuario.
      const userInfo = await db_support.usersDB.findOne({email: user_email});
      if (!userInfo) {
        return res.status(404).json({ error: 'usuario no encontrado' });
      }
      const { hijos, padres, invitados } = userInfo;
      if ( !hijos || !hijos.length) {
        return res.status(404).json({ error: 'usuario no tiene hijos enrolados' });
      }

      //console.log(`${tag} userInfo: `, userInfo);
      //console.log(`${tag} `, { hijos, padres, invitados });
      const nombres_hijos = hijos.flatMap(hijo => normalizarNombre(hijo.nombre));
      //console.log(`${tag} nombres_hijos: `, nombres_hijos);

      // Obteniendo la informacion de los hermanos
      const hermanosInfo = await db_support.hermanosMapDB.findOne({id: hijos[0].nombre});
      if ( !hermanosInfo || !hermanosInfo.nombre_familia) return res.status(404).json({ error: 'no se encuentra familia' });

      const familia = hermanosInfo.nombre_familia;

      // Searching for the tickets for the family
      const ticketsFamilia = await db_support.TicketEventoDB.find({id_organizacion, id_evento, familia});

      const tickets_estudiantes = ticketsFamilia.filter( ticket => ticket.tipo === 'estudiante' && nombres_hijos.includes(normalizarNombre(ticket.nombre_completo)));
      const tickets_apoderados = ticketsFamilia.filter( ticket => ticket.tipo === 'apoderado');
      const tickets_invitados = ticketsFamilia.filter( ticket => ticket.tipo === 'invitado');

      const folios_to_update_estudiantes = tickets_estudiantes.filter(t => t.estado === 'inactiva')
                                            .map(t => t.folio);
      const folios_to_update_apoderados = tickets_apoderados.filter(t => t.estado === 'inactiva')
                                            .map(t => t.folio);
      const folios_to_update_invitados = tickets_invitados.filter(t => t.estado === 'inactiva')
                                            .map(t => t.folio);

      console.log(`${tag} `, {folios_to_update_estudiantes, folios_to_update_apoderados, folios_to_update_invitados});

      // Si la cuota CGPA (cuota_cpa) esta pagada, las invitaciones vienen
      // incluidas: se consideran cubiertos todos los pases de invitado de la
      // familia, sin limitar por la cantidad de invitados registrados en el
      // perfil del usuario.
      const cpaPagada = await familiaTieneCuotaCpaPagada(nombres_hijos);

      const cantidad_to_update_apoderados = Math.max(0, padres.length - (tickets_apoderados.length - folios_to_update_apoderados.length));
      const cantidad_to_update_invitados = cpaPagada
        ? folios_to_update_invitados.length
        : Math.max(0, invitados.length - (tickets_invitados.length - folios_to_update_invitados.length));

      console.log(`${tag} `, {padres:padres.length, invitados:invitados.length, cpaPagada});
      console.log(`${tag} `, {tickets_apoderados:tickets_apoderados.length, tickets_invitados:tickets_invitados.length});
      console.log(`${tag} `, {folios_to_update_apoderados:folios_to_update_apoderados.length, folios_to_update_invitados:folios_to_update_invitados.length});
      console.log(`${tag} `, {cantidad_to_update_apoderados, cantidad_to_update_invitados});

      const foliosToUpdate = [
        ...folios_to_update_estudiantes,
        ...folios_to_update_apoderados.slice(0, cantidad_to_update_apoderados),
        ...folios_to_update_invitados.slice(0, cantidad_to_update_invitados)
      ];
      console.log(`${tag} foliosToUpdate: `, foliosToUpdate);

      if (foliosToUpdate.length === 0) {
        return res.status(200).json({ status: 'ok', mensaje: 'No hay entrdas que requieran activaciom', activadas: 0 });
      }

      // Actualización masiva (Bulk) para garantizar rendimiento
      const updateResult = await db_support.TicketEventoDB.updateMany(
        { folio: { $in: foliosToUpdate } },
        { 
          $set: { 
            usado: false, 
            fecha_uso: null, 
            validado_por: null,
            estado: 'activa'
          },
          $push: {
            historial: {
              accion: 'activacion',
              descripcion: `activado en lote por ${user_email}`
            }
          }
        }
      );

      console.log(`${tag} Entradas de la familia ${familia} activadas correctamente. Total activadas: ${updateResult.modifiedCount}`);

      return res.status(200).json({ 
        status: 'ok', 
        mensaje: `Entradas de la familia ${familia} activadas correctamente`, 
        activadas: updateResult.modifiedCount 
      });
    } else if (familia) {
      // Obtener informacion Familia
      const familiaInfo = await db_support.hermanosMapDB.findOne({nombre_familia: familia});
      if (!familiaInfo) 
        return res.status(404).json({ error: `Informacion de familia ${familia} no fue encontrada` });

      // Obtener emails apoderados
      const emails_apoderados = familiaInfo.apoderado_email;
      if (!emails_apoderados) return res.status(404).json({ error: `Informacion de apoderados de la familia ${familia} no fue encontrada` });

      // Buscar usuarios 
      const lista_users = await db_support.usersDB.find({email:{$in:emails_apoderados}});
      if (!lista_users || !lista_users.length) return res.status(404).json({ error: `Apoderados de la familia ${familia} no se han registrado` });
      
      // Listar correos que son representantes de la familia
      const lista_emails = lista_users.flatMap(user => 
        (user.padres || [])
          .filter(padre => padre.es_usuario_cuenta === true)
          .map(padre => padre.correo)
      );
      if (!lista_emails || !lista_emails.length) return res.status(404).json({ error: `No se encontraron los correos de los Apoderados de la familia ${familia}` });

      if (lista_emails.length > 1) return res.status(404).json({ error: `Existe mas de un representante por familia ${familia}: ${JSON.stringify(lista_emails)}` });

      // Obtener el user representante de la familia
      const userInfo = lista_users.filter( u => u.email === lista_emails[0])[0];

      const { hijos, padres, invitados } = userInfo;
      if ( !hijos || !hijos.length) {
        return res.status(404).json({ error: 'usuario no tiene hijos enrolados' });
      }

      //console.log(`${tag} userInfo: `, userInfo);
      //console.log(`${tag} `, { hijos, padres, invitados });
      const nombres_hijos = hijos.flatMap(hijo => normalizarNombre(hijo.nombre));
      //console.log(`${tag} nombres_hijos: `, nombres_hijos);

      // Obteniendo la informacion de los hermanos
      const hermanosInfo = await db_support.hermanosMapDB.findOne({id: hijos[0].nombre});
      if ( !hermanosInfo || !hermanosInfo.nombre_familia) return res.status(404).json({ error: 'no se encuentra familia' });

      if (familia !== hermanosInfo.nombre_familia) return res.status(404).json({ error: `Error al procesar familia ${familia}. Esta haciendo match con familia ${hermanosInfo.nombre_familia}` });

      // Searching for the tickets for the family
      const ticketsFamilia = await db_support.TicketEventoDB.find({id_organizacion, id_evento, familia});

      const tickets_estudiantes = ticketsFamilia.filter( ticket => ticket.tipo === 'estudiante' && nombres_hijos.includes(normalizarNombre(ticket.nombre_completo)));
      const tickets_apoderados = ticketsFamilia.filter( ticket => ticket.tipo === 'apoderado');
      const tickets_invitados = ticketsFamilia.filter( ticket => ticket.tipo === 'invitado');

      const folios_to_update_estudiantes = tickets_estudiantes.filter(t => t.estado === 'inactiva')
                                            .map(t => t.folio);
      const folios_to_update_apoderados = tickets_apoderados.filter(t => t.estado === 'inactiva')
                                            .map(t => t.folio);
      const folios_to_update_invitados = tickets_invitados.filter(t => t.estado === 'inactiva')
                                            .map(t => t.folio);

      console.log(`${tag} `, {folios_to_update_estudiantes, folios_to_update_apoderados, folios_to_update_invitados});

      // Si la cuota CGPA (cuota_cpa) esta pagada, las invitaciones vienen
      // incluidas: se activan todos los pases de invitado de la familia.
      const cpaPagada = await familiaTieneCuotaCpaPagada(nombres_hijos);

      const cantidad_to_update_apoderados = Math.max(0, padres.length - (tickets_apoderados.length - folios_to_update_apoderados.length));
      const cantidad_to_update_invitados = cpaPagada
        ? folios_to_update_invitados.length
        : Math.max(0, invitados.length - (tickets_invitados.length - folios_to_update_invitados.length));

      console.log(`${tag} `, {padres:padres.length, invitados:invitados.length, cpaPagada});
      console.log(`${tag} `, {tickets_apoderados:tickets_apoderados.length, tickets_invitados:tickets_invitados.length});
      console.log(`${tag} `, {folios_to_update_apoderados:folios_to_update_apoderados.length, folios_to_update_invitados:folios_to_update_invitados.length});
      console.log(`${tag} `, {cantidad_to_update_apoderados, cantidad_to_update_invitados});

      const foliosToUpdate = [
        ...folios_to_update_estudiantes,
        ...folios_to_update_apoderados.slice(0, cantidad_to_update_apoderados),
        ...folios_to_update_invitados.slice(0, cantidad_to_update_invitados)
      ];
      console.log(`${tag} foliosToUpdate: `, foliosToUpdate);

      if (foliosToUpdate.length === 0) {
        return res.status(200).json({ status: 'ok', mensaje: 'No hay entrdas que requieran activaciom', activadas: 0 });
      }

      // Actualización masiva (Bulk) para garantizar rendimiento
      const updateResult = await db_support.TicketEventoDB.updateMany(
        { folio: { $in: foliosToUpdate } },
        { 
          $set: { 
            usado: false, 
            fecha_uso: null, 
            validado_por: null,
            estado: 'activa'
          },
          $push: {
            historial: {
              accion: 'activacion',
              descripcion: `activado en lote por ${user_email}`
            }
          }
        }
      );

      return res.status(200).json({ 
        status: 'ok', 
        mensaje: `Entradas de la familia ${familia} activadas correctamente`, 
        activadas: updateResult.modifiedCount 
      });

    } else {
      return res.status(400).json({error: 'parameters insuficient for validate tickets'});
    }
  } catch (error) {
    console.error('[/api/entrada/activar] Error:', error);
    res.status(500).json({ error: `${tag} Unexpected Error` });
  }
});


router.post('/entrada/desactivar', apiKeyAuth, async (req, res) => {
  const tag = '[POST /api/entrada/desactivar]'
  //console.log(`${tag} Starting ...`);
  const mapaAccion = {
    'inactiva': 'desactivacion',
    'activa': 'activacion',
    'usada': 'uso',
    'anulada': 'anulacion'
  };
  
  try {
    const { id_organizacion, id_evento, folio, familia, user_email, estado = 'inactiva' } = req.body;
    //console.log(`${tag} Continue ...`, {id_organizacion, id_evento, folio, user_email});

    if (!id_organizacion) return res.status(400).json({ error: 'Falta id_organizacion' });
    if (!id_evento) return res.status(400).json({ error: 'Falta id_evento' });
    if (!user_email) return res.status(400).json({ error: 'Falta user_email' });
    const sessionEmail = req.user?.emails?.[0]?.value 
      || req.user?.email 
      || req.session?.user?.email 
      || 'unknown';

    // para efectos de debugging
    //console.log(`${tag} session comparison ${JSON.stringify({user_email, sessionEmail})}`);

    const esSupervisor = await hasSupervisorAccessRights(user_email);

    if ( user_email !== sessionEmail && !esSupervisor ) {
      console.log(`${tag} ${user_email} es supervisor? : `, esSupervisor);
      const err_msg = `unexpected email: ${JSON.stringify({user_email, sessionEmail})}`;
      console.log(`${tag} ${err_msg} `);
      res.status(400).json({ error: err_msg });
      return;
    }

    if (folio) {
      // Si user_email no es administrador, entonces Verificar si folio es entrada de la familia de user_email
      const ticket = await db_support.TicketEventoDB.findOne({ id_organizacion, id_evento, folio: parseInt(folio) });

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket no encontrado en el sistema' });
      }

      if (ticket.estado === estado ) {
        const err_msg = `ticket ${folio} ya esta ${estado}`;
        console.log(`${tag} Error: ${err_msg}`);
        return res.status(404).json({ error: err_msg });
      }

      /*if (!ticket.usado) {
        return res.status(409).json({ error: 'Este ticket ya está pendiente' });
      }*/
      if (ticket.estado !== 'activa' && !esSupervisor) {
        const err_msg = `ticket ${folio} no está activo y el usuario no tiene privilegios para desactivarlo`;
        console.log(`${tag} Error: ${err_msg}`);
        return res.status(403).json({ error: err_msg });
      }

      const result = await db_support.TicketEventoDB.findOneAndUpdate(
        { id_organizacion, id_evento, folio: parseInt(folio), estado: { $ne: estado } },
        { 
          $set: { 
            usado: false, 
            fecha_uso: null, 
            validado_por: null,
            estado: estado
          },
          $push: {
            historial: {
              accion: `${mapaAccion[estado] || 'accion desconocida'}`,
              descripcion: `${estado} por ${user_email}`
            }
          }
        }
      );
      if (result) {
        return res.status(200).json({status: 'updated'});
      }
    } else {
      /*const userInfo = await db_support.usersDB.findOne({email: user_email});
      if (!userInfo) {
        return res.status(404).json({ error: 'usuario no encontrado' });
      }
      const { hijos, padres, invitados } = userInfo;
      if ( !hijos || !hijos.length) {
        return res.status(404).json({ error: 'usuario no tiene hijos enrolados' });
      }

      //console.log(`${tag} userInfo: `, userInfo);
      //console.log(`${tag} `, { hijos, padres, invitados });
      const nombres_hijos = hijos.flatMap(hijo => normalizarNombre(hijo.nombre));
      //console.log(`${tag} nombres_hijos: `, nombres_hijos);

      // Obteniendo la informacion de los hermanos
      const hermanosInfo = await db_support.hermanosMapDB.findOne({id: hijos[0].nombre});
      if ( !hermanosInfo || !hermanosInfo.nombre_familia) return res.status(404).json({ error: 'no se encuentra familia' });

      const familia = hermanosInfo.nombre_familia;*/

      // Searching for the tickets for the family
      const ticketsFamilia = await db_support.TicketEventoDB.find({id_organizacion, id_evento, familia});

      const tickets_estudiantes = ticketsFamilia.filter( ticket => ticket.tipo === 'estudiante');
      const tickets_apoderados = ticketsFamilia.filter( ticket => ticket.tipo === 'apoderado');
      const tickets_invitados = ticketsFamilia.filter( ticket => ticket.tipo === 'invitado');

      const tickets_desactivacion = [
        ...tickets_estudiantes,
        ...tickets_apoderados,
        ...tickets_invitados
      ];
      //console.log(`${tag} tickets_desactivacion: `, tickets_desactivacion);

      if (!tickets_desactivacion.length) return res.status(200).json({ error: 'no hay tickets para activar' });

      // Extraer folios que estén desactivados/inactivos
      const foliosToUpdate = tickets_desactivacion
        .filter(t => t.estado !== estado)
        .map(t => t.folio);

      if (foliosToUpdate.length === 0) {
        return res.status(200).json({ status: 'ok', mensaje: `Todas las entradas correspondientes ya están ${estado}`, [`${mapaAccion[estado] || 'accion desconocida'}s`]: 0 });
      }

      console.log(`${tag} folios a desactivar: `, foliosToUpdate);

      // Actualización masiva (Bulk) para garantizar rendimiento
      const updateResult = await db_support.TicketEventoDB.updateMany(
        { folio: { $in: foliosToUpdate } },
        { 
          $set: { 
            usado: false, 
            fecha_uso: null, 
            validado_por: null,
            estado: estado
          },
          $push: {
            historial: {
              accion: `${mapaAccion[estado] || 'accion desconocida'}`,
              descripcion: `${estado} en lote por ${user_email}`
            }
          }
        }
      );

      return res.status(200).json({ 
        status: 'ok', 
        mensaje: `Entradas de la familia que se ${estado} correctamente`, 
        [`${mapaAccion[estado] || 'accion desconocida'}s`]: updateResult.modifiedCount 
      });
    }
  } catch (error) {
    console.error('[/api/entrada/desactivar] Error:', error);
    res.status(500).json({ error: 'Error al desactivar entrada' });
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

router.get('/entrada/qr/imagen', apiKeyAuth, async (req, res) => {
  const tag = '[/api/entrada/imagen]';
  const url_server = config_env.URL_SERVER || BASEURL;
  try {
    const { 
            id_organizacion,
            id_evento,
            folio,
            save_file
          } = req.query;


    const ticketInfo = await db_support.TicketEventoDB.findOne({
      id_organizacion: id_organizacion,
      id_evento: id_evento,
      folio: folio
    }).lean();
    /*if (!ticketInfo) {
      console.log(`${tag} Folio ${folio} no encontrado`);
    } else {
      const { id_organizacion, id_evento, familia, nombre_completo, folio, num_listado, curso, jornada, tipo, bloques } = ticketInfo;
      console.log(`${tag} ticketInfo: `, { id_organizacion, id_evento, familia });
    }*/

    const [qr_buffer, qr_data] = await genQrEntradaCanvas({...ticketInfo, url_server});
    //console.log(`${tag} qr_data: ${qr_data}`);

    res.set('Content-Type', 'image/png');
    if (qr_buffer) {
      if (save_file) {
        const tailoredName = ticketInfo.tipo === 'estudiante' ? ticketInfo.nombre_completo : `${ticketInfo.familia.replace(/ /g, "_")}_${ticketInfo.tipo}` ;
        const nombreArchivo = `${id_evento.replace(/ /g, "_")}_${String(folio).padStart(4, '0')}_${tailoredName}.png`;
        await save_png(qr_buffer, nombreArchivo);
        await append_qr_data(qr_data, 'qr_send_email_png.txt');
      }
      res.send(qr_buffer);
    } else {
      console.log(`${tag} image buffer null. err_message: ${qr_data}`);
      res.status(500).json({ error: 'POST /entrada/imagen Error imagen no disponible' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'POST /entrada/imagen Error no especifico', err });
  }
});

// 7. Get Imagen del Ticket
router.get('/entrada/imagen', apiKeyAuth, async (req, res) => {
  const tag = '[/api/entrada/imagen]';
  const url_server = config_env.URL_SERVER || BASEURL;
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

// 7b. POST Imagen del Ticket (para test/preview sin API key)
router.post('/entrada/imagen', async (req, res) => {
  const tag = '[POST /api/entrada/imagen]';
  const url_server = config_env.URL_SERVER || BASEURL;
  try {
    const { familia, nombre_completo, colores, folio, total, num_listado, curso, jornada, tipo } = req.body;

    const ticketData = {
      url_server,
      id_organizacion: 'test',
      id_evento: 'test',
      imagen_ticket_path: './img/ticket_fiesta_chilena_2026.png',
      familia,
      nombre_completo,
      folio: parseInt(folio),
      num_listado: parseInt(num_listado) || '',
      curso,
      jornada,
      tipo,
      bloques: colores
    };

    const result = await genEntradaCanvas(ticketData);

    if (result && result[0]) {
      res.set('Content-Type', 'image/png');
      res.send(result[0]);
    } else {
      console.log(`${tag} image buffer null`);
      res.status(500).json({ error: 'Error: imagen no disponible' });
    }
  } catch (err) {
    console.error(`${tag}`, err);
    res.status(500).json({ error: err.message || 'Error generando ticket' });
  }
});


// 8. Get tickets de una familia
router.get('/entrada/familia', apiKeyAuth, async (req, res) => {
  const tag = '[/api/entrada/familia]';
  const url_server = config_env.URL_SERVER || BASEURL;
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

    // Conjunto de valores EXACTOS de 'familia' que identifican a ESTA familia.
    // Se usa para no mezclar familias homonimas (mismo apellido, distinto grupo)
    // cuando el campo 'familia' quedo guardado con distinta capitalizacion entre
    // hermanos (p.ej. "Ramirez silva" y "ramirez silva").
    let familiasExactas = null;

    if (familia) {
      id_familia = familia;
    } else if (nombre_completo) {
      const familiaInfo = await db_support.hermanosMapDB.findOne({ 'id': nombre_completo });
      const { nombre_familia, hermanos } = familiaInfo || {};
      id_familia = nombre_familia;

      // Resolver la familia por los HERMANOS reales del indice inverso: se buscan
      // los tickets de tipo 'estudiante' de esos hermanos (match tolerante a
      // mayus/minus y espacios sobre nombre_completo) y se toman sus valores de
      // 'familia' exactos. Asi se cubren las entradas de apoderado/invitado
      // asociadas y se distinguen familias homonimas.
      const nombresFamilia = [...new Set([...(hermanos || []), nombre_completo].map(normalizarNombre).filter(Boolean))];
      if (nombresFamilia.length) {
        const rxNombres = nombresFamilia.map(rxFamilia);
        const ticketsEstudiantes = await db_support.TicketEventoDB.find({
          id_organizacion, id_evento, tipo: 'estudiante', nombre_completo: { $in: rxNombres }
        }).lean();
        const set = [...new Set(ticketsEstudiantes.map(t => t.familia).filter(Boolean))];
        if (set.length) familiasExactas = set;
      }
    } else if (folio) {
      const ticketInfo = await db_support.TicketEventoDB.findOne({id_organizacion, id_evento, folio});
      id_familia = ticketInfo.familia;
    }
    if (familiasExactas || id_familia) {
      // Preferir el conjunto de familias exactas (deriva de los hermanos reales).
      // Si no se pudo determinar, caer a un match tolerante a mayus/minus por el
      // nombre_familia canonico.
      const filtroFamilia = familiasExactas
        ? { $in: familiasExactas }
        : rxFamilia(id_familia);
      const tickets = await db_support.TicketEventoDB.find({ id_organizacion, id_evento, familia: filtroFamilia}).sort({ folio: 1 }).lean();
      if (tickets) {
        console.log(`${tag} folios: ${tickets.map(t => t.folio)}`);
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


router.delete('/entrada/familia', apiKeyAuth, async (req, res) => {
  const tag = '[/api/entrada/familia]';
  try {
    const { id_organizacion, id_evento, user_email } = req.query;

    if (!id_organizacion || !id_evento || !user_email) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos: id_organizacion, id_evento, user_email' });
    }

    // Buscar entradas de la familia en la base de datos
    // 1. Buscar usuario por email
    const userInfo = await db_support.usersDB.findOne({ email: user_email });
    if (!userInfo) {
      return res.status(404).json({ error: `Usuario con email ${user_email} no encontrado` });
    }

    // 2. Verificar si el usuario tiene hijos y obtener la familia
    const { hijos } = userInfo;
    if (!hijos || !hijos.length) {
      return res.status(404).json({ error: `Usuario con email ${user_email} no tiene hijos enrolados` });
    }

    // 3. Obtener la familia del primer hijo (asumiendo que todos los hijos pertenecen a la misma familia)
    const familiaInfo = await db_support.hermanosMapDB.findOne({ 'id': hijos[0].nombre }).lean();
    const familia = familiaInfo ? familiaInfo.nombre_familia : null;
    if (!familia) {
      return res.status(404).json({ error: `No se encontró información de familia para el usuario con email ${user_email}` });
    }
    
    // Eliminar entradas de la familia
    const deleteResult = await db_support.TicketEventoDB.deleteMany({ id_organizacion, id_evento, familia });

    console.log(`${tag} Entradas de la familia ${familia} eliminadas correctamente. Total eliminadas: ${deleteResult.deletedCount}`);

    res.status(200).json({
      deletedCount: deleteResult.deletedCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `${tag} Error no especifico` });
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

async function activarEntradaParaHuilen(id_organizacion, id_evento) {
  const tag = '[/api/entradas/huilen/activar]';
  try {
    if (!id_organizacion || !id_evento) {
      console.log(`${tag} Faltan parámetros id_organizacion o id_evento`);
      return false;
    }
    // Lógica para activar la entrada para Huilen
    console.log(`${tag} Activando entrada para Huilen en el evento ${id_evento}`);
    // Aquí iría la implementación específica para activar la entrada
    const result_activar = await db_support.TicketEventoDB.updateMany(
        { id_evento, estado: { $eq: "inactiva" } },
        { $set: { estado: "activa" } }
    );
    
    
    return true;
  } catch (error) {
    console.error(`${tag} Error al activar entrada para Huilen:`, error);
    return false;
  }
}

router.get('/entradas/huilen/pre_generar', apiKeyAuth, async (req, res) => {
  const tag = '[/api/entradas/huilen/pre_generar]';
  const nombres_estudiantes = [];
  try {
    const id_organizacion = req.query.id_organizacion;
    const id_evento = req.query.id_evento;

    //console.log(`${tag} ${JSON.stringify({id_organizacion, id_evento})}`);
    // Corregir regla
    try {
      const indexes = await db_support.TicketEventoDB.collection.listIndexes().toArray();
      const indexExists = indexes.some(idx => idx.name === "folio_1");

      if (indexExists) {      
        await db_support.TicketEventoDB.collection.dropIndex("folio_1");
        await db_support.TicketEventoDB.collection.createIndex({ id_evento: 1, folio: 1 }, { unique: true });
      }
    } catch (error) {
      console.error(`${tag} Indices already fixed:`, error);
    }
    // Obtener informacion del evento:
    const infoEvento = await db_support.EventDB.findOne({id_evento});
    const curso_bloques = infoEvento ? infoEvento.cursoBloqueMap : {};
    //console.log(`${tag} infoEvento: `, infoEvento);
    const imagen_ticket_path = infoEvento.imagen_ticket_path;

    // Obtener listado de cursos desde la base de datos
    const huilenInfo = await db_support.HuilenMapDB.find().lean();
    const listadoEstudiantes = huilenInfo.map( item => item.id);
    
    for (const nombre_completo of listadoEstudiantes) {
      //console.log(`${tag} nombre_completo: `, nombre_completo);
      // Verificar si nombre_complete ya existe en nombres_estudiantes para evitar duplicados
      if (!nombres_estudiantes.includes(nombre_completo)) {
        // Generar entrada para la familia del estudiante
        //console.log(`${tag} calling generarEntradaParaFamilia(${JSON.stringify({id_organizacion, id_evento, imagen_ticket_path, nombre_completo, curso_bloques})})`);
        const nombres = await generarEntradaParaFamiliaHuilen(id_organizacion, id_evento, imagen_ticket_path, nombre_completo, curso_bloques, false);
        if (!nombres || !nombres.length) {
          console.log(`${tag} failed creating entradas para familia de ${nombres_estudiantes}`);
          return;
        }
        // Agregar nombres generados a la lista de nombres_estudiantes
        nombres_estudiantes.push(...nombres);
        //break;  // jsut for debugging
      }
    }

    console.log(`${tag} Pre-generación de entradas completada. Total estudiantes procesados: ${nombres_estudiantes.length}`);
    res.json({ status: 'ok', total_estudiantes: nombres_estudiantes.length });
  } catch (error) {
    console.error(`${tag} Error:`, error);
    res.status(500).json({ error: 'Error al pre-generar entradas' });
  }
});

async function generarEntradaParaFamiliaHuilen(id_organizacion, id_evento, imagen_ticket_path, nombre_completo, curso_bloques, save_file, user_email) {
  const tag = '[generarEntradaParaFamiliaHuilen]';
  const lista_entradas = [];
  // Detecta si está en producción según NODE_ENV o si existe URL_SERVER
  const localPort = process.env.PORT || 5001;
  const baseUrl = localPort !== 5001 
    ? config_env.URL_SERVER
    : `http://localhost:5001`;  
  //console.log(`generarEntradaParaFamilia: ${JSON.stringify({id_evento, imagen_ticket_path, nombre_completo})}`);
  //console.log(`${tag} url_server: ${baseUrl}`);
  try {
    console.log(`${tag} Generando entrada para la familia del estudiante: ${nombre_completo} en el evento: ${id_evento}`);
    // Buscar la familia en la base de datos usando el nombre completo del estudiante
    const familiaInfo = await db_support.hermanosMapDB.findOne({ 'id': nombre_completo }).lean();
    const { nombre_familia, hermanos } = familiaInfo || {};

    console.log(`${tag}:1440 hermanos: `, hermanos);
    // Arreglos
    const cursos = new Set();
    const jornadas = new Set();
    const bloques = new Set();
    const personas = [];
    
    let max_apoderados = 0;
    let max_invitados = 0;
    
    //const jornadaMap = { manana: 'AM', tarde: 'PM'};

    const infoPersona = {id_organizacion, id_evento, imagen_ticket_path, familia: nombre_familia, curso: '', num_listado: '', save_file};

    // Buscar Cursos
    for (const nombre_estudiante of hermanos || []) {
      console.log(`${tag}:1455 nombre estudiante: `, nombre_estudiante)
      const estudianteInfo = await db_support.nombreCursoMapDB.findOne({ 'id': nombre_estudiante });
      const curso = estudianteInfo.value;
      cursos.add(curso);
      const bloqueInfo = curso_bloques['HI'];
      jornadas.add(bloqueInfo.jornada);
      bloques.add(bloqueInfo.bloque);
      max_apoderados = Math.max(max_apoderados, bloqueInfo.pases_apoderados);
      max_invitados = Math.max(max_invitados, bloqueInfo.pases_invitados);
      const cursoInfo = await db_support.listadoCursosDB.findOne({ id: curso});
      const num_listado = cursoInfo.estudiantesCurso[nombre_estudiante].no_lista;
      const persona = { ...infoPersona, nombre_completo: nombre_estudiante, curso, num_listado};
      console.log(`${tag}:1467 adding estudiante: `, persona);
      personas.push(persona);
    }

    console.log(`${tag}:1470 largo hermanos: ${hermanos.length}, max_apoderados: ${max_apoderados}, max_invitados: ${max_invitados}, largo personas: ${personas.length}`);
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
      console.log(`${tag}:1490 crear entrada para: `, entrada);
      // Buscar si la entrada ya existe en la base de datos
      const existingEntry = await db_support.TicketEventoDB.findOne({
        id_organizacion: entrada.id_organizacion,
        id_evento: entrada.id_evento,
        familia: entrada.familia,
        nombre_completo: entrada.nombre_completo,
        tipo: entrada.tipo
      });

      if (existingEntry) {
        if ((existingEntry.estado === 'anulada' || existingEntry.estado === 'inactiva') && ( await hasSupervisorAccessRights(user_email))){
          const prev_estado = existingEntry.estado;
          console.log(`${tag}:1503 La entrada para ${entrada.nombre_completo} estaba ${prev_estado}. Se reactivará. Folio: ${existingEntry.folio}`);
          await db_support.TicketEventoDB.findOneAndUpdate(
            { _id: existingEntry._id },
            { 
              $set: {
                estado: 'inactiva',
                bloques: entrada.bloques,
                jornada: entrada.jornada,
                curso: entrada.curso,
                qr_str: genQrData(entrada),
                usado: false,
                fecha_uso: null,
                validado_por: null
              },
              $push: {
                historial: {
                  accion: 'reactivacion',
                  descripcion: `entrada reactivada (inactiva) durante creacion de entradas de la familia`
                }
              }
            }
          );
        } else
          console.log(`${tag}:1526 La entrada para ${entrada.nombre_completo} ya existe. Folio: ${existingEntry.folio}`);
        if (entrada.tipo === 'estudiante') {
          lista_entradas.push(entrada.nombre_completo);
        }
        continue; // Saltar a la siguiente entrada si ya existe
      }

      // Si la entrada no existe, crearla mediante la API
      console.log(`${tag}:1534 Creando la entrada...`);
      const result_create = await fetch(`${baseUrl}/api/entrada/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify(entrada)
      });
      if (result_create.status != 200 ) {
        const errBody = await result_create.json().catch(() => ({ error: 'Error no especificado' }));
        console.log(`${tag}:1542 La entrada para ${entrada.nombre_completo} no se pudo crear. status: ${result_create.status} | error: ${errBody.error}`);
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

async function generarEntradaParaFamilia(id_organizacion, id_evento, imagen_ticket_path, nombre_completo, curso_bloques, save_file, user_email) {
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
    const familiaInfo = await db_support.hermanosMapDB.findOne({ 'id': nombre_completo }).lean();
    const { nombre_familia, hermanos } = familiaInfo || {};

    console.log(`${tag}:1440 hermanos: `, hermanos);
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
      console.log(`${tag}:1455 nombre estudiante: `, nombre_estudiante)
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
      console.log(`${tag}:1467 adding estudiante: `, persona);
      personas.push(persona);
    }

    console.log(`${tag}:1470 largo hermanos: ${hermanos.length}, max_apoderados: ${max_apoderados}, max_invitados: ${max_invitados}, largo personas: ${personas.length}`);
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
      console.log(`${tag}:1490 crear entrada para: `, entrada);
      // Buscar si la entrada ya existe en la base de datos
      const existingEntry = await db_support.TicketEventoDB.findOne({
        id_organizacion: entrada.id_organizacion,
        id_evento: entrada.id_evento,
        familia: entrada.familia,
        nombre_completo: entrada.nombre_completo,
        tipo: entrada.tipo
      });

      if (existingEntry) {
        if ((existingEntry.estado === 'anulada' || existingEntry.estado === 'inactiva') && ( await hasSupervisorAccessRights(user_email))){
          const prev_estado = existingEntry.estado;
          console.log(`${tag}:1503 La entrada para ${entrada.nombre_completo} estaba ${prev_estado}. Se reactivará. Folio: ${existingEntry.folio}`);
          await db_support.TicketEventoDB.findOneAndUpdate(
            { _id: existingEntry._id },
            { 
              $set: {
                estado: 'inactiva',
                bloques: entrada.bloques,
                jornada: entrada.jornada,
                curso: entrada.curso,
                qr_str: genQrData(entrada),
                usado: false,
                fecha_uso: null,
                validado_por: null
              },
              $push: {
                historial: {
                  accion: 'reactivacion',
                  descripcion: `entrada reactivada (inactiva) durante creacion de entradas de la familia`
                }
              }
            }
          );
        } else
          console.log(`${tag}:1526 La entrada para ${entrada.nombre_completo} ya existe. Folio: ${existingEntry.folio}`);
        if (entrada.tipo === 'estudiante') {
          lista_entradas.push(entrada.nombre_completo);
        }
        continue; // Saltar a la siguiente entrada si ya existe
      }

      // Si la entrada no existe, crearla mediante la API
      console.log(`${tag}:1534 Creando la entrada...`);
      const result_create = await fetch(`${baseUrl}/api/entrada/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify(entrada)
      });
      if (result_create.status != 200 ) {
        const errBody = await result_create.json().catch(() => ({ error: 'Error no especificado' }));
        console.log(`${tag}:1542 La entrada para ${entrada.nombre_completo} no se pudo crear. status: ${result_create.status} | error: ${errBody.error}`);
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
    //console.log(`${tag}:1565 curso_bloques: `, curso_bloques);
    //console.log(`${tag}:1566 curso_bloques: `, JSON.stringify(curso_bloques));
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
    const eventos = await db_support.EventDB.find({id_evento}).lean();
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
  const url_server = config_env.URL_SERVER || BASEURL;
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
      // Registrar en el usuario que sus entradas ya fueron enviadas por correo,
      // para que el mantenedor de Apoderados refleje el estado correcto.
      // Se busca por email de forma case-insensitive (mismo criterio que /api/reenviar_entradas).
      try {
        const emailRegex = new RegExp('^' + email_destinatario.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
        const updateResult = await db_support.usersDB.updateOne(
          { email: { $regex: emailRegex } },
          { $set: { entradas_enviadas: true, fecha_envio_entradas: new Date() } }
        );
        if (updateResult.matchedCount === 0) {
          console.log(`${tag} Envio OK pero no se encontro usuario con email ${email_destinatario} para marcar entradas_enviadas`);
        }
      } catch (e) {
        // No se debe fallar el envio por un problema al actualizar el estado
        console.log(`${tag} Envio OK pero fallo al marcar entradas_enviadas: `, e.message || e);
      }
      res.status(200).json(send_email_result);
    } else {
      res.status(400).json(send_email_result);
    }

  } catch (err) {
    console.log(`${tag} Error: `, err);
    res.status(500).json({message: 'Unexpected error', err});
  }
});


// Crear una entrada de cortesía y enviarla por correo desde la cuenta del CGPA.
// Solo pueden usarlo perfiles administrador o supervisor.
// La entrada se crea con tipo 'cortesia' y estado 'activa' (lista para validar).
router.post('/entrada/cortesia', apiKeyAuth, async (req, res) => {
  const tag = '[POST /api/entrada/cortesia]';
  const url_server = config_env.URL_SERVER || BASEURL;
  try {
    const {
      id_organizacion = 'cpa_patrona',
      id_evento = 'fiesta_chilena_2026',
      nombre_completo,
      bloques,
      correo,
      cantidad,
      user_email
    } = req.body;

    // Jornada y curso ya no se solicitan en la pagina de Entradas Cortesía;
    // se guardan vacíos en el ticket.
    const jornada = '';
    const curso = '';

    // Validar campos obligatorios del formulario.
    if (!nombre_completo || !nombre_completo.trim()) {
      return res.status(400).json({ error: 'Falta el nombre completo' });
    }
    if (!correo || !correo.trim()) {
      return res.status(400).json({ error: 'Falta el correo del destinatario' });
    }
    if (!bloques || !String(bloques).trim()) {
      return res.status(400).json({ error: 'Debe seleccionar al menos un bloque' });
    }

    // Cantidad de entradas a crear (por defecto 1). Debe ser un entero >= 1.
    const cantidadEntradas = parseInt(cantidad, 10);
    if (cantidad !== undefined && (!Number.isInteger(cantidadEntradas) || cantidadEntradas < 1)) {
      return res.status(400).json({ error: 'La cantidad de entradas debe ser un número entero mayor o igual a 1' });
    }
    const totalEntradas = Number.isInteger(cantidadEntradas) && cantidadEntradas >= 1 ? cantidadEntradas : 1;

    // Control de acceso: solo administrador o supervisor
    if (!user_email) {
      return res.status(400).json({ error: 'Falta user_email para validar permisos' });
    }
    const autorizado = await hasSupervisorAccessRights(user_email);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere perfil de Administrador o Supervisor' });
    }

    // Obtener la imagen de fondo del ticket configurada para el evento (una vez)
    const eventInfo = await db_support.EventDB.findOne({ id_evento });
    const imagen_ticket_path = eventInfo ? eventInfo.imagen_ticket_path : '';

    const nombreTexto = nombre_completo.trim();
    const bloquesTexto = String(bloques || '').trim() || '—';

    // Crear 'totalEntradas' entradas de cortesía. Cada una es un ticket
    // independiente (folio y familia únicos) para que la validación por QR de
    // una no afecte a las demás. Se adjuntan todas en un solo correo.
    const attachments = [];
    const entradasCreadas = [];

    for (let i = 0; i < totalEntradas; i++) {
      // El esquema de TicketEvento exige 'familia' (required). Las entradas de
      // cortesía no tienen familia asociada; se usa un valor temporal para pasar
      // la validación y luego se reasigna a "Cortesía-<folio>" (familia única por
      // entrada). Esto evita que la validación por QR (que marca como usadas todas
      // las entradas de una misma familia) afecte a otras entradas de cortesía.
      const ticket = await db_support.TicketEventoDB.create({
        id_organizacion,
        id_evento,
        familia: 'Cortesía',
        nombre_completo: nombreTexto,
        tipo: 'cortesia',
        jornada: jornada || '',
        curso: curso || '',
        bloques: bloques || '',
        num_listado: 0,
        fecha_generacion: new Date(),
        usado: false,
        estado: 'activa',
        validado_por: null,
        correo_destinatario: correo.trim(),
        historial: [{ accion: 'creacion', descripcion: `entrada de cortesía creada por ${user_email}` }]
      });

      const folio = ticket.folio || '';
      const folioSerialItem = String(folio).padStart(4, '0');

      // Reasignar la familia a un valor único por entrada para aislar la
      // validación familiar de otras entradas de cortesía.
      const familia = `Cortesía-${folioSerialItem}`;
      await db_support.TicketEventoDB.updateOne({ folio }, { $set: { familia } });

      const ticketInfo = {
        url_server,
        id_organizacion,
        id_evento,
        imagen_ticket_path,
        familia,
        nombre_completo: nombreTexto,
        folio,
        num_listado: 0,
        curso: curso || '',
        jornada: jornada || '',
        tipo: 'cortesia',
        bloques: bloques || ''
      };

      // Generar la imagen del ticket y guardar el qr_str en la entrada (para que
      // la entrada quede válida en el flujo de validación por QR).
      const [buffer, qr_str] = await genEntradaCanvas(ticketInfo);
      if (!buffer) {
        console.log(`${tag} image buffer null (folio ${folio})`);
        return res.status(500).json({ error: 'No se pudo generar la imagen de la entrada' });
      }
      await db_support.TicketEventoDB.findOneAndUpdate(
        { folio, id_evento, nombre_completo: nombreTexto },
        { $set: { qr_str } }
      );

      const nombreArchivo = `${id_evento.replace(/ /g, '_')}_${folioSerialItem}_${nombreTexto.replace(/ /g, '_')}.png`;
      attachments.push({ filename: nombreArchivo, content: buffer, contentType: 'image/png' });

      entradasCreadas.push({
        folio: folioSerialItem,
        nombre_completo: nombreTexto,
        bloques: bloquesTexto,
        correo: correo.trim(),
        fecha_envio: new Date().toISOString()
      });
    }

    // Datos de la primera entrada (para mensajes y compatibilidad de respuesta).
    const folioSerial = entradasCreadas[0].folio;
    const foliosSeriales = entradasCreadas.map(e => e.folio);
    const asuntoCorreo = totalEntradas > 1
      ? `Entradas de Cortesía (${totalEntradas})`
      : 'Entrada de Cortesía';

    // Cuerpo del correo en HTML, con un diseño coherente con la página del
    // sistema (tarjeta con encabezado y filas de datos ingresados en pantalla).
    const mensajeCorreo = `
      <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; background:#f1f4f9; padding:24px;">
        <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:10px; border-left:5px solid #4A90E2; box-shadow:0 2px 10px rgba(0,0,0,0.08); overflow:hidden;">
          <div style="background:linear-gradient(135deg,#4A90E2,#357abd); padding:20px 24px; color:#ffffff;">
            <h1 style="margin:0; font-size:1.25rem;">🎫 ${totalEntradas > 1 ? 'Entradas de Cortesía' : 'Entrada de Cortesía'}</h1>
            <p style="margin:4px 0 0; font-size:0.85rem; opacity:0.9;">Fiesta a la Chilena · Colegio Patrona de Lourdes</p>
          </div>
          <div style="padding:24px;">
            <p style="font-size:0.95rem; color:#333; margin:0 0 16px;">Estimado(a) <strong>${nombreTexto}</strong>, ${totalEntradas > 1 ? `adjuntamos sus ${totalEntradas} entradas de cortesía` : 'adjuntamos su entrada de cortesía'}. Presente el código QR al momento de ingresar al evento.</p>
            <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
              <tr>
                <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#888; font-weight:600; text-transform:uppercase; font-size:0.75rem;">Nombre</td>
                <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#333; text-align:right; font-weight:600;">${nombreTexto}</td>
              </tr>
              <tr>
                <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#888; font-weight:600; text-transform:uppercase; font-size:0.75rem;">Bloques</td>
                <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#333; text-align:right; font-weight:600;">${bloquesTexto}</td>
              </tr>
              <tr>
                <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#888; font-weight:600; text-transform:uppercase; font-size:0.75rem;">${totalEntradas > 1 ? 'N° Entradas' : 'N° Entrada'}</td>
                <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#333; text-align:right; font-weight:600;">${foliosSeriales.join(', ')}</td>
              </tr>
            </table>
            <p style="font-size:0.85rem; color:#666; margin:20px 0 0;">Saludos cordiales,<br><strong>Centro General de Padres y Apoderados (CGPA)</strong></p>
          </div>
        </div>
      </div>
    `;

    const send_email_result = await send_email_from_cpa_account({
      email_destinatario: correo.trim(),
      asuntoCorreo,
      mensajeCorreo,
      attachments
    });

    if (send_email_result.status !== 'ok') {
      console.log(`${tag} Entradas ${foliosSeriales.join(', ')} creadas pero fallo el envio de correo:`, send_email_result.message);
      return res.status(200).json({
        status: 'partial',
        folio: folioSerial,
        folios: foliosSeriales,
        entradas: entradasCreadas,
        mensaje: totalEntradas > 1
          ? 'Las entradas se crearon, pero no se pudo enviar el correo.'
          : 'La entrada se creó, pero no se pudo enviar el correo.',
        email_error: send_email_result.message
      });
    }

    console.log(`${tag} ${totalEntradas} entrada(s) de cortesía (${foliosSeriales.join(', ')}) creadas y enviadas a ${correo}`);
    return res.status(200).json({
      status: 'ok',
      folio: folioSerial,
      folios: foliosSeriales,
      mensaje: totalEntradas > 1
        ? `${totalEntradas} entradas de cortesía (N° ${foliosSeriales.join(', ')}) creadas y enviadas a ${correo.trim()}`
        : `Entrada de cortesía N° ${folioSerial} creada y enviada a ${correo.trim()}`,
      // Datos de las entradas para mostrar en la tabla de resultados de la página.
      entradas: entradasCreadas,
      // Compatibilidad: primera entrada creada.
      entrada: entradasCreadas[0]
    });

  } catch (err) {
    console.error(`${tag} Error:`, err);
    res.status(500).json({ error: 'Error al crear la entrada de cortesía' });
  }
});


// Generar y devolver el PDF de las entradas de un apoderado (para abrir en una
// nueva pestaña, sin enviarlo por correo). Reutiliza el mismo flujo de
// generacion que /entradas/send_email cuando tipo_attachment === 'pdf'.
router.get('/entradas/pdf', async (req, res) => {
  const tag = '[GET /entradas/pdf]';
  const url_server = config_env.URL_SERVER || BASEURL;
  try {
    const { user_email } = req.query;
    if (!user_email) return res.status(400).json({ error: 'Falta user_email' });

    const id_organizacion = 'cpa_patrona';
    const id_evento = 'fiesta_chilena_2026';

    // 1. Buscar el usuario y su primer hijo para determinar la familia
    const emailRegex = new RegExp('^' + user_email.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    const user = await db_support.usersDB.findOne({ email: { $regex: emailRegex } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!user.hijos || user.hijos.length === 0) return res.status(400).json({ error: 'El usuario no tiene hijos registrados' });

    const nombreHijo = user.hijos[0].nombre;
    const familiaInfo = await db_support.hermanosMapDB.findOne({ id: nombreHijo });
    if (!familiaInfo || !familiaInfo.nombre_familia) return res.status(404).json({ error: 'No se encontró la familia del usuario' });
    const familia = familiaInfo.nombre_familia;

    // 2. Obtener las entradas activas de la familia
    const tickets = await db_support.TicketEventoDB.find({ id_organizacion, id_evento, familia }).sort({ folio: 1 }).lean();
    const ticketsActivos = (tickets || []).filter(t => t.estado === 'activa');
    if (ticketsActivos.length === 0) return res.status(400).json({ error: 'No hay entradas activas para mostrar' });

    // 3. Generar los buffers PNG de cada entrada (mismo flujo que send_email pdf)
    let evento_id = null;
    const buffersPNG = await Promise.all(
      ticketsActivos.map(async (ticket_info) => {
        if (!evento_id) evento_id = ticket_info.id_evento;
        const eventInfo = await db_support.EventDB.findOne({ id_evento: ticket_info.id_evento });
        const imagen_ticket_path = eventInfo ? eventInfo.imagen_ticket_path : '';
        const [resultadoCanvas] = await genEntradaCanvas({ ...ticket_info, imagen_ticket_path, url_server });
        return resultadoCanvas;
      })
    );

    const buffersValidos = buffersPNG.filter(buf => buf !== null);
    if (buffersValidos.length === 0) {
      return res.status(500).json({ error: 'No se pudieron generar las entradas' });
    }

    // 4. Compilar el PDF en memoria y devolverlo inline para abrir en el navegador
    const pdfBuffer = await generarPdfDesdeBuffers(buffersValidos);
    const nombreArchivo = `${(evento_id || id_evento).replace(/ /g, '_')}_${familia.replace(/ /g, '_')}.pdf`;

    console.log(`${tag} PDF generado para ${user_email} (familia: ${familia}, ${buffersValidos.length} entradas)`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.log(`${tag} Error: `, err);
    res.status(500).json({ error: 'Error al generar el PDF de las entradas' });
  }
});


// Listar el historial de entradas de cortesía creadas para un evento.
// Solo para perfiles administrador o supervisor.
router.get('/entrada/cortesia/listar', apiKeyAuth, async (req, res) => {
  const tag = '[GET /api/entrada/cortesia/listar]';
  try {
    const {
      id_organizacion = 'cpa_patrona',
      id_evento = 'fiesta_chilena_2026',
      user_email
    } = req.query;

    if (!user_email) {
      return res.status(400).json({ error: 'Falta user_email para validar permisos' });
    }
    const autorizado = await hasSupervisorAccessRights(user_email);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere perfil de Administrador o Supervisor' });
    }

    // Se excluyen las entradas anuladas (borrado lógico): no deben mostrarse en
    // el historial de cortesías vigentes.
    const tickets = await db_support.TicketEventoDB.find({
      id_organizacion,
      id_evento,
      tipo: 'cortesia',
      estado: { $ne: 'anulada' }
    }).sort({ folio: -1 }).lean();

    const entradas = (tickets || []).map(t => ({
      folio: String(t.folio).padStart(4, '0'),
      nombre_completo: t.nombre_completo || '—',
      bloques: t.bloques || '—',
      correo: t.correo_destinatario || '—',
      fecha_envio: t.fecha_generacion || null
    }));

    return res.status(200).json({ status: 'ok', entradas });
  } catch (err) {
    console.error(`${tag} Error:`, err);
    res.status(500).json({ error: 'Error al listar las entradas de cortesía' });
  }
});


// Eliminar una entrada de cortesía por folio. Solo administrador o supervisor.
// Por seguridad, solo permite eliminar tickets cuyo tipo sea 'cortesia'.
router.delete('/entrada/cortesia', apiKeyAuth, async (req, res) => {
  const tag = '[DELETE /api/entrada/cortesia]';
  try {
    const { folio, user_email } = req.body;

    if (!folio) {
      return res.status(400).json({ error: 'Falta el folio de la entrada a eliminar' });
    }
    if (!user_email) {
      return res.status(400).json({ error: 'Falta user_email para validar permisos' });
    }
    const autorizado = await hasSupervisorAccessRights(user_email);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere perfil de Administrador o Supervisor' });
    }

    const folioNum = parseInt(folio);
    const ticket = await db_support.TicketEventoDB.findOne({ folio: folioNum });
    if (!ticket) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }
    // Solo se pueden eliminar entradas de cortesía desde este endpoint.
    if (ticket.tipo !== 'cortesia') {
      return res.status(400).json({ error: 'Solo se pueden eliminar entradas de cortesía' });
    }

    // Borrado lógico: en vez de eliminar el registro, se marca el folio como
    // ANULADO para conservar la trazabilidad. Una entrada anulada no debe poder
    // validarse por QR.
    await db_support.TicketEventoDB.updateOne(
      { folio: folioNum },
      {
        $set: { estado: 'anulada', usado: false, fecha_uso: null, validado_por: null },
        $push: { historial: { accion: 'anulacion', descripcion: `entrada de cortesía anulada por ${user_email}` } }
      }
    );
    console.log(`${tag} Entrada de cortesía ${folioNum} anulada por ${user_email}`);
    return res.status(200).json({ status: 'ok', folio: folioNum, estado: 'anulada' });
  } catch (err) {
    console.error(`${tag} Error:`, err);
    res.status(500).json({ error: 'Error al eliminar la entrada de cortesía' });
  }
});


module.exports = router;
// Se exporta la funcion de generacion/consolidacion de entradas por familia para
// poder reutilizarla desde otros modulos (p.ej. api_asignar_familia.js), de modo
// que al asignar/reasignar una familia se regeneren sus entradas (familia
// canonica, jornada/bloques combinados) sin duplicar la logica.
module.exports.generarEntradaParaFamilia = generarEntradaParaFamilia;
