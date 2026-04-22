
const test_result_array = {};

async function lauch_test_api(delay_ms = 500) {
  console.log('Launching Api Test...');
    setTimeout(test_api_curso, delay_ms);
    setTimeout(test_api_email_update, delay_ms);
}

async function log_result(tag, result) {
  const result_upppercase = String(result).toUpperCase();
      console.log(`${tag}.....${result_upppercase}`);
}

async function test_api_get(tag, url, payload,  callback) {
  fetch(`http://localhost:5001${url}?${key}=${encodeURIComponent(payload)}`)
    .then(res => res.json())
    .then(async res => callback(res))
    .catch(err => {
      console.error('Error', err);
      test_result_array[tag] = 'fail';
      log_result(tag, 'fail');
    });
} 

async function test_api_curso() {
  const query = "herrera messina cristobal nicolas";
  const tag = "[test /api/curso]";
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
  const tag = 'test_api_email_update';
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

async function test_api_pagos_cpa() {
  /api/estado_pago_cpa
}
module.exports.lauch_test_api = lauch_test_api;
