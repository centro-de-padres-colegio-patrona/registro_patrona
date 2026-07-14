const db_support = require('../backend/db_support');
const test_result_array = {};

async function lauch_test_api(delay_ms = 500) {
  console.log('Launching Api Test...');
    setTimeout(test_api_curso, delay_ms);
    setTimeout(test_api_email_update, delay_ms);
    setTimeout(test_api_pagos_cpa, delay_ms);
    setTimeout(test_api_compromisos_pago, delay_ms);
    //setTimeout(actualizarTiposDePago, delay_ms);
    setTimeout(listing_all_tipos_de_pago, delay_ms+1000);
    //setTimeout(test_api_pago_compromiso, delay_ms);
}

async function log_result(tag, result) {
  const result_upppercase = String(result).toUpperCase();
      console.log(`${tag}.....${result_upppercase}`);
}

async function test_api_get(tag, url, key, payload,  callback) {
  fetch(`http://localhost:5001${url}?${key}=${encodeURIComponent(payload)}`)
    .then(res => res.json())
    .then(async res => callback(res))
    .catch(err => {
      console.error('Error', err);
      test_result_array[tag] = 'fail';
      log_result(tag, 'fail');
    });
} 

async function test_api_pagos_cpa() {
  const tag = 'test /api/estado_pago_cpa';
  const url = '/api/estado_pago_cpa';
  const key = 'user_email';
  const user_email = 'l.herreramena@gmail.com';
  try {
    const result = await test_api_get(tag, url, key, user_email, pagos => { 
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

async function test_api_compromisos_pago() {
  const tag = 'test /api/compromisos_pago';
  const url = '/api/compromisos_pago';
  const key = 'user_email';
  const user_email = 'l.herreramena@gmail.com';
  try {
    const result = await test_api_get(tag, url, key, user_email, result => { 
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

async function test_api_curso() {
  const query = "herrera messina cristobal nicolas";
  const tag = "test /api/curso";
  //console.log('fetching name ', query);
  fetch(`http://localhost:5001/api/curso?nombre=${encodeURIComponent(query)}`)
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

async function test_api_email_update() {
  const tag = 'test /api/update_apoderado_email';
  const brothers_list = ['herrera messina florencia isidora', 'herrera messina cristobal nicolas'];
  const email = 'l.herreramena@gmail.com';
  try {
    const result = await fetch('http://localhost:5001/api/update_apoderado_email', {
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

async function test_api_pago_compromiso() {
  const tag = 'test /api/boton_pago_compromiso';
  const compromiso_key = 'cuota_cpa';
  const user_email = 'l.herreramena@gmail.com';
  const nombre = 'Leonardo Cristian Herrera Messina';
  const rut = '20.123.456-7';
  const telefono = '+56912345678';
  try {
    const result = await fetch('http://localhost:5001/api/boton_pago_compromiso', {
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

async function listing_all_tipos_de_pago() {
  try {
    const tipos = await db_support.pagosDB.distinct('tipo', {});
    console.log('Tipos de pago encontrados:', tipos);
  } catch (error) {
    console.error("Error al listar los tipos de pago:", error);
  }
}

module.exports.lauch_test_api = lauch_test_api;
