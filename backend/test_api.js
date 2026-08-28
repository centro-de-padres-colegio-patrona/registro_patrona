const db_support = require('../backend/db_support');
const config_env = require('../src/setup/config/env.js');

const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

const SECRET_API_KEY = config_env.API_KEY;

const test_result_array = {};

class TestResult {
  static PASS = 'pass';
  static FAIL = 'fail';
}

async function lauch_test_api(delay_ms = 500, url_server = 'http://localhost:5001', db_uri = '') {
  console.log('Launching Api Test...');

  const test_array = [];

  test_array.push({test_fn: test_api_db_connection, delay: delay_ms, arguments: db_uri});
  test_array.push({test_fn: test_api_perfiles, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_api_curso, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_api_email_update, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_api_pagos_cpa, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_api_compromisos_pago, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: listing_all_tipos_de_pago, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_api_eventos, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_actualizar_correos_padres_de_cada_estudiante, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_consultar_hijos, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_consultar_apoderados, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_consistencia_users_hijos, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_post_api_correos_tipo, delay: delay_ms, arguments: url_server});
  //test_array.push({test_fn: test_delete_user, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_consulta_hijos_registrados, delay: delay_ms, arguments: url_server});
  //test_array.push({test_fn: test_activar_entradas, delay: delay_ms, arguments: url_server});
  //test_array.push({test_fn: test_desactivar_entradas, delay: delay_ms, arguments: url_server});
  //test_array.push({test_fn: test_api_crear_perfiles, delay: delay_ms, arguments: url_server});
  //test_array.push({test_fn: test_api_eliminar_perfiles, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_api_historial_ticket, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_qr_entradas, delay: delay_ms, arguments: url_server});
  //test_array.push({test_fn: test_get_api_correos_tipo, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_get_api_pagos, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_get_max_invitados, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_add_pase_rule, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_get_estado_pago_entradas, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_api_consulta_listas_curso, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_api_branch, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_api_consulta_estudiantes_relacion, delay: delay_ms, arguments: url_server});
  test_array.push({test_fn: test_api_consulta_estudiantes_subpertenencia, delay: delay_ms, arguments: url_server});

  console.log(`config_env.TEST_API_DELETE_APODERADO_EMAIL: ${config_env.TEST_API_DELETE_APODERADO_EMAIL}`);
  if ( config_env.TEST_API_DELETE_APODERADO_EMAIL && config_env.TEST_API_DELETE_APODERADO_EMAIL === 'true') {
    test_array.push({test_fn: test_api_delete_apoderado_email, delay: delay_ms, arguments: url_server});
  }

  if ( config_env.TEST_API_ENVIAR_CORREOS_PRUEBA && config_env.TEST_API_ENVIAR_CORREOS_PRUEBA === 'true') {
    test_array.push({test_fn: test_enviar_correos_de_prueba, delay: delay_ms, arguments: url_server});
  }

  if ( config_env.TEST_API_DESACTIVAR_ENTRADAS && config_env.TEST_API_DESACTIVAR_ENTRADAS === 'true') {
    test_array.push({test_fn: test_desactivar_entradas, delay: delay_ms, arguments: url_server});
  }

  if ( config_env.TEST_API_ANULAR_ENTRADAS && config_env.TEST_API_ANULAR_ENTRADAS === 'true') {
    test_array.push({test_fn: test_anular_entradas, delay: delay_ms, arguments: url_server});
  }

  if ( config_env.TEST_API_GENERAR_ENTRADAS_FAMILIA && config_env.TEST_API_GENERAR_ENTRADAS_FAMILIA === 'true') {
    test_array.push({test_fn: test_api_entradas_familia, delay: delay_ms, arguments: url_server});
  }

  console.log(`config_env.TEST_API_BORRAR_ENTRADAS: ${config_env.TEST_API_BORRAR_ENTRADAS}`);
  if ( config_env.TEST_API_BORRAR_ENTRADAS && config_env.TEST_API_BORRAR_ENTRADAS === 'true') {
    test_array.push({test_fn: test_api_borrar_entradas, delay: delay_ms, arguments: url_server});
  }

  if ( config_env.TEST_API_SEND_ENTRADAS_FAMILIA && config_env.TEST_API_SEND_ENTRADAS_FAMILIA === 'true') {
    test_array.push({test_fn: test_send_entradas, delay: delay_ms, arguments: url_server});
  }

  let test_name = ''

  try {
    for( const test_info of test_array) {
      const { test_fn, delay, arguments } = test_info;
      await test_fn(arguments);
    }

  } catch (error) {
    console.log('Unexpexted error running tests. Error: ', error)
  }
}

async function log_result(tag, result) {
  const result_upppercase = String(result).toUpperCase();
      const max_pad = 40;
      //const len_pad = tag.length < max_pad ? max_pad - tag.length : 0;
      const padded_tag = tag.padEnd(max_pad, '.');
      console.log(`${padded_tag}${result_upppercase}`);
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
      imagen_ticket_path: `./img/ticket_fiesta_chilena_v2_2026.png`,
      layout_tickets: {
        'ticket_fiesta_chilena_2026.png':
        [
          { id: 'font', value: 'PottiSreeramulu'},
          { id: 'familia', label: 'Familia: ', text: '$familia', x: 15, y: 415, fontSize: 30 },
          { id: 'nombre_completo', label: '', text: '$nombre_completo', x: 15, y: 448, fontSize: 30, maxPxWidth: 480, textAdjusted: true },
          { id: 'bloques', label: 'Bloques: ', text: '$bloques', x: 15, y: 481, fontSize: 30 },
          { id: 'jornadaDisplay', label: 'Jornada: ', text: '$jornadaDisplay', x: 15, y: 514, fontSize: 30 },
          { id: 'tipo', label: '', text: '$tipo', x: '$canvas.width / 2 + 80 - 40', y: 690-30-70, fontSize: 40, fillStyle: 'black', textAlign: 'left' },
          { id: 'serial', label: 'Folio: ', text: '$serial', x: '$canvas.width / 2 + 80 - 40', y: 700-70, fontSize: 32 },
          { id: 'curso', label: 'Curso: ', text: '$curso', x: '$canvas.width / 2 + 80 - 40', y: 660, fontSize: 18 },
          { id: 'num_listado', label: 'Nro Lista: ', text: '$num_listado', x: '$canvas.width / 2 + 80 - 40', y: 690, fontSize: 18 },
          { id: 'qr', label: '', text: '$qrData', x: 45-40, y: 608-70, width: 215, type: 'qr' }
        ],
        'ticket_fiesta_chilena_v2_2026.png':
        [
          { id: 'font', value: 'PottiSreeramulu'},
          { id: 'familia', label: 'Familia: ', text: '$familia', x: 15, y: 415, fontSize: 30 },
          { id: 'nombre_completo', label: '', text: '$nombre_completo', x: 15, y: 448, fontSize: 30, maxPxWidth: 480, textAdjusted: true },
          { id: 'bloques', label: 'Bloques: ', text: '$bloques', x: 15, y: 481, fontSize: 30 },
          { id: 'jornadaDisplay', label: 'Jornada: ', text: '$jornadaDisplay', x: 15, y: 514, fontSize: 30 },
          { id: 'tipo', label: '', text: '$tipo', x: '$canvas.width / 2 + 80 - 40', y: 690-30-70, fontSize: 40, fillStyle: 'black', textAlign: 'left' },
          { id: 'serial', label: 'Folio: ', text: '$serial', x: '$canvas.width / 2 + 80 - 40', y: 700-70, fontSize: 32 },
          { id: 'curso', label: 'Curso: ', text: '$curso', x: '$canvas.width / 2 + 80 - 40', y: 660, fontSize: 18 },
          { id: 'num_listado', label: 'Nro Lista: ', text: '$num_listado', x: '$canvas.width / 2 + 80 - 40', y: 690, fontSize: 18 },
          { id: 'qr', label: '', text: '$qrData', x: 45-40, y: 608-70, width: 215, type: 'qr' }
        ]
      },
      cursoBloqueMap: {
        'PKA': {id: 'PKA', jornada: 'manana', bloque: 'bloque_01', color: 'ama_m', hash: 'fiesta_chilena_2026_bloque_01', pases_apoderados: 2, pases_invitados: 2},
        'PKB': {id: 'PKB', jornada: 'manana', bloque: 'bloque_01', color: 'ama_m', hash: 'fiesta_chilena_2026_bloque_01', pases_apoderados: 2, pases_invitados: 2},
        'KA': {id: 'KA', jornada: 'manana', bloque: 'bloque_01', color: 'ama_m', hash: 'fiesta_chilena_2026_bloque_01', pases_apoderados: 2, pases_invitados: 2},
        'KB': {id: 'KB', jornada: 'manana', bloque: 'bloque_01', color: 'ama_m', hash: 'fiesta_chilena_2026_bloque_01', pases_apoderados: 2, pases_invitados: 2},
        '3A': {id: '3A', jornada: 'manana', bloque: 'bloque_02', color: 'ros_m', hash: 'fiesta_chilena_2026_bloque_02', pases_apoderados: 2, pases_invitados: 2},
        '3B': {id: '3B', jornada: 'manana', bloque: 'bloque_02', color: 'ros_m', hash: 'fiesta_chilena_2026_bloque_02', pases_apoderados: 2, pases_invitados: 2},
        '4A': {id: '4A', jornada: 'manana', bloque: 'bloque_02', color: 'ros_m', hash: 'fiesta_chilena_2026_bloque_02', pases_apoderados: 2, pases_invitados: 2},
        '4B': {id: '4B', jornada: 'manana', bloque: 'bloque_02', color: 'ros_m', hash: 'fiesta_chilena_2026_bloque_02', pases_apoderados: 2, pases_invitados: 2},
        '1MA': {id: '1MA', jornada: 'manana', bloque: 'bloque_03', color: 'ver_m', hash: 'fiesta_chilena_2026_bloque_03', pases_apoderados: 2, pases_invitados: 2},
        '2MA': {id: '2MA', jornada: 'manana', bloque: 'bloque_03', color: 'ver_m', hash: 'fiesta_chilena_2026_bloque_03', pases_apoderados: 2, pases_invitados: 2},
        '3MA': {id: '3MA', jornada: 'manana', bloque: 'bloque_03', color: 'ver_m', hash: 'fiesta_chilena_2026_bloque_03', pases_apoderados: 2, pases_invitados: 2},
        'HI': {id: 'HI', jornada: 'manana', bloque: 'bloque_03', color: 'ver_m', hash: 'fiesta_chilena_2026_bloque_03', pases_apoderados: 2, pases_invitados: 0},
        'HJ': {id: 'HJ', jornada: 'manana', bloque: 'bloque_03', color: 'ver_m', hash: 'fiesta_chilena_2026_bloque_03', pases_apoderados: 2, pases_invitados: 0},
        '1A': {id: '1A', jornada: 'manana', bloque: 'bloque_04', color: 'roj_m', hash: 'fiesta_chilena_2026_bloque_04', pases_apoderados: 2, pases_invitados: 2},
        '1B': {id: '1B', jornada: 'manana', bloque: 'bloque_04', color: 'roj_m', hash: 'fiesta_chilena_2026_bloque_04', pases_apoderados: 2, pases_invitados: 2},
        '2A': {id: '2A', jornada: 'manana', bloque: 'bloque_04', color: 'roj_m', hash: 'fiesta_chilena_2026_bloque_04', pases_apoderados: 2, pases_invitados: 2},
        '2B': {id: '2B', jornada: 'manana', bloque: 'bloque_04', color: 'roj_m', hash: 'fiesta_chilena_2026_bloque_04', pases_apoderados: 2, pases_invitados: 2},
        '1MB': {id: '1MB', jornada: 'tarde', bloque: 'bloque_05', color: 'azu_t', hash: 'fiesta_chilena_2026_bloque_05', pases_apoderados: 2, pases_invitados: 2},
        '2MB': {id: '2MB', jornada: 'tarde', bloque: 'bloque_05', color: 'azu_t', hash: 'fiesta_chilena_2026_bloque_05', pases_apoderados: 2, pases_invitados: 2},
        '3MB': {id: '3MB', jornada: 'tarde', bloque: 'bloque_05', color: 'azu_t', hash: 'fiesta_chilena_2026_bloque_05', pases_apoderados: 2, pases_invitados: 2},
        'HA': {id: 'HA', jornada: 'tarde', bloque: 'bloque_05', color: 'azu_t', hash: 'fiesta_chilena_2026_bloque_05', pases_apoderados: 0, pases_invitados: 0},
        '7A': {id: '7A', jornada: 'tarde', bloque: 'bloque_06', color: 'nar_t', hash: 'fiesta_chilena_2026_bloque_06', pases_apoderados: 2, pases_invitados: 2},
        '7B': {id: '7B', jornada: 'tarde', bloque: 'bloque_06', color: 'nar_t', hash: 'fiesta_chilena_2026_bloque_06', pases_apoderados: 2, pases_invitados: 2},
        '8A': {id: '8A', jornada: 'tarde', bloque: 'bloque_06', color: 'nar_t', hash: 'fiesta_chilena_2026_bloque_06', pases_apoderados: 2, pases_invitados: 2},
        '8B': {id: '8B', jornada: 'tarde', bloque: 'bloque_06', color: 'nar_t', hash: 'fiesta_chilena_2026_bloque_06', pases_apoderados: 2, pases_invitados: 2},
        '5A': {id: '5A', jornada: 'tarde', bloque: 'bloque_07', color: 'ama_t', hash: 'fiesta_chilena_2026_bloque_07', pases_apoderados: 2, pases_invitados: 2},
        '5B': {id: '5B', jornada: 'tarde', bloque: 'bloque_07', color: 'ama_t', hash: 'fiesta_chilena_2026_bloque_07', pases_apoderados: 2, pases_invitados: 2},
        '6A': {id: '6A', jornada: 'tarde', bloque: 'bloque_07', color: 'ama_t', hash: 'fiesta_chilena_2026_bloque_07', pases_apoderados: 2, pases_invitados: 2},
        '6B': {id: '6B', jornada: 'tarde', bloque: 'bloque_07', color: 'ama_t', hash: 'fiesta_chilena_2026_bloque_07', pases_apoderados: 2, pases_invitados: 2},
        '4MA': {id: '4MA', jornada: 'tarde', bloque: 'bloque_08', color: 'ros_t', hash: 'fiesta_chilena_2026_bloque_08', pases_apoderados: 2, pases_invitados: 3},
        '4MB': {id: '4MB', jornada: 'tarde', bloque: 'bloque_08', color: 'ama_t', hash: 'fiesta_chilena_2026_bloque_08', pases_apoderados: 2, pases_invitados: 3}
      }
    },
    'bloque_huilen_2026': {
      nombre: 'Bloque Conjunto Folclorico Huilen Fiesta a la Chilena 2026',
      fecha: '2026-09-05',
      hora_inicio: '12:00',
      hora_termino: '13:00',
      hora_apertura_puertas: '08:15',
      descripcion: 'Evento de celebración cultural',
      imagen_ticket_path: `./img/ticket_huilen_2026.png`,
      layout_tickets: {
        'ticket_fiesta_chilena_v2_2026.png':
        [
          { id: 'font', value: 'PottiSreeramulu'},
          { id: 'familia', label: 'Familia: ', text: '$familia', x: 15, y: 415, fontSize: 30 },
          { id: 'nombre_completo', label: '', text: '$nombre_completo', x: 15, y: 448, fontSize: 30, maxPxWidth: 480, textAdjusted: true },
          { id: 'bloques', label: 'Bloques: ', text: '$bloques', x: 15, y: 481, fontSize: 30 },
          { id: 'jornadaDisplay', label: 'Jornada: ', text: '$jornadaDisplay', x: 15, y: 514, fontSize: 30 },
          { id: 'tipo', label: '', text: '$tipo', x: '$canvas.width / 2 + 80 - 40', y: 690-30-70, fontSize: 40, fillStyle: 'black', textAlign: 'left' },
          { id: 'serial', label: 'Folio: ', text: '$serial', x: '$canvas.width / 2 + 80 - 40', y: 700-70, fontSize: 32 },
          { id: 'curso', label: 'Curso: ', text: '$curso', x: '$canvas.width / 2 + 80 - 40', y: 660, fontSize: 18 },
          { id: 'num_listado', label: 'Nro Lista: ', text: '$num_listado', x: '$canvas.width / 2 + 80 - 40', y: 690, fontSize: 18 },
          { id: 'qr', label: '', text: '$qrData', x: 45-40, y: 608-70, width: 215, type: 'qr' }
        ]
      },
      cursoBloqueMap: {
        'PKA': {id: 'PKA', jornada: 'manana', bloque: 'bloque_01', color: 'ama_m', hash: 'fiesta_chilena_2026_bloque_01', pases_apoderados: 2, pases_invitados: 2},
        'PKB': {id: 'PKB', jornada: 'manana', bloque: 'bloque_01', color: 'ama_m', hash: 'fiesta_chilena_2026_bloque_01', pases_apoderados: 2, pases_invitados: 2},
        'KA': {id: 'KA', jornada: 'manana', bloque: 'bloque_01', color: 'ama_m', hash: 'fiesta_chilena_2026_bloque_01', pases_apoderados: 2, pases_invitados: 2},
        'KB': {id: 'KB', jornada: 'manana', bloque: 'bloque_01', color: 'ama_m', hash: 'fiesta_chilena_2026_bloque_01', pases_apoderados: 2, pases_invitados: 2},
        '3A': {id: '3A', jornada: 'manana', bloque: 'bloque_02', color: 'ros_m', hash: 'fiesta_chilena_2026_bloque_02', pases_apoderados: 2, pases_invitados: 2},
        '3B': {id: '3B', jornada: 'manana', bloque: 'bloque_02', color: 'ros_m', hash: 'fiesta_chilena_2026_bloque_02', pases_apoderados: 2, pases_invitados: 2},
        '4A': {id: '4A', jornada: 'manana', bloque: 'bloque_02', color: 'ros_m', hash: 'fiesta_chilena_2026_bloque_02', pases_apoderados: 2, pases_invitados: 2},
        '4B': {id: '4B', jornada: 'manana', bloque: 'bloque_02', color: 'ros_m', hash: 'fiesta_chilena_2026_bloque_02', pases_apoderados: 2, pases_invitados: 2},
        '1MA': {id: '1MA', jornada: 'manana', bloque: 'bloque_03', color: 'ver_m', hash: 'fiesta_chilena_2026_bloque_03', pases_apoderados: 2, pases_invitados: 2},
        '2MA': {id: '2MA', jornada: 'manana', bloque: 'bloque_03', color: 'ver_m', hash: 'fiesta_chilena_2026_bloque_03', pases_apoderados: 2, pases_invitados: 2},
        '3MA': {id: '3MA', jornada: 'manana', bloque: 'bloque_03', color: 'ver_m', hash: 'fiesta_chilena_2026_bloque_03', pases_apoderados: 2, pases_invitados: 2},
        'HI': {id: 'HI', jornada: 'manana', bloque: 'bloque_03', color: 'ver_m', hash: 'fiesta_chilena_2026_bloque_03', pases_apoderados: 2, pases_invitados: 0},
        'HJ': {id: 'HJ', jornada: 'manana', bloque: 'bloque_03', color: 'ver_m', hash: 'fiesta_chilena_2026_bloque_03', pases_apoderados: 2, pases_invitados: 0},
        '1A': {id: '1A', jornada: 'manana', bloque: 'bloque_04', color: 'roj_m', hash: 'fiesta_chilena_2026_bloque_04', pases_apoderados: 2, pases_invitados: 2},
        '1B': {id: '1B', jornada: 'manana', bloque: 'bloque_04', color: 'roj_m', hash: 'fiesta_chilena_2026_bloque_04', pases_apoderados: 2, pases_invitados: 2},
        '2A': {id: '2A', jornada: 'manana', bloque: 'bloque_04', color: 'roj_m', hash: 'fiesta_chilena_2026_bloque_04', pases_apoderados: 2, pases_invitados: 2},
        '2B': {id: '2B', jornada: 'manana', bloque: 'bloque_04', color: 'roj_m', hash: 'fiesta_chilena_2026_bloque_04', pases_apoderados: 2, pases_invitados: 2},
        '1MB': {id: '1MB', jornada: 'tarde', bloque: 'bloque_05', color: 'azu_t', hash: 'fiesta_chilena_2026_bloque_05', pases_apoderados: 2, pases_invitados: 2},
        '2MB': {id: '2MB', jornada: 'tarde', bloque: 'bloque_05', color: 'azu_t', hash: 'fiesta_chilena_2026_bloque_05', pases_apoderados: 2, pases_invitados: 2},
        '3MB': {id: '3MB', jornada: 'tarde', bloque: 'bloque_05', color: 'azu_t', hash: 'fiesta_chilena_2026_bloque_05', pases_apoderados: 2, pases_invitados: 2},
        'HA': {id: 'HA', jornada: 'tarde', bloque: 'bloque_05', color: 'azu_t', hash: 'fiesta_chilena_2026_bloque_05', pases_apoderados: 0, pases_invitados: 0},
        '7A': {id: '7A', jornada: 'tarde', bloque: 'bloque_06', color: 'nar_t', hash: 'fiesta_chilena_2026_bloque_06', pases_apoderados: 2, pases_invitados: 2},
        '7B': {id: '7B', jornada: 'tarde', bloque: 'bloque_06', color: 'nar_t', hash: 'fiesta_chilena_2026_bloque_06', pases_apoderados: 2, pases_invitados: 2},
        '8A': {id: '8A', jornada: 'tarde', bloque: 'bloque_06', color: 'nar_t', hash: 'fiesta_chilena_2026_bloque_06', pases_apoderados: 2, pases_invitados: 2},
        '8B': {id: '8B', jornada: 'tarde', bloque: 'bloque_06', color: 'nar_t', hash: 'fiesta_chilena_2026_bloque_06', pases_apoderados: 2, pases_invitados: 2},
        '5A': {id: '5A', jornada: 'tarde', bloque: 'bloque_07', color: 'ama_t', hash: 'fiesta_chilena_2026_bloque_07', pases_apoderados: 2, pases_invitados: 2},
        '5B': {id: '5B', jornada: 'tarde', bloque: 'bloque_07', color: 'ama_t', hash: 'fiesta_chilena_2026_bloque_07', pases_apoderados: 2, pases_invitados: 2},
        '6A': {id: '6A', jornada: 'tarde', bloque: 'bloque_07', color: 'ama_t', hash: 'fiesta_chilena_2026_bloque_07', pases_apoderados: 2, pases_invitados: 2},
        '6B': {id: '6B', jornada: 'tarde', bloque: 'bloque_07', color: 'ama_t', hash: 'fiesta_chilena_2026_bloque_07', pases_apoderados: 2, pases_invitados: 2},
        '4MA': {id: '4MA', jornada: 'tarde', bloque: 'bloque_08', color: 'ros_t', hash: 'fiesta_chilena_2026_bloque_08', pases_apoderados: 2, pases_invitados: 3},
        '4MB': {id: '4MB', jornada: 'tarde', bloque: 'bloque_08', color: 'ama_t', hash: 'fiesta_chilena_2026_bloque_08', pases_apoderados: 2, pases_invitados: 3}
      }
    },
    'bingo_familiar_2026': {
      nombre: 'Bingo Familiar 2026',
      fecha: '2026-10-10',
      hora_inicio: '14:00',
      hora_termino: '20:00',
      hora_apertura_puertas: '13:30',
      descripcion: 'Evento solidario de recaudación de fondos',
      imagen_ticket_path: `./img/ticket_bingo_familiar_2026.png`,
      cursoBloqueMap: {}
    }
  }
  let test_result = 'pass';
  try {
    for (const [id_evento, eventoData] of Object.entries(eventos_map)) {
      //const id_evento = 'fiesta_chilena_2026';
      const result = await fetch(`${url_server}/api/eventos/buscar?id_evento=${id_evento}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      const eventos = await result.json();
      //console.log('Eventos encontrados:', eventos);
      if (result.status !== 200 || !eventos || eventos.length === 0) {
        console.log(`Evento ${id_evento}, creando evento ...`);
        const result_create = await fetch(`${url_server}/api/eventos/crear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
          body: JSON.stringify({
            id_evento,
            nombre: eventoData.nombre,
            fecha: eventoData.fecha,
            hora_inicio: eventoData.hora_inicio,
            hora_termino: eventoData.hora_termino,
            hora_apertura_puertas: eventoData.hora_apertura_puertas,
            descripcion: eventoData.descripcion,
            imagen_ticket_path: eventoData.imagen_ticket_path,
            cursoBloqueMap: eventoData.cursoBloqueMap
          })
        });
        if (result_create.status !== 200) {
          log_result(tag, 'can not create event');
          test_result = 'fail';
        }
      }
    }
    log_result(tag, test_result);
    if (test_result !== 'pass') {
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
  log_result(tag, 'pass');
}


/// Testear pre-generacion de entradas
async function test_api_pre_generate_entradas(url_server = 'http://localhost:5001') {
  const tag = 'test /api/pre_generate_entradas';
  try {
    const infoOrganizacion = await db_support.infoOrganizacionDB.findOne({id_organizacion: 'cpa_patrona'});
    const id_organizacion = infoOrganizacion.id_organizacion;
    const id_evento = 'fiesta_chilena_2026';

    // Borrando Entradas anteriores
    const drop_result = await fetch (`${url_server}/api/entradas?id_evento=${encodeURIComponent(id_evento)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
    });

    // Pre generar entradas
    const result = await fetch(`${url_server}/api/entradas/pre_generar?id_organizacion=${encodeURIComponent(id_organizacion)}&id_evento=${encodeURIComponent(id_evento)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
    });
    const entradas = await result.json();
    console.log('Entradas pre-generadas:', entradas);
  } catch (error) {
    console.error(`${tag} Error :`, error);
    log_result(tag, 'fail');
  }
}

async function test_api_entradas_familia(url_server = 'http://localhost:5001') {
  const tag = 'test /api/entradas/generar/familia';
  const estudiantes = [
    'avendano fuenzalida isidora ignacia',
    //'Gonzalez perez mateo ignacio'
    /*'mendiz pozo constantino panagiotis',
    'morales perez antonia margarita',
    'gutierrez zapata agustin antonio',
    'herrera messina florencia isidora',
    'madariaga jara martina esperanza',*/
    /*'lepin hugueno antonia sara',
    'montero arroyo isidora daniela',
    'alarcon salazar julieta ignacia'/*,
    'herrera gongora martina ignacia',
    'diaz rodriguez fernando jesus'*/
  ]
  try {
    const infoOrganizacion = await db_support.infoOrganizacionDB.findOne({id_organizacion: 'cpa_patrona'});
    const id_organizacion = 'cpa_patrona'; // infoOrganizacion.id_organizacion;
    const id_evento = 'fiesta_chilena_2026';
    //const nombre_completo = 'herrera messina florencia isidora';

    // Borrando Entradas anteriores
    /*const drop_result = await fetch (`${url_server}/api/entradas?id_evento=${encodeURIComponent(id_evento)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
    });*/

    const evento_result = await fetch(`${url_server}/api/eventos/buscar?id_evento=${encodeURIComponent(id_evento)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
    });
    //const infoJson = await evento_result.json();
    //const eventoInfo = infoJson[0];
    const eventoInfo = await evento_result.json();
    const curso_bloques = eventoInfo.cursoBloqueMap;
    //console.log(`[${tag}] eventoInfo: ${JSON.stringify({eventoInfo})}`);
    const imagen_ticket_path = eventoInfo.imagen_ticket_path;
    /*console.log(`[${tag}] POST /api/entradas/generar/familia: ${JSON.stringify({
        id_evento,
        nombre_completo,
        imagen_ticket_path
    })}`);*/
    for ( const nombre_completo of estudiantes) {
      const result = await fetch(`${url_server}/api/entradas/generar/familia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify({
          id_organizacion,
          id_evento,
          nombre_completo,
          imagen_ticket_path,
          curso_bloques,
          save_file: true
        })
      });
      const entradas = await result.json();
      console.log(`${tag} Entradas generadas para la familia:`, entradas);
    }
    log_result(tag, 'pass');
  } catch (error) {
    console.error(`${tag} Error :`, error);
    log_result(tag, 'fail');
  }
}


/// Testear perfiles
async function test_api_perfiles(url_server = 'http://localhost:5001') {
  const tag = 'test /api/perfiles';
  const perfiles_map = {
    'morales.italo@gmail.com': {
      email: 'morales.italo@gmail.com',
      rut: '15.775.593-5',
      nombre_completo: 'Italo Morales',
      rol: 'administrador'
    },
    'l.herreramena@gmail.com': {
      email: 'l.herreramena@gmail.com',
      rut: '12.485.285-4',
      nombre_completo: 'Leo Herrera',
      rol: 'administrador'
    }
  };
  let test_result = 'pass';
  try {
    // Iterar sobre los perfiles definidos en el mapa y verificar su existencia en la base de datos
    for (const [email, perfilData] of Object.entries(perfiles_map)) {
      //console.log(`${tag} Verificando perfil: ${email}`);
      const result = await fetch(`${url_server}/api/perfiles?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      const perfil = await result.json();
      if (!perfil || perfil.email !== perfilData.email || perfil.rut !== perfilData.rut || perfil.nombre_completo !== perfilData.nombre_completo || perfil.rol !== perfilData.rol) {
        //console.log(`Perfil ${email} no encontrado o datos incorrectos. Creando perfil...`);
        test_result = 'fail';
        if (!perfil) {
          console.log(`${tag} Perfil ${email} no encontrado. Creando perfil...`);
          const createResult = await fetch(`${url_server}/api/perfiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
            body: JSON.stringify(perfilData)
          });
          if (createResult.status !== 201) {
            console.log(`${tag} fail creating profile ${email}`);
          }
        } else {
          console.log(`${tag} Perfil ${email} encontrado pero con datos incorrectos. Creando perfil...`);
        }
      }
    }
    log_result(tag, test_result);
  } catch (error) {
    console.error(`${tag} Error :`, error);
    log_result(tag, 'fail');
  }
}

async function test_api_crear_perfiles(url_server = 'http://localhost:5001') {
  const tag = 'test POST /api/perfiles';
  const perfiles_map = {
    /*'morales.italo@gmail.com': {
      email: 'morales.italo@gmail.com',
      rut: '15.775.593-5',
      nombre_completo: 'Italo Morales',
      rol: 'administrador'
    },*/
    'leo.herrera.mena@gmail.com': {
      email: 'leo.herrera.mena@gmail.com',
      rut: '12.485.285-4',
      nombre_completo: 'Leo Herrera',
      rol: 'administrador'
    }
  };

  let test_result = 'pass';
  try {
    // Iterar sobre los perfiles definidos en el mapa y verificar su existencia en la base de datos
    for (const [email, perfilData] of Object.entries(perfiles_map)) {
      //console.log(`${tag} Verificando perfil: ${email}`);
      const result = await fetch(`${url_server}/api/perfiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify(perfilData)
      });
      const perfil = await result.json();
      if (!perfil || perfil.email !== perfilData.email || perfil.rut !== perfilData.rut || perfil.nombre_completo !== perfilData.nombre_completo || perfil.rol !== perfilData.rol) {
        //console.log(`Perfil ${email} no encontrado o datos incorrectos. Creando perfil...`);
        test_result = 'fail';
      }
    }
    log_result(tag, test_result);
  } catch (error) {
    console.error(`${tag} Error :`, error);
    log_result(tag, 'fail');
  }
}

async function test_api_eliminar_perfiles(url_server = 'http://localhost:5001') {
  const tag = 'test DELETE /api/perfiles';
  const user_email = 'l.herreramena@gmail.com';
  const perfiles_map = {
    /*'morales.italo@gmail.com': {
      email: 'morales.italo@gmail.com',
      rut: '15.775.593-5',
      nombre_completo: 'Italo Morales',
      rol: 'administrador'
    },*/
    'leo.herrera.mena@gmail.com': {
      email: 'leo.herrera.mena@gmail.com',
      rut: '12.485.285-4',
      nombre_completo: 'Leo Herrera',
      rol: 'administrador'
    }
  };

  let test_result = 'pass';
  try {
    // Iterar sobre los perfiles definidos en el mapa y verificar su existencia en la base de datos
    for (const [email, perfilData] of Object.entries(perfiles_map)) {
      //console.log(`${tag} Verificando perfil: ${email}`);
      const result = await fetch(`${url_server}/api/perfiles?email=${encodeURIComponent(user_email)}&email=${encodeURIComponent(user_email)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify(perfilData)
      });
      const deleteResult = await result.json();
      if (result.status !== 200) {
        //console.log(`Perfil ${email} no encontrado o datos incorrectos. Creando perfil...`);
        test_result = 'fail';
      }
      console.log(`${tag} `, deleteResult);
    }
    log_result(tag, test_result);
  } catch (error) {
    console.error(`${tag} Error :`, error);
    log_result(tag, 'fail');
  }
}


async function test_send_entradas(url_server = 'http://localhost:5001') {
  const tag = '[test_send_entradas]';
  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';
  //const email_destinatario = 'l.herreramena@gmail.com';
  const asuntoCorreo = ' prueba de envio de entradas por correo';
  //const tipo_attachment = 'png';
  const tipo_attachment = 'pdf';

  //const mensajeCorreo = 'chupalo!';
  let testResult = 'pass';

  const familias = [
    //'mendiz pozo',
    //'gutierrez zapata',
    //'madariaga jara' : '',
    /*'lepin hugueno antonia sara',
    'montero arroyo isidora daniela',*/
    /*'herrera gongora martina ignacia',
    'diaz rodriguez fernando jesus'*/
    //'morales perez' ,
    //'alarcon salazar',
    //'herrera messina'
    'madariaga jara',
  ]

  const destinatarios = {
    'morales perez' : { email_destinatario: 'morales.italo@gmail.com', mensajeCorreo: 'Entrada Familia de Italo!'},
    'herrera messina': { email_destinatario: 'leo.herrera.mena@gmail.com', mensajeCorreo: 'Test Entrada!'},
    'avendano fuenzalida': { email_destinatario: 'leo.herrera.mena', mensajeCorreo: 'Test Entrada!'},
    'alarcon salazar': { email_destinatario: 'patricio.alarcon.matus@gmail.com', mensajeCorreo: 'Entrada Familia de Pato!'}
  }

  await Promise.all(
    familias.map( async (familia) => {
      try {
        const tickets_res = await fetch(`${url_server}/api/entrada/familia?id_organizacion=${encodeURIComponent(id_organizacion)}&id_evento=${encodeURIComponent(id_evento)}&familia=${encodeURIComponent(familia)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
        });
        if (tickets_res.status === 200) {
          //console.log(`${tag} tikets familia ${familia}: `, tickets_res);
          const tickets = await tickets_res.json();
          //console.log(`${tag} tickets familia ${familia}: `, tickets.length);

          const { mensajeCorreo, email_destinatario} = destinatarios[familia];
          const resp = await fetch(`${url_server}/api/entradas/send_email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
            body: JSON.stringify({ email_destinatario, asuntoCorreo, mensajeCorreo, tickets, save_file: true, tipo_attachment })
          });
          if (resp.status !== 200) {
            console.log(`${tag} Envio tickets a familia ${familia} fallo. status`, resp.status);
            testResult = 'fail';
          }
        } else {
          console.log(`${tag} No se pudo obtener los tickets de la familia ${familia} desde el endpoint ${url_server}/api/entrada/familia. status: `, tickets_res.status);
          testResult = 'fail';
        }
      } catch (err) {
        console.log(`${tag} Error during processing tickets for ${familia} family`, err);
        testResult = 'fail';
      }
    })
  );
  log_result(tag, testResult);
}

async function test_qr_entradas(url_server = 'http://localhost:5001') {

  const tag = '[test_qr_entradas]';
  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';
  const folios = [2785, 2786, 2787, 2788, 2789, 2790];

  let test_result = 'pass';
  try {
    await Promise.all(
      folios.map( async (folio) => {

        const result = await fetch(`${url_server}/api/entrada/qr/imagen?id_organizacion=${encodeURIComponent(id_organizacion)}&id_evento=${encodeURIComponent(id_evento)}&folio=${encodeURIComponent(folio)}&save_file=${encodeURIComponent(true)}&`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
        });
        if ( result.status !== 200 )
        {
          test_result = 'fail';
        }
      }
    ))
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
  log_result(tag, test_result);
}

async function test_actualizar_correos_padres_de_cada_estudiante(url_server = 'http://localhost:5001') {
  const tag = '[test_actualizar_correos_padres_de_cada_estudiante]';
  try {
    const result = await fetch(`${url_server}/api/update/nombrehermanos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
    });
    if ( result.status === 200 )
    {
      log_result(tag, 'pass');
    } else {
      log_result(tag, 'fail');
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
}

async function test_consultar_hijos(url_server = 'http://localhost:5001') {
  const tag = '[test /api/consulta/hijos]';
  const email_apoderados = [
    'morales.italo@gmail.com',
    'patricio.alarcon.matus@gmail.com',
    'l.herreramena@gmail.com',
    'leo.herrera.mena@gmail.com'
  ]
  for (const user_email of email_apoderados) {
    try {
      const result = await fetch(`${url_server}/api/consulta/hijos?user_email=${encodeURIComponent(user_email)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      if ( result.status === 200 )
      {
        log_result(tag, 'pass');
      } else {
        log_result(tag, 'fail');
      }
    } catch (error) {
      console.log(`${tag} Unexpected error: `, error);
      log_result(tag, 'fail');
    }
  }
}


// /api/consulta/apoderados
async function test_consultar_apoderados(url_server = 'http://localhost:5001') {
  const tag = '[test /api/consulta/apoderados]';
  const array_of_hijos = [
    {hijos:[
    'herrera messina florencia isidora',
    'herrera messina cristobal nicolas',
    ],
    apoderados: 1
    }
  ];
  for (const info of array_of_hijos) {
    try {
      const result = await fetch(`${url_server}/api/consulta/apoderados?hijos=${encodeURIComponent(JSON.stringify(info.hijos))}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      if ( result.status === 200 )
      {
        res_apoderados = await result.json();
        if (res_apoderados.length === info.apoderados) {
          log_result(tag, 'pass');
        } else {
          console.log(`${tag} apoderados ${JSON.stringify(info.hijos)}: expected: ${info.apoderados}, obteined: ${res_apoderados.length}: `);
          log_result(tag, 'fail');
        }
      } else {
        log_result(tag, 'fail');
      }
    } catch (error) {
      console.log(`${tag} Unexpected error: `, error);
      log_result(tag, 'fail');
    }
  }
}

async function test_consistencia_users_hijos(url_server = 'http://localhost:5001') {
  const tag = '[test /api/update/consistencia]';
  try {
    const result = await fetch(`${url_server}/api/update/consistencia`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
    });
    if ( result.status === 200 )
    {
      log_result(tag, 'pass');
    } else {
      log_result(tag, 'fail');
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
}


async function test_delete_user(url_server = 'http://localhost:5001') {
  const tag = '[test DEL /api/update/user]';
  const user_email = 'l.herreramena@gmail.com';

  try {
    const result = await fetch(`${url_server}/api/update/user?user_email=${encodeURIComponent(user_email)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
    });
    if ( result.status === 200 )
    {
      log_result(tag, 'pass');
    } else {
      log_result(tag, 'fail');
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
}


async function test_consulta_hijos_registrados(url_server = 'http://localhost:5001') {
  const tag = '[test GET /api/consulta/hijos_registrados]';
  ////////////////const user_email = 'l.herreramena@gmail.com';

  try {
    const result = await fetch(`${url_server}/api/consulta/hijos_registrados?output=${encodeURIComponent('listado')}`, {
    //const result = await fetch(`${url_server}/api/consulta/hijos_registrados`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
    });
    if ( result.status === 200 )
    {
      const hijos_registrados = await result.json();
      //console.log(`${tag} hijos_registrados: `, Object.keys(hijos_registrados).length);
      console.log(`${tag} hijos_registrados: `, hijos_registrados);
      log_result(tag, 'pass');
    } else {
      log_result(tag, 'fail');
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
}


async function test_activar_entradas(url_server = 'http://localhost:5001') {
  const tag = '[test POST /api/entrada/activar]';

  const email_apoderados = [
    /*'morales.italo@gmail.com',
    'patricio.alarcon.matus@gmail.com',
    'l.herreramena@gmail.com',*/
    {user_email: 'l.herreramena@gmail.com', familia: 'alarcon salazar'},
    {user_email: 'l.herreramena@gmail.com', familia: 'herrera messina'}
  ]

  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';

  email_apoderados.forEach( async ({user_email, familia}) => {
    try {
      const result = await fetch(`${url_server}/api/entrada/activar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify({id_organizacion, id_evento, user_email, familia})
      });
      const resultados = await result.json();
      if ( result.status === 200 )
      {
        //console.log(`${tag} hijos_registrados: `, Object.keys(hijos_registrados).length);
        console.log(`${tag} `, resultados);
        log_result(tag, 'pass');
      } else {
        console.log(`${tag} status: ${result.status}, `, resultados);
        log_result(tag, 'fail');
      }
    } catch (error) {
      console.log(`${tag} Unexpected error: `, error);
      log_result(tag, 'fail');
      return;
    }
  })
}

async function test_anular_entradas(url_server = 'http://localhost:5001') {
  const tag = '[test POST /api/entrada/anular]';

  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';
  const user_email = 'l.herreramena@gmail.com';
  const familias = [
    "aldea vargas"
  ];

  familias.forEach( async familia => {
    try {
      const result = await fetch(`${url_server}/api/entrada/desactivar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify({id_organizacion, id_evento, familia, user_email, estado: 'anulada'})
      });
      const resultados = await result.json();
      if ( result.status === 200 )
      {
        //console.log(`${tag} hijos_registrados: `, Object.keys(hijos_registrados).length);
        console.log(`${tag} `, resultados);
        log_result(tag, 'pass');
      } else {
        console.log(`${tag} status: ${result.status}, `, resultados);
        log_result(tag, 'fail');
      }
    } catch (error) {
      console.log(`${tag} Unexpected error: `, error);
      log_result(tag, 'fail');
      return;
    }
  })
}

async function test_desactivar_entradas(url_server = 'http://localhost:5001') {
  const tag = '[test POST /api/entrada/desactivar]';

  const email_apoderados = [
    /*'morales.italo@gmail.com',
    'patricio.alarcon.matus@gmail.com',*/
    //'leo.herrera.mena@gmail.com'
    'l.herreramena@gmail.com'
  ]

  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';
  const user_email = 'l.herreramena@gmail.com';
  const familias = [
    "herrera messina"
  ];

  familias.forEach( async familia => {
    try {
      const result = await fetch(`${url_server}/api/entrada/desactivar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify({id_organizacion, id_evento, familia, user_email})
      });
      const resultados = await result.json();
      if ( result.status === 200 )
      {
        //console.log(`${tag} hijos_registrados: `, Object.keys(hijos_registrados).length);
        console.log(`${tag} `, resultados);
        log_result(tag, 'pass');
      } else {
        console.log(`${tag} status: ${result.status}, `, resultados);
        log_result(tag, 'fail');
      }
    } catch (error) {
      console.log(`${tag} Unexpected error: `, error);
      log_result(tag, 'fail');
      return;
    }
  })
}

async function test_api_historial_ticket(url_server = 'http://localhost:5001') {
  const tag = '[test GET /api/entrada/historial]';
  const user_email = 'l.herreramena@gmail.com';
  const folios = [2786, 2788];
  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';
  
  folios.forEach( async folio => {
    try {
      console.log(`${tag} url_server: `, url_server);
      const result = await fetch(`${url_server}/api/entrada/historial?id_organizacion=${encodeURIComponent(id_organizacion)}&id_evento=${encodeURIComponent(id_evento)}&folio=${encodeURIComponent(folio)}&user_email=${encodeURIComponent(user_email)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      let resultados = null;
      if ( result.status === 200 )
      {
         resultados = await result.json();
        //console.log(`${tag} hijos_registrados: `, Object.keys(hijos_registrados).length);
        console.log(`${tag} historial.length: `, resultados.historial.length);
        log_result(tag, 'pass');
      } else {
        if (result.status === 400) resultados = await result.json();
        console.log(`${tag} status: ${result.status}, `, resultados);
        log_result(tag, 'fail');
      }
    } catch (error) {
      console.log(`${tag} Unexpected error: `, error);
      log_result(tag, 'fail');
      return;
    }
  });
}


async function test_get_api_correos_tipo(url_server = 'http://localhost:5001') {
  const tag = '[test GET /api/correo_tipo]';
  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';

  try {
    const result = await fetch(`${url_server}/api/correo_tipo?id_organizacion=${encodeURIComponent(id_organizacion)}&id_evento=${encodeURIComponent(id_evento)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
    });
    if ( result.status === 200 )
    {
      const correo_tipo = await result.json();
      console.log(`${tag} correo_tipo: `, correo_tipo);
      log_result(tag, 'pass');
    } else {
      console.log(`${tag} status: ${result.status}`);
      log_result(tag, 'fail');
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
}

async function test_post_api_correos_tipo(url_server = 'http://localhost:5001') {
  const tag = '[test POST /api/correo_tipo]';
  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';
  const asuntoCorreo = 'Entradas Fiesta a la Chilena 2026 - Centro de Padres';
  const mensajeCorreo = [
    'Estimado(a) apoderado(a),',
    'Adjunto encontrará las entradas para el evento Fiesta a la Chilena 2026.',
    'Por favor, asegúrese de revisar los detalles del evento y presentar estas entradas al momento de ingresar.',
    '¡Esperamos que disfrute de este maravilloso evento familiar!',
    'Saludos cordiales,',
    'Centro General de Padres y Apoderados - Colegio Patrona de La Florida'
  ];
  const tipo_attachment = 'pdf';
 
  try {
    const result = await fetch(`${url_server}/api/correo_tipo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
      body: JSON.stringify({ id_organizacion, id_evento, asuntoCorreo, mensajeCorreo, tipo_attachment })
    });
    const resultados = await result.json();
    if ( result.status === 201 )
    {
      console.log(`${tag} `, resultados);
      log_result(tag, 'pass');
    } else {
      console.log(`${tag} status: ${result.status}, `, resultados);
      log_result(tag, 'fail');
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
}


async function test_get_api_pagos(url_server = 'http://localhost:5001') {
    const tag = '[testGetPagos]';
    const cursos_under_test = [
        { curso: '4m', seccion: 'A' },
        { curso: '4m', seccion: 'B' }
      ];

    for (const { curso, seccion } of cursos_under_test) {
        await fetchPagos(curso, seccion, url_server);
    }
}

async function fetchPagos(curso, seccion, url_server = 'http://localhost:5001') {
    const tag = `[fetchPagos] Curso: ${curso}, Sección: ${seccion}`;
    try {
        const response = await fetch(`${url_server}/api/pagos/${curso}/${seccion}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SECRET_API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Error en la solicitud: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`${tag} Pagos obtenidos:`, data);
    } catch (error) {
        console.error(`${tag} Error al obtener los pagos:`, error);
    }
}


async function test_api_delete_apoderado_email(url_server = 'http://localhost:5001') {
  const tag = '[test DELETE /api/apoderado/email]';
  const user_emails = [
    'leo.herrera.mena.fotos.2020@gmail.com'
  ];
  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';
  
  try {
    for (const email_apoderado of user_emails) {

      /*const result_desactivar_entradas = await fetch(`${url_server}/api/entrada/desactivar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify({id_organizacion, id_evento, user_email: email_apoderado})
      });
      const resultados_entradas = await result_desactivar_entradas.json();
      if ( result_desactivar_entradas.status === 200 )
      {
        console.log(`${tag} `, resultados_entradas);
      } else {
        console.log(`${tag} status: ${result_desactivar_entradas.status}, `, resultados_entradas);
      }*/

      const result = await fetch(`${url_server}/api/update/user/apoderado_email?user_email=${encodeURIComponent(email_apoderado)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      const resultados = await result.json();
      if ( result.status === 200 )
      {
        console.log(`${tag} `, resultados);
        log_result(tag, 'pass');
      } else {
        console.log(`${tag} status: ${result.status}, `, resultados);
        log_result(tag, 'fail');
      }
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
}


async function test_get_max_invitados(url_server = 'http://localhost:5001') {
  const tag = '[test GET /api/eventos/max_invitados]';
  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';
  const cursos_under_test = [['4MA', '6B'], ['6A', '6B'], ['PKA', '4MB'], ['1MA', '6A', '4B']];

  try {
    for (const cursos of cursos_under_test) {
      const result = await fetch(`${url_server}/api/eventos/max_invitados?id_organizacion=${encodeURIComponent(id_organizacion)}&id_evento=${encodeURIComponent(id_evento)}&cursos=${encodeURIComponent(JSON.stringify(cursos))}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      if ( result.status === 200 )
      {
        const max_invitados = await result.json();
        console.log(`${tag} cursos: ${JSON.stringify(cursos)}, max_invitados: `, max_invitados);
        log_result(tag, 'pass');
      } else {
        const message = await result.json()
        console.log(`${tag} status: ${result.status}, message: `, message);
        log_result(tag, 'fail');
      }
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
}


async function test_add_pase_rule(url_server = 'http://localhost:5001') {
  const tag = '[test POST /api/eventos/pase_rule]';
  const rules = [
    {
      "id_rule": "pago_cuota_social",
      "compromiso_name": "cuota_cpa",
      "pases_por_compromiso": -1,
      "compromisos_maximo": 1,
      "compromiso_maximo_alcanzado": 'liberar_maximo_de_pases',
    },
    {
      "id_rule": "pago_invitados_adicionales",
      "compromiso_name": "invitaciones_fiesta_chilena",
      "pases_por_compromiso": 1,
      "compromisos_maximo": 3,
      "compromiso_maximo_alcanzado": 'liberar_maximo_de_pases',
    }
  ];

  try {
    for (const pase_rule of rules) {
      const result = await fetch(`${url_server}/api/eventos/pase_rule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
        body: JSON.stringify( pase_rule )
      });
      if ( result.status === 200 )
      {
        const response = await result.json();
        console.log(`${tag} pase_rule added: `, response);
        log_result(tag, 'pass');
      } else {
        const message = await result.json()
        console.log(`${tag} status: ${result.status}, message: `, message);
        log_result(tag, 'fail');
      }
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
}


async function test_get_estado_pago_entradas(url_server = 'http://localhost:5001') {
  const tag = '[test GET /api/evento/estado_de_pago]';
  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';

  const emails = [
    'l.herreramena@gmail.com',
    'leo.herrera.mena.fotos.2020@gmail.com',
    'leo.herrera.mena@gmail.com'
  ];

  try {
    for (const user_email of emails) {
      const result = await fetch(`${url_server}/api/evento/estado_de_pago?id_organizacion=${encodeURIComponent(id_organizacion)}&id_evento=${encodeURIComponent(id_evento)}&user_email=${encodeURIComponent(user_email)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      if ( result.status === 200 )
      {
        const pago_entradas = await result.json();
        console.log(`${tag} pago_entradas: `, pago_entradas);
        log_result(tag, 'pass');
      } else {
        const message = await result.json()
        console.log(`${tag} status: ${result.status}, message: `, message);
        log_result(tag, 'fail');
      }
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
}


async function test_enviar_correos_de_prueba(url_server = 'http://localhost:5001') {
  const tag = '[test POST /api/enviarCorreo]';
  const filename = 'respuestas_consultas_2026_08_26_v2';
  const file_correos = path.resolve(__dirname,`../tests/respuestas_consultas/${filename}.json`);
  const file_leidos = path.resolve(__dirname, '../tests/respuestas_consultas/archivos_leidos.json');
  try {
    let archivos_leidos = [];
    try {
      const data_leidos = await fs.readFile(file_leidos, 'utf-8');
      archivos_leidos = JSON.parse(data_leidos);
    } catch (err) {
      // Si el archivo no existe o está vacío, iniciamos con un array vacío
      archivos_leidos = [];
    }

    if (archivos_leidos.includes(file_correos)) {
      console.log(`${tag} El archivo "${path.basename(file_correos)}" ya fue procesado anteriormente. Omitiendo envío.`);
      log_result(tag, 'pass');
      return;
    }

    archivos_leidos.push(file_correos);
    await fs.writeFile(file_leidos, JSON.stringify(archivos_leidos, null, 2), 'utf-8');

    const data_file = await fs.readFile(file_correos, 'utf-8');
    const correosData = JSON.parse(data_file);

    const email_key = "Dirección de correo electrónico";
    const timestamp_key = "Marca temporal";
    const nombre_key = "Nombre";
    const consulta_key = "Coméntanos cual es tu problema";
    const respuesta_key = "Respuesta";

    const correo_verificacion = 'l.herreramena@gmail.com';

    for (const correoData of correosData) {
      const correo_destinatario = correoData[email_key];
      const nombre_destinatario = correoData[nombre_key];
      const timestamp = correoData[timestamp_key];
      const consulta = correoData[consulta_key];
      const respuesta = correoData[respuesta_key];

      console.log(`${tag} Enviando correo a: ${correo_destinatario}, Respuesta: ${respuesta}`);

      const asunto = `Respuesta a tu consulta`;

      /*const mensaje_array = [`Hola ${nombre_destinatario}. Hemos recibido la siguiente consulta de parte tuya:`,
                      `Tu consulta: ${consulta}`,
                      '',
                      `Nuestra respuesta: ${respuesta}`,
                      `Atentamente,`,
                      `El equipo de soporte.`];*/
      //const mensaje = mensaje_array.join('\n\n');

      const mensaje = `
                        <p>Hola ${nombre_destinatario}.</p>
                        <p>Hemos recibido la siguiente consulta de parte tuya:</p>
                        <p><strong>Tu consulta:</strong> ${consulta}</p>
                        <p><strong>Nuestra respuesta:</strong> ${respuesta}</p>
                        <p>Atentamente,<br>El equipo de soporte.</p>
                      `;
      const email_dests = [correo_destinatario, correo_verificacion];  //  , 
      for ( const correo of email_dests) {

        const result = await fetch(`${url_server}/api/enviarCorreo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
          body: JSON.stringify({correo, asunto, mensaje})
        });
        if (result.status === 200) {
          const response = await result.json();
          console.log(`${tag} correo enviado: `, response);
          log_result(tag, 'pass');
        } else {
          const message = await result.json();
          console.log(`${tag} status: ${result.status}, message: `, message);
          log_result(tag, 'fail');
        }
      }
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    log_result(tag, 'fail');
  }
}

async function test_api_borrar_entradas(url_server = 'http://localhost:5001') {
  const tag = '[test DELETE /api/entrada/borrar]';
  const id_organizacion = 'cpa_patrona';
  const id_evento = 'fiesta_chilena_2026';
  const folios = [2785, 2786, 2787, 2788, 2789, 2790];

  // Borrando Entradas anteriores
  const drop_result = await fetch (`${url_server}/api/entradas?id_evento=${encodeURIComponent(id_evento)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
  });

  let test_result = 'pass';
  try {
    for (const folio of folios) {
      const result = await fetch(`${url_server}/api/entrada/borrar?id_organizacion=${encodeURIComponent(id_organizacion)}&id_evento=${encodeURIComponent(id_evento)}&folio=${encodeURIComponent(folio)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      if (result.status !== 200) {
        console.log(`${tag} Error al borrar la entrada con folio ${folio}. Status: ${result.status}`);
        test_result = 'fail';
      } else {
        const response = await result.json();
        console.log(`${tag} Entrada con folio ${folio} borrada exitosamente: `, response);
      }
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
    test_result = 'fail';
  }
}


async function test_api_consulta_listas_curso(url_server = 'http://localhost:5001') {
  const tag = '[test GET /api/consulta/listas_curso]';
  const cursos_under_test = [
    { curso: '4M', seccion: 'A' },
    { curso: 'PK', seccion: 'B' }
  ];
  const id_organizacion = 'cpa_patrona';
  const cpaPagado = false; // Cambia esto según tus necesidades
  const hermanos = false; // Cambia esto según tus necesidades

  for (const { curso, seccion } of cursos_under_test) {
      const query = new URLSearchParams({
      id_organizacion: id_organizacion,
      curso: curso + seccion,
      cpa_pagado: cpaPagado,
      hermanos: hermanos
    });

    try {
      const res = await fetch(`${url_server}/api/consulta/listas_curso?${query.toString()}`);
      if (res.ok) {
        const estudiantesCache = (await res.json()).alumnos || [];
        console.log(`${tag} Estudiantes obtenidos:`, estudiantesCache);
      } else {
        console.log(`${tag} Error al consultar listas de curso. Status: ${res.status}`);
      }
    } catch (err) {
      console.error(`${tag} Error al consultar listas por curso:`, err);
    }
  }
}


async function test_api_branch(url_server = 'http://localhost:5001') {
  const tag = '[test GET /api/branch]';
  try {
    const consultas = ['branch/produccion', 'branch/current', 'consulta/database/name'];
    for (const consulta of consultas) {
      const result = await fetch(`${url_server}/api/${consulta}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      if ( result.status === 200 ) {
        const response = await result.json();
        console.log(`${tag} Nombre Branch de ${consulta}: `, response);
      } else {
        console.log(`${tag} Error al consultar branch. Status: ${result.status}`);
      }
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
  }
}


async function test_api_consulta_estudiantes_relacion(url_server = 'http://localhost:5001') {
  const tag = '[test GET /api/consulta/estudiantes/relacion]';
  const id_organizacion = 'cpa_patrona';
  const estudiantes_under_test = [
    ['herrera messina florencia isidora', 'herrera messina cristobal nicolas'],
    ['vargas silva maximiliano alonso', 'arenas silva mateo sebastian'],
  ];
  try {
    for (const estudiantes of estudiantes_under_test) {
      const query = new URLSearchParams({
        id_organizacion: id_organizacion,
        estudiantes: JSON.stringify(estudiantes)
      });
      const result = await fetch(`${url_server}/api/consulta/estudiantes/relacion?${query.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      if ( result.status === 200 ) {
        const response = await result.json();
        console.log(`${tag} Relación de estudiantes ${JSON.stringify(estudiantes)}: `, response);
      } else {
        const error_msg = await result.json();
        console.log(`${tag} Error al consultar relación de estudiantes. Status: ${result.status}, Error: ${JSON.stringify(error_msg)}`);
      }
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
  }
}

async function test_api_consulta_estudiantes_subpertenencia(url_server = 'http://localhost:5001') {
  const tag = '[test GET /api/consulta/estudiantes/subpertenencia]';
  const id_organizacion = 'cpa_patrona';
  const estudiantes_under_test = [
    ['herrera messina florencia isidora', 'herrera messina cristobal nicolas'],
    ['vargas silva maximiliano alonso', 'arenas silva mateo sebastian'],
  ];
  try {
    for (const estudiantes of estudiantes_under_test) {
      const query = new URLSearchParams({
        id_organizacion: id_organizacion,
        estudiantes: JSON.stringify(estudiantes)
      });
      const result = await fetch(`${url_server}/api/consulta/estudiantes/subpertenencia?${query.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY }
      });
      if ( result.status === 200 ) {
        const response = await result.json();
        console.log(`${tag} Subpertenencia de estudiantes ${JSON.stringify(estudiantes)}: `, response);
      } else {
        const error_msg = await result.json();
        console.log(`${tag} Error al consultar subpertenencia de estudiantes. Status: ${result.status}, Error: ${JSON.stringify(error_msg)}`);
      }
    }
  } catch (error) {
    console.log(`${tag} Unexpected error: `, error);
  }
}

module.exports.lauch_test_api = lauch_test_api;
