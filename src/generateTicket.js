const Jimp = require('jimp');
const QRCode = require('qrcode');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

const fontPath = path.join(__dirname, '../assets/fonts/PottiSreeramulu.ttf');
// Use fontPath in your renderer or image generator

const bloqueMap = {
        'ama_m': 1,
        'ros_m': 2,
        'ver': 3,
        'roj': 4,
        'azul': 5,
        'nar': 6,
        'ama_t': 7,
        'ros_t': 8,
    }

//registerFont('/usr/share/fonts/truetype/teluguvijayam/PottiSreeramulu.ttf', {
registerFont(fontPath, {
  family: 'PottiSreeramulu'
});

function colores_to_bloques(colores) {
  const array = Array.isArray(colores) ? colores : [colores];
  return array.map(color => bloqueMap[color] ?? color);
}


async function genEntradaCanvas({ url_server, id_evento, imagen_ticket_path, familia, nombre_completo, folio, num_listado, curso, jornada, tipo, bloques }) {
  const tag = '[genEntradaCanvas]';
  try {
    const colorText = bloques.join('/');
    const serial = String(folio).padStart(4, '0');
    const jornadaMap = { 'manana': 'Mañana', 'tarde': 'Tarde' };
    const jornadaDisplay = jornadaMap[jornada] || jornada;
    const qrData = `${url_server}/api/entrada/consultar?evento=${encodeURIComponent(id_evento)}&familia=${encodeURIComponent(familia)}&jornada=${jornada}&tipo=${tipo}&folio=${folio}&nombre=${encodeURIComponent(nombre_completo)}&curso=${encodeURIComponent(curso)}&bloque=${encodeURIComponent(colorText)}&num_listado=${num_listado}`;

    const fondo = await loadImage(path.join(__dirname, '../', imagen_ticket_path));
    const canvas = createCanvas(fondo.width, fondo.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(fondo, 0, 0);

    // Texto centrado arriba
    ctx.font = '40px PottiSreeramulu';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'left';
    ctx.fillText(tipo, canvas.width / 2 +40, 690-30);

    // Textos laterales
    ctx.font = '30px PottiSreeramulu';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'left';

    const y_offset = 490;
    const textosMain = [
      { text: `Familia: ${familia}`, x: 58, y: y_offset },
      { text: nombre_completo, x: 58, y: y_offset+30 },
      { text: `Bloques: ${colorText}`, x: 58, y: y_offset+60 },
      { text: `Jornada: ${jornadaDisplay}`, x: 58, y: y_offset+90 },
    ];

    textosMain.forEach(({ text, x, y }) => {
      ctx.fillText(text, x, y);
    });

    // Textos zona ticket (font más pequeño para que quepa)
    ctx.font = '18px PottiSreeramulu';

    const textosTicket_y_offset = 690;
    const textosTicket = [
      { text: `Folio: ${serial}`, x: 340, y: textosTicket_y_offset }
    ];
    if (curso) {
      textosTicket.push({ text: `Curso: ${curso}`, x: 340, y: textosTicket_y_offset+22 });
    }
    if (num_listado) {
      textosTicket.push({ text: `Nro List: ${num_listado}`, x: 340, y: textosTicket_y_offset+44 });
    }

    textosTicket.forEach(({ text, x, y }) => {
      ctx.fillText(text, x, y);
    });

    // QR
    const qrBuffer = await QRCode.toBuffer(qrData, { width: 215 });
    const qrImage = await loadImage(qrBuffer);
    ctx.drawImage(qrImage, 45, 608);

    console.log(`genEntradaCanvas success`);
    return canvas.toBuffer('image/png');
  } catch (err) {
    console.log(`[genEntradaCanvas]: Error: `, err.stack || err.message || err);
    return null;
  }
}

/*async function test_brother() {
  console.log('Running test_brother');

  const childrenList = [
  'herrera messina florencia isidora',
  'herrera messina cristobal nicolas'
  ]
  try {
    const response = await fetch('http://localhost:5001/api/hermanos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brothers_list: childrenList })
    });
    const brotherInfoMap = await response.json();
    console.log('brothers info: ', brotherInfoMap);
  } catch(error) {
    console.error('test brother: ', error);
  }
  //setTimeout(test2, 1000);
}

setTimeout(test_brother, 2000);*/

module.exports = { genEntradaCanvas };
