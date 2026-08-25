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

function genQrData({ url_server, id_organizacion, id_evento, familia, nombre_completo, folio, num_listado, curso, jornada, tipo, bloques }) {
  const tag = '[genQrData]';
  try {
    const qrData = `${url_server}/api/entrada/consultar?organizacion=${encodeURIComponent(id_organizacion)}&evento=${encodeURIComponent(id_evento)}&familia=${encodeURIComponent(familia)}&jornada=${jornada}&tipo=${tipo}&folio=${folio}&nombre=${encodeURIComponent(nombre_completo)}&curso=${encodeURIComponent(curso)}&bloques=${encodeURIComponent(bloques)}&num_listado=${num_listado}`;
    return qrData;
  } catch (err) {
    console.log(`${tag} Error: `, err.stack || err.message || err);
    return null;
  }
}

async function genQrEntradaCanvas({ url_server, id_organizacion, id_evento, familia, nombre_completo, folio, num_listado, curso, jornada, tipo, bloques }) {
  const tag = '[genQrEntradaCanvas]';
  try {
    //console.log(`${tag} ticketInfo: `, { id_organizacion, id_evento, familia });

    const qrData = `${url_server}/api/entrada/consultar?organizacion=${encodeURIComponent(id_organizacion)}&evento=${encodeURIComponent(id_evento)}&familia=${encodeURIComponent(familia)}&jornada=${jornada}&tipo=${tipo}&folio=${folio}&nombre=${encodeURIComponent(nombre_completo)}&curso=${encodeURIComponent(curso)}&bloques=${encodeURIComponent(bloques)}&num_listado=${num_listado}`;

    const width = 215;
    const margin = 10;

    // QR
    const qrBuffer = await QRCode.toBuffer(qrData, { width, margin, errorCorrectionLevel: 'M' });

    return [qrBuffer, qrData];
  } catch (err) {
    console.log(`${tag} Error: `, err.stack || err.message || err);
    return [null, err.message];
  }
}


function fillTextFit(ctx, canvas, layout ) {
  const {label, text, x, y, fontSize, maxPxWidth, fillStyle, textAlign, textAdjusted = false, fontFace = 'PottiSreeramulu' } = layout;
  if (!text) return;
  if (!fontFace) fontFace = 'PottiSreeramulu';
  if (fillStyle) ctx.fillStyle = fillStyle;
  if (textAlign) ctx.textAlign = textAlign;
  if (fontSize) ctx.font = `${fontSize}px ${fontFace}`;
  let _x = x;
  let _y = y;
  if (typeof x === 'string') {
    const xEval = eval(x.replace('$canvas', 'canvas'));
    _x = xEval;
  }
  if (typeof y === 'string') {
    const yEval = eval(y.replace('$canvas', 'canvas'));
    _y = yEval;
  }
  const labelText = label ? `${label}${text}` : text;
  if (textAdjusted) {
    const textWidth = ctx.measureText(labelText).width;
    if (textWidth > maxPxWidth) {
      const scale = maxPxWidth / textWidth;
      //ctx.save();
      ctx.translate(_x, _y);
      ctx.scale(scale, 1);
      ctx.fillText(labelText, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(labelText, _x, _y);
    }
  } else {
    ctx.fillText(labelText, _x, _y);
  }
}

//async function genEntradaCanvas_v2({ url_server, id_organizacion, id_evento, imagen_ticket_path, familia, nombre_completo, folio, num_listado, curso, jornada, tipo, bloques }) {
async function genEntradaCanvas({ url_server, id_organizacion, id_evento, imagen_ticket_path, familia, nombre_completo, folio, num_listado, curso, jornada, tipo, bloques }) {
  const tag = '[genEntradaCanvas]';
  try {
    const serial = String(folio).padStart(4, '0');
    const jornadaMap = { 'manana': 'Mañana', 'tarde': 'Tarde' };
    const jornadaDisplay = jornadaMap[jornada] || jornada;
    const qrData = `${url_server}/api/entrada/consultar?organizacion=${encodeURIComponent(id_organizacion)}&evento=${encodeURIComponent(id_evento)}&familia=${encodeURIComponent(familia)}&jornada=${jornada}&tipo=${tipo}&folio=${folio}&nombre=${encodeURIComponent(nombre_completo)}&curso=${encodeURIComponent(curso)}&bloques=${encodeURIComponent(bloques)}&num_listado=${num_listado}`;

    const fondo = await loadImage(path.join(__dirname, '../', imagen_ticket_path));
    const canvas = createCanvas(fondo.width, fondo.height);
    const ctx = canvas.getContext('2d');

    // Verificar si num_listado es numero y mayor que 1, si no, dejar string vacio
    console.log(`${tag} num_listado: ${num_listado}, typeof: ${typeof num_listado}`);
    if (typeof num_listado === 'number' && num_listado < 1) {
      num_listado = '';
    } else if (typeof num_listado === 'string') {
      const num = parseInt(num_listado);
      if (isNaN(num) || num < 1) {
        num_listado = '';
      }
    }
    console.log(`${tag} num_listado after check: ${num_listado}, typeof: ${typeof num_listado}`);


    ctx.drawImage(fondo, 0, 0);

    /*const layout = [
      { id: 'font', value: 'PottiSreeramulu'},
      //{ id: 'offset', text: '', x: 40, y: 70 },
      { id: 'familia', label: 'Familia: ', text: '$familia', x: 15, y: 415, fontSize: 30 },
      { id: 'nombre_completo', label: '', text: '$nombre_completo', x: 15, y: 448, fontSize: 30, maxPxWidth: 480, textAdjusted: true },
      { id: 'bloques', label: 'Bloques: ', text: '$bloques', x: 15, y: 481, fontSize: 30 },
      { id: 'jornadaDisplay', label: 'Jornada: ', text: '$jornadaDisplay', x: 15, y: 514, fontSize: 30 },
      { id: 'tipo', label: '', text: '$tipo', x: '$canvas.width / 2 + 80 - 40', y: 690-30-70, fontSize: 40, fillStyle: 'black', textAlign: 'left' },
      { id: 'serial', label: 'Folio: ', text: '$serial', x: '$canvas.width / 2 + 80 - 40', y: 700-70, fontSize: 32 },
      { id: 'curso', label: 'Curso: ', text: '$curso', x: '$canvas.width / 2 + 80 - 40', y: 660, fontSize: 18 },
      { id: 'num_listado', label: 'Nro Lista: ', text: '$num_listado', x: '$canvas.width / 2 + 80 - 40', y: 690, fontSize: 18 },
      { id: 'qr', label: '', text: '$qrData', x: 45-40, y: 608-70, width: 215, type: 'qr' }
    ];*/
    const layout = [
      { id: 'font', value: 'PottiSreeramulu'},
      //{ id: 'offset', text: '', x: 40, y: 70 },
      { id: 'familia', label: 'Familia: ', text: '$familia', x: 25, y: 415, fontSize: 30 },
      { id: 'nombre_completo', label: '', text: '$nombre_completo', x: 25, y: 448, fontSize: 30, maxPxWidth: 480, textAdjusted: true },
      { id: 'bloques', label: 'Bloques: ', text: '$bloques', x: 25, y: 481, fontSize: 30 },
      { id: 'jornadaDisplay', label: 'Jornada: ', text: '$jornadaDisplay', x: 25, y: 514, fontSize: 30 },
      { id: 'tipo', label: '', text: '$tipo', x: '$canvas.width / 2 + 80 - 40', y: 690-30-70, fontSize: 40, fillStyle: 'black', textAlign: 'left' },
      { id: 'serial', label: 'Folio: ', text: '$serial', x: '$canvas.width / 2 + 80 - 40', y: 700-70, fontSize: 32 },
      { id: 'curso', label: 'Curso: ', text: '$curso', x: '$canvas.width / 2 + 80 - 40', y: 660, fontSize: 18 },
      { id: 'num_listado', label: 'Nro Lista: ', text: '$num_listado', x: '$canvas.width / 2 + 80 - 40', y: 690, fontSize: 18 },
      { id: 'qr', label: '', text: '$qrData', x: 45-40, y: 608-70, width: 215, type: 'qr' }
    ];

    const fontItem = layout.find(item => item.id === 'font');
    const fontFace = fontItem ? fontItem.value : 'PottiSreeramulu';
    await Promise.all(layout.map(async (item) => {
      if (item.type && item.type === 'qr') {
        // QR
        const qrBuffer = await QRCode.toBuffer(qrData, { width: item.width });
        const qrImage = await loadImage(qrBuffer);
        ctx.drawImage(qrImage, item.x, item.y);
      } else {
        if (item.text) {
          const textValue = eval(item.text.replace('$serial', `'${serial}'`).replace('$familia', `'${familia}'`)
            .replace('$nombre_completo', `'${nombre_completo}'`)
            .replace('$bloques', `'${bloques}'`)
            .replace('$jornadaDisplay', `'${jornadaDisplay}'`)
            .replace('$curso', `'${curso}'`)
            .replace('$num_listado', `'${num_listado}'`)
            .replace('$tipo', `'${tipo}'`));
          fillTextFit(ctx, canvas, { ...item, text: textValue, fontFace });
        }
      }
    }));
    return [canvas.toBuffer('image/png'), qrData];
  } catch (err) {
    console.log(`[genEntradaCanvas]: Error: `, err.stack || err.message || err);
    return null;
  }
}

//async function genEntradaCanvas({ url_server, id_organizacion, id_evento, imagen_ticket_path, familia, nombre_completo, folio, num_listado, curso, jornada, tipo, bloques }) {
async function genEntradaCanvas_v1({ url_server, id_organizacion, id_evento, imagen_ticket_path, familia, nombre_completo, folio, num_listado, curso, jornada, tipo, bloques }) {
  const tag = '[genEntradaCanvas]';
  try {
    const serial = String(folio).padStart(4, '0');
    const jornadaMap = { 'manana': 'Mañana', 'tarde': 'Tarde' };
    const jornadaDisplay = jornadaMap[jornada] || jornada;
    const qrData = `${url_server}/api/entrada/consultar?organizacion=${encodeURIComponent(id_organizacion)}&evento=${encodeURIComponent(id_evento)}&familia=${encodeURIComponent(familia)}&jornada=${jornada}&tipo=${tipo}&folio=${folio}&nombre=${encodeURIComponent(nombre_completo)}&curso=${encodeURIComponent(curso)}&bloques=${encodeURIComponent(bloques)}&num_listado=${num_listado}`;

    const fondo = await loadImage(path.join(__dirname, '../', imagen_ticket_path));
    const canvas = createCanvas(fondo.width, fondo.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(fondo, 0, 0);

    const y_ = 70;
    const x_ = 40;

    // Texto centrado arriba
    ctx.font = '40px PottiSreeramulu';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'left';
    x_texto_tipo = canvas.width / 2 + 80;
    ctx.fillText(tipo, x_texto_tipo -x_, 690-30-y_);

    ctx.font = '32px PottiSreeramulu';
    ctx.fillText(`Folio: ${serial}`, x_texto_tipo -x_, 700-y_);

// Función auxiliar para ajustar la fuente según el ancho máximo permitido
    function fillTextFit(ctx, text, x, y, maxPxWidth, defaultFontSize = 30, fontFace = 'PottiSreeramulu') {
      let fontSize = defaultFontSize;
      ctx.font = `${fontSize}px ${fontFace}`;

      // Reduce el fontSize en bucle hasta que quepa en el ancho permitido
      while (ctx.measureText(text).width > maxPxWidth && fontSize > 12) {
        fontSize -= 2;
        ctx.font = `${fontSize}px ${fontFace}`;
      }

      ctx.fillText(text, x-x_, y-y_);
    }

    // Textos laterales
    ctx.font = '30px PottiSreeramulu';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'left';

    const maxAnchoPermitido = 480; // Ancho máximo disponible en px antes de salir de la imagen
    const y_offset = 490;
    const textosMain = [
      { text: `Familia: ${familia}`, x: 58, y: y_offset },
      { text: nombre_completo, x: 58, y: y_offset+30 },
      { text: `Bloques: ${bloques}`, x: 58, y: y_offset+60 },
      { text: `Jornada: ${jornadaDisplay}`, x: 58, y: y_offset+90 },
    ];

    textosMain.forEach(({ text, x, y }) => {
      //ctx.fillText(text, x-x_, y-y_);
      fillTextFit(ctx, text, x, y, maxAnchoPermitido, 30, 'PottiSreeramulu');
    });

    // Textos zona ticket (font más pequeño para que quepa)
    ctx.font = '18px PottiSreeramulu';

    const textosTicket_y_offset = 690;
    const textosTicket = [
      //{ text: `Folio: ${serial}`, x: 340, y: textosTicket_y_offset }
    ];
    if (curso) {
      textosTicket.push({ text: `Curso: ${curso}`, x: 340, y: textosTicket_y_offset+32 });
    }
    if (num_listado) {
      textosTicket.push({ text: `Nro List: ${num_listado}`, x: 340, y: textosTicket_y_offset+54 });
    }

    textosTicket.forEach(({ text, x, y }) => {
      ctx.fillText(text, x-x_, y-y_);
    });

    // QR
    const qrBuffer = await QRCode.toBuffer(qrData, { width: 215 });
    const qrImage = await loadImage(qrBuffer);
    ctx.drawImage(qrImage, 45-x_, 608-y_);

    //console.log(`genEntradaCanvas success`);
    return [canvas.toBuffer('image/png'), qrData];
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

module.exports = { genEntradaCanvas, genQrEntradaCanvas, genQrData };
