const db_support = require('../backend/db_support');
const config_env = require('../src/setup/config/env.js');

const SECRET_API_KEY = config_env.API_KEY;

const test_result_array = {};

class TestResult {
  static PASS = 'pass';
  static FAIL = 'fail';
}

async function lauch_test_api(delay_ms = 500, url_server = 'http://localhost:5001', db_uri = '') {
  console.log('Launching Api Test...');
    setTimeout(test_api_db_connection, delay_ms/2, db_uri);
    setTimeout(test_api_perfiles, delay_ms, url_server);
    setTimeout(test_api_curso, delay_ms, url_server);
    setTimeout(test_api_email_update, delay_ms, url_server);
    setTimeout(test_api_pagos_cpa, delay_ms, url_server);
    setTimeout(test_api_compromisos_pago, delay_ms, url_server);
    ////setTimeout(actualizarTiposDePago, delay_ms);
    setTimeout(listing_all_tipos_de_pago, delay_ms+1000, url_server);
    ////setTimeout(test_api_pago_compromiso, delay_ms);

    setTimeout(test_api_eventos, delay_ms+1500, url_server);
    
    ////setTimeout(test_api_pre_generate_entradas, delay_ms+2000, url_server);
    
    //setTimeout(test_api_entradas_familia, delay_ms+1000, url_server);
    //setTimeout(test_send_entradas, delay_ms, url_server);
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
      imagen_ticket_path: `./img/ticket_fiesta_chilena_2026.png`,
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
        '4MA': {id: '4MA', jornada: 'tarde', bloque: 'bloque_08', color: 'ros_t', hash: 'fiesta_chilena_2026_bloque_08', pases_apoderados: 2, pases_invitados: 6},
        '4MB': {id: '4MB', jornada: 'tarde', bloque: 'bloque_08', color: 'ama_t', hash: 'fiesta_chilena_2026_bloque_08', pases_apoderados: 2, pases_invitados: 6}
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
    'mendiz pozo constantino panagiotis',
    'morales perez antonia margarita',
    'gutierrez zapata agustin antonio',
    'herrera messina florencia isidora',
    'madariaga jara martina esperanza',
    /*'lepin hugueno antonia sara',
    'montero arroyo isidora daniela',*/
    'alarcon salazar julieta ignacia'/*,
    'herrera gongora martina ignacia',
    'diaz rodriguez fernando jesus'*/
  ]
  try {
    const infoOrganizacion = await db_support.infoOrganizacionDB.findOne({id_organizacion: 'cpa_patrona'});
    const id_organizacion = infoOrganizacion.id_organizacion;
    const id_evento = 'fiesta_chilena_2026';
    //const nombre_completo = 'herrera messina florencia isidora';

    // Borrando Entradas anteriores
    const drop_result = await fetch (`${url_server}/api/entradas?id_evento=${encodeURIComponent(id_evento)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET_API_KEY },
    });

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
      console.log('Entradas generadas para la familia:', entradas);
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
    'herrera messina'
  ]

  destinatarios = {
    'morales perez' : { email_destinatario: 'morales.italo@gmail.com', mensajeCorreo: 'Entrada Familia de Italo!'},
    'herrera messina': { email_destinatario: 'l.herreramena@gmail.com', mensajeCorreo: 'Entrada Familia de Leo!'},
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

module.exports.lauch_test_api = lauch_test_api;
