const Jimp = require('jimp');
const QRCode = require('qrcode');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');


registerFont('/usr/share/fonts/truetype/teluguvijayam/PottiSreeramulu.ttf', {
  family: 'PottiSreeramulu'
});

async function genEntrada({ familia, nombre_completo, colores, correlativo, total, num_listado, curso, jornada, tipo }) {
  const colorText = colores.join('/');
  const serial = `${correlativo}/${total}`;
  const qrData = `https://registro-patrona.onrender.com/api/entrada_qr?familia=${familia}&jornada=${jornada}&tipo=${tipo}&correlativo=${correlativo}`;

  const fondo = await Jimp.read('./img/fondo_entrada.png');
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
  const colorText = colores.join('/');
  const serial = `${correlativo}/${total}`;
  const qrData = `https://registro-patrona.onrender.com/api/entrada_qr?familia=${familia}&jornada=${jornada}&tipo=${tipo}&correlativo=${correlativo}`;

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

  const textos = [
    { text: familia, x: 190, y: 415 },
    { text: nombre_completo, x: 58, y: 445 },
    { text: `Bloques: ${colorText}`, x: 58, y: 475 },
    { text: `Jornada: ${jornada}`, x: 58, y: 505 },
    { text: serial, x: 375, y: 640 },
    { text: `Curso: ${curso}`, x: 350, y: 675 },
    { text: `Nro List: ${num_listado}`, x: 350, y: 710 }
  ];

  textos.forEach(({ text, x, y }) => {
    ctx.fillText(text, x, y);
  });

  // QR
  const qrBuffer = await QRCode.toBuffer(qrData, { width: 215 });
  const qrImage = await loadImage(qrBuffer);
  ctx.drawImage(qrImage, 45, 528);

  return canvas.toBuffer('image/png');
}

module.exports = { genEntrada, genEntradaCanvas };
