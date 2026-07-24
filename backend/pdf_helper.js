const PDFDocument = require('pdfkit');
const fs = require('fs/promises');
const path = require('path');

async function save_pdf(bufferPdf, filename = null) {
  try {
    console.log(`[save_pdf] filename: ${filename}`);
    if (!bufferPdf || !Buffer.isBuffer(bufferPdf)) {
      throw new Error('El buffer proporcionado no es válido o está vacío.');
    }

    // Definir directorio de destino (ej. ./tickets_pdf)
    const outputDir = path.join(__dirname, '../tickets_pdf');

    // Crear el directorio si no existe
    await fs.mkdir(outputDir, { recursive: true });

    // Determinar el nombre del archivo y validar si ya tiene extensión .pdf
    let name = 'entradas.pdf';
    if (filename) {
      name = filename.toLowerCase().endsWith('.pdf') 
        ? filename 
        : `${filename}.pdf`;
    }
    console.log(`$[save_pdf] name: ${name}`)

    const filePath = path.join(outputDir, name);

    // Escribir el buffer directamente en disco
    await fs.writeFile(filePath, bufferPdf);
    
    console.log(`[save_pdf] PDF guardado correctamente en: ${filePath}`);
    return filePath;

  } catch (error) {
    console.error('[save_pdf] Error al guardar el archivo PDF:', error);
    return null;
  }
}


/**
 * Compila un arreglo de buffers PNG en un único Buffer PDF en memoria.
 * @param {Buffer[]} bufferArray - Lista de buffers de imágenes de entradas.
 * @returns {Promise<Buffer>}
 */
async function generarPdfDesdeBuffers(bufferArray) {
  return new Promise((resolve, reject) => {
    try {
      if (!Array.isArray(bufferArray) || bufferArray.length === 0) {
        return reject(new Error('El arreglo de buffers está vacío o es inválido.'));
      }

      // Crear documento sin páginas iniciales para agregar páginas dinámicamente según el tamaño de cada imagen
      const doc = new PDFDocument({ autoFirstPage: false });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      for (const imgBuffer of bufferArray) {
        if (!imgBuffer) continue;

        // Leer dimensiones de la imagen original para ajustar la hoja exactamente a su tamaño
        const img = doc.openImage(imgBuffer);

        doc.addPage({
          size: [img.width, img.height],
          margin: 0
        });

        doc.image(img, 0, 0, { width: img.width, height: img.height });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports.generarPdfDesdeBuffers = generarPdfDesdeBuffers;
module.exports.save_pdf = save_pdf;
