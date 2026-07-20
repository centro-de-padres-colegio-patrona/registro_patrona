const db_support = require('../backend/db_support');
const test_result_array = {};

async function lauch_test_api(delay_ms = 500, url_server = 'http://localhost:5001', db_uri = '') {
  console.log('Launching Api Test...');
    setTimeout(test_api_db_connection, delay_ms/2, db_uri);
    setTimeout(test_api_curso, delay_ms, url_server);
    setTimeout(test_api_email_update, delay_ms, url_server);
    setTimeout(test_api_pagos_cpa, delay_ms, url_server);
    setTimeout(test_api_compromisos_pago, delay_ms, url_server);
    //setTimeout(actualizarTiposDePago, delay_ms);
    setTimeout(listing_all_tipos_de_pago, delay_ms+1000, url_server);
    //setTimeout(test_api_pago_compromiso, delay_ms);
    setTimeout(test_api_eventos, delay_ms+1500, url_server);
}

async function log_result(tag, result) {
  const result_upppercase = String(result).toUpperCase();
      console.log(`${tag}.....${result_upppercase}`);
}

async function test_api_get(tag, url_server, url, key, payload,  callback) {
  fetch(`${url_server}${url}?${key}=${encodeURIComponent(payload)}`)
    .then(res => res.json())
    .then(async res => callback(res))
    .catch(err => {
      console.error('Error', err);
      test_result_array[tag] = 'fail';
      log_result(tag, 'fail');
    });
} 

async function test_api_pagos_cpa(url_server = 'http://localhost:5001') {
  const tag = 'test /api/estado_pago_cpa';
  const url = '/api/estado_pago_cpa';
  const key = 'user_email';
  const user_email = 'l.herreramena@gmail.com';
  try {
    const result = await test_api_get(tag, url_server, url, key, user_email, pagos => { 
      //console.log('test_api_pagos: ', pagos);
      test_result_array[tag] = 'pass';
      log_result(tag, 'pass');
    });
  } catch (err) {
      console.error('Error al obtener nombres:', err);
      test_result_array[tag] = 'fail';
      log_result(tag, 'fail');
  }
}

async function test_api_compromisos_pago(url_server = 'http://localhost:5001') {
  const tag = 'test /api/compromisos_pago';
  const url = '/api/compromisos_pago';
  const key = 'user_email';
  const user_email = 'l.herreramena@gmail.com';
  try {
    const result = await test_api_get(tag, url_server, url, key, user_email, result => { 
      //console.log('test /api/compromisos_pago: ', result);
      if (result === undefined || result === null) {
        log_result(tag, 'fail');
      } else {
        test_result_array[tag] = 'pass';
        log_result(tag, 'pass');
      }
    });
  } catch (err) {
      console.error('Error al obtener nombres:', err);
      test_result_array[tag] = 'fail';
      log_result(tag, 'fail');
  }
}

async function test_api_curso(url_server = 'http://localhost:5001') {
  const query = "herrera messina cristobal nicolas";
  const tag = "test /api/curso";
  //console.log('fetching name ', query);
  fetch(`${url_server}/api/curso?nombre=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(async curso_section => {
      //console.log('/api/curso: ', curso_section);
      const {curso, seccion} = curso_section;
      //console.log('result: ', {curso, seccion});
      if (curso === '1M' && seccion === 'A') {
        //console.log(`${tag}.....PASS`);
        test_result_array[tag] = 'pass';
        log_result(tag, 'pass');
      }
    })
    .catch(err => {
      console.error('Error al obtener nombres:', err);
      test_result_array[tag] = 'fail';
      log_result(tag, 'fail');
    });
}

async function test_api_email_update(url_server = 'http://localhost:5001') {
  const tag = 'test /api/update_apoderado_email';
  const brothers_list = ['herrera messina florencia isidora', 'herrera messina cristobal nicolas'];
  const email = 'l.herreramena@gmail.com';
  try {
    const result = await fetch(`${url_server}/api/update_apoderado_email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brothers_list, email })
    });
    if (result) {
      log_result(tag, 'pass');
    } else {
      log_result(tag, 'fail');  
    }
  } catch (error) {
    console.error(`${tag} Error :`, error);
    log_result(tag, 'fail');
  }
}

async function test_api_pago_compromiso(url_server = 'http://localhost:5001') {
  const tag = 'test /api/boton_pago_compromiso';
  const compromiso_key = 'cuota_cpa';
  const user_email = 'l.herreramena@gmail.com';
  const nombre = 'Leonardo Cristian Herrera Messina';
  const rut = '20.123.456-7';
  const telefono = '+56912345678';
  try {
    const result = await fetch(`${url_server}/api/boton_pago_compromiso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compromiso_key, user_email, nombre, rut, telefono, test: true })
    });
    //console.log('Test Result: ', result);
    if (result.status === 200) {
      log_result(tag, 'pass');
    } else {
      log_result(tag, 'fail');  
    }
  } catch (error) {
    console.error(`${tag} Error :`, error);
    log_result(tag, 'fail');
  }
}

// Usando el modelo definido en db_support.js
const actualizarTiposDePago = async () => {
  try {
    /*const resultado = await db_support.pagosDB.updateMany(
      { tipo: 'pago_cuota' },   // Filtro: registros que coincidan con el valor antiguo
      { $set: { tipo: 'cuota_cpa' } } // Acción: cambiar el valor al nuevo
    );*/

    const resultado = await db_support.pagosDB.updateMany(
      { tipo: 'pago_agenda_sin_cpa' },   // Filtro: registros que coincidan con el valor antiguo
      { $set: { tipo: 'agenda_escolar', subtipo: 'agenda_sin_cpa' } } // Acción: cambiar el valor al nuevo
    );

    console.log(`Operación completada:`);
    console.log(`- Registros encontrados: ${resultado.matchedCount}`);
    console.log(`- Registros actualizados: ${resultado.modifiedCount}`);
  } catch (error) {
    console.error("Error al actualizar los registros:", error);
  }
};

async function listing_all_tipos_de_pago(url_server = 'http://localhost:5001') {
  try {
    const tipos = await db_support.pagosDB.distinct('tipo', {});
    console.log('Tipos de pago encontrados:', tipos);
  } catch (error) {
    console.error("Error al listar los tipos de pago:", error);
  }
}

/// Testear BD Eventos
async function test_api_eventos(url_server = 'http://localhost:5001') {
  const tag = 'test /api/eventos';
  const eventos_map = {
    'fiesta_chilena_2026': {
      nombre: 'Fiesta a la Chilena 2026',
      fecha: '2026-09-05',
      hora_inicio: '09:00',
      hora_termino: '17:00',
      hora_apertura_puertas: '08:15',
      descripcion: 'Evento de celebración cultural',
      imagen_ticket_path: `./img/ticket_fiesta_chilena_2026.jpg`
    },
    'bingo_familiar_2026': {
      nombre: 'Bingo Familiar 2026',
      fecha: '2026-10-10',
      hora_inicio: '14:00',
      hora_termino: '20:00',
      hora_apertura_puertas: '13:30',
      descripcion: 'Evento solidario de recaudación de fondos',
      imagen_ticket_path: `./img/ticket_bingo_familiar_2026.jpg`
    }
  }
  let result = 'pass';
  try {
    for (const [id_evento, eventoData] of Object.entries(eventos_map)) {
      //const id_evento = 'fiesta_chilena_2026';
      const result = await fetch(`${url_server}/api/eventos/buscar?id_evento=${id_evento}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const eventos = await result.json();
      //console.log('Eventos encontrados:', eventos);
      if (result.status !== 200 || !eventos || eventos.length === 0) {
        console.log(`Evento ${id_evento}, creando evento ...`);
        const result_create = await fetch(`${url_server}/api/eventos/crear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_evento,
            nombre: eventoData.nombre,
            fecha: eventoData.fecha,
            hora_inicio: eventoData.hora_inicio,
            hora_termino: eventoData.hora_termino,
            hora_apertura_puertas: eventoData.hora_apertura_puertas,
            descripcion: eventoData.descripcion,
            imagen_ticket_path: eventoData.imagen_ticket_path
          })
        });
        if (result_create.status !== 200) {
          log_result(tag, 'can not create event');
        }
        result = 'fail';
      }
    }
    console.log(`${tag} `, result);
    if (result !== 'pass') {
      log_result(tag, 'fail');
      throw new Error('test_api_eventos failed. Events not found or created');
    }
  } catch (error) {
    console.error(`${tag} Error :`, error);
    log_result(tag, 'fail');
  }
}

/// Testear uri de la conexion a la BD
async function test_api_db_connection(db_uri = '') {
  const tag = 'test DB Connection URI';
  const expected_uri = 'mongodb+srv://lherreramena_db_user:tPyw2Cvb2Hco8HM3@old-data.g2qp95c.mongodb.net/cpa_patrona_2026?retryWrites=true&w=majority&appName=old-data';
  if (!db_uri && db_uri !== expected_uri) {
    console.log(`${tag}: fail. Wrong DataBase URI:`, db_uri);
    throw new Error('DB Connection URI test failed');
  }
  console.log(`${tag}: pass`);
}

module.exports.lauch_test_api = lauch_test_api;
