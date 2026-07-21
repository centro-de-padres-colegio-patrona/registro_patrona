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


async function genEntrada({ url_server, id_evento, imagen_ticket_path, familia, nombre_completo, colores, correlativo, total, num_listado, curso, jornada, tipo, hash }) {
  // Verificar hash
  const bloques = colores_to_bloques(colores);
  const colorText = bloques.join('/');
  const serial = `${correlativo}/${total}`;
  const qrData = `${url_server}/api/entrada_qr?familia=${encodeURIComponent(familia)}&jornada=${jornada}&tipo=${tipo}&correlativo=${correlativo}&nombre=${encodeURIComponent(nombre_completo)}&curso=${encodeURIComponent(curso)}&bloque=${encodeURIComponent(colores_to_bloques(colores).join('/'))}&num_listado=${num_listado}&total=${total}`;

  const fondo_path = `./img/${id_evento}.png`;
  const fondo = await Jimp.read(fondo_path);
  const qr = await QRCode.toBuffer(qrData, { width: 215 });

  const qrImage = await Jimp.read(qr);
  fondo.composite(qrImage, 45, 528);

  const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
  const fontBig = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);

  fondo.print(fontBig, 0, 104, {
    text: tipo,
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
  }, fondo.bitmap.width);

  const textos = [
    { text: familia, x: 190, y: 385 },
    { text: nombre_completo, x: 58, y: 415 },
    { text: `Bloques: ${colorText}`, x: 58, y: 445 },
    { text: `Jornada: ${jornada}`, x: 58, y: 475 },
    { text: serial, x: 375, y: 615 },
    { text: `Curso: ${curso}`, x: 350, y: 655 },
    { text: `Nro List: ${num_listado}`, x: 350, y: 690 }
  ];

  textos.forEach(({ text, x, y }) => {
    fondo.print(font, x, y, text);
  });

  return await fondo.getBufferAsync(Jimp.MIME_PNG);
}


async function genEntradaCanvas({ familia, nombre_completo, colores, correlativo, total, num_listado, curso, jornada, tipo }) {
  //console.log(`${JSON.stringify(colores)}`);
  //console.log(`typeof(colores): ${typeof(colores)}`);
  const bloques = colores_to_bloques(colores);
  const colorText = bloques.join('/');
  const serial = String(correlativo).padStart(4, '0');
  const jornadaMap = { 'manana': 'Mañana', 'tarde': 'Tarde' };
  const jornadaDisplay = jornadaMap[jornada] || jornada;
  const qrData = `https://registro-patrona.onrender.com/api/entrada_qr?familia=${encodeURIComponent(familia)}&jornada=${jornada}&tipo=${tipo}&correlativo=${correlativo}&nombre=${encodeURIComponent(nombre_completo)}&curso=${encodeURIComponent(curso)}&bloque=${encodeURIComponent(colorText)}&num_listado=${num_listado}&total=${total}`;

  const fondo = await loadImage(path.join(__dirname, '../img/fondo_entrada.png'));
  const canvas = createCanvas(fondo.width, fondo.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(fondo, 0, 0);

  // Texto centrado arriba
  ctx.font = '50px PottiSreeramulu';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText(tipo, canvas.width / 2, 144);

  // Textos laterales
  ctx.font = '30px PottiSreeramulu';
  ctx.fillStyle = 'black';
  ctx.textAlign = 'left';

  const textosMain = [
    { text: familia, x: 190, y: 415 },
    { text: nombre_completo, x: 58, y: 445 },
    { text: `Bloques: ${colorText}`, x: 58, y: 475 },
    { text: `Jornada: ${jornadaDisplay}`, x: 58, y: 505 },
  ];

  textosMain.forEach(({ text, x, y }) => {
    ctx.fillText(text, x, y);
  });

  // Textos zona ticket (font más pequeño para que quepa)
  ctx.font = '18px PottiSreeramulu';

  const textosTicket = [
    { text: serial, x: 340, y: 645 },
    { text: `Curso: ${curso}`, x: 340, y: 667 },
    { text: `Nro List: ${num_listado}`, x: 340, y: 689 }
  ];

  textosTicket.forEach(({ text, x, y }) => {
    ctx.fillText(text, x, y);
  });

  // QR
  const qrBuffer = await QRCode.toBuffer(qrData, { width: 215 });
  const qrImage = await loadImage(qrBuffer);
  ctx.drawImage(qrImage, 45, 528);

  return canvas.toBuffer('image/png');
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

module.exports = { genEntrada, genEntradaCanvas };
