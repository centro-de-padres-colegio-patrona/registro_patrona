
const test_result_array = {};

async function lauch_test_api(delay_ms = 500) {
  console.log('Launching Api Test...');
    setTimeout(test_api_curso, delay_ms);
}

async function log_result(tag, result) {
  const result_upppercase = String(result).toUpperCase();
      console.log(`${tag}.....${result_upppercase}`);
}

async function test_api_curso() {
  query = "herrera messina cristobal nicolas";
  tag = "[test /api/curso]";
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


module.exports.lauch_test_api = lauch_test_api;
