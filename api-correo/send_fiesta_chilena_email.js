


async function send_fiesta_chilena_email(body) {

}

async function send_email_registro_success(body) {

}

app.post('/enviarCorreoEntradas', async (req, res) => {
  const { correo, entradas } = req.body;

  if (!correo || !Array.isArray(entradas) || entradas.length === 0) {
    return res.status(400).json({ error: 'Faltan datos de correo o entradas' });
  }

  const asuntoCorreo = 'PATRONA: Registro exitoso';
  const mensajeCorreo = 'Se adjuntan las entradas generadas correctamente.';

  // Generar imágenes y adjuntos
  const attachments = await Promise.all(
    entradas.map(async (entrada) => {
      const buffer = await genEntradaCanvas(entrada);
      const nombreArchivo = `entrada_${entrada.familia}_${entrada.correlativo}.png`.replace(/\s+/g, '_');
      return {
        filename: nombreArchivo,
        content: buffer,
        contentType: 'image/png'
      };
    })
  );

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: correo,
    subject: asuntoCorreo,
    text: mensajeCorreo,
    attachments
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error al enviar:', error);
      return res.status(500).json({ error: 'Error al enviar correo: ' + error });
    } else {
      console.log('Correo enviado:', info.response);
      return res.status(200).json({ message: 'Correo enviado con entradas adjuntas' });
    }
  });
});


module.exports.send_fiesta_chilena_email = send_fiesta_chilena_email;
module.exports.send_email_registro_success = send_email_registro_success