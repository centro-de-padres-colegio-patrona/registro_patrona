const { genEntrada, genEntradaCanvas } = require('../src/generateTicket');


async function send_fiesta_chilena_email(body) {
  //console.log(`body: ${JSON.stringify(body)}`)

  const {email_destinatario, vectores_entradas} = body;

  const asuntoCorreo = 'PATRONA: Registro exitoso';
  const mensajeCorreo = 'El registro se ha enviado correctamente.';

    if (!email_destinatario || !asuntoCorreo || !mensajeCorreo) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
      console.info ('Faltan campos requeridos..');
    }

    //const {manana , tarde} = vectores_entradas;
    //console.log(`${JSON.stringify(vectores_entradas)}`)
    //console.log(`${JSON.stringify(manana)}`);
    //console.log(`${JSON.stringify(tarde)}`);

    //const entradas = body.vectores_entradas.manana + body.vectores_entradas.tarde;
    const entradas = vectores_entradas;
    //console.log(`entradas: ${JSON.stringify(entradas)}`);
    const attachments = await Promise.all(
      entradas.map(async (vector) => {
        //const {vector} = entrada
        console.log(`vector: ${JSON.stringify(vector)}`);
        const buffer = await genEntradaCanvas(vector);
        const nombreArchivo = `entrada_${entrada.familia.replace(/\s+/g, '_')}_${String(entrada.correlativo).padStart(4, '0')}.png`;
        return {
          filename: nombreArchivo,
          content: buffer,
          contentType: 'image/png'
        };
      })
    );

    //console.log(`entradas: ${JSON.stringify(entradas)}`);

    const transporter = nodemailer.createTransport({
     service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: 'centrodepadres@colegiopatrona.cl',
        pass: 'Peroconrespeto',
        clientId: '110435636758-vvkr480b6l0lu7ninig8ddvrkbssuhk7.apps.googleusercontent.com',
        clientSecret: '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',
        refreshToken: '1//04wg4HDhyOi4YCgYIARAAGAQSNgF-L9IrEtcIbrnUQ_loGfqrIiEN8NNMACKBBvuNyCW1uKkegggwVsaQmsS9-2ikc2qMQldxpA'
      },
      tls: {
        rejectUnauthorized: false  // evita problemas con certificados autofirmados
      }
    });

  const mailOptions = {
    from: 'centrodepadres@colegiopatrona.cl',
    to: 'leo.herrera.mena.fotos.2010@gmail.com',
    subject: asuntoCorreo,
    text: mensajeCorreo,
    attachments
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error("Error al enviar:", error);
        //return res.status(400).json({ error: 'Error al enviar correo: ' + error });
        return;
    } else {
        console.log("Correo enviado:", info.response);
        console.log("email destinatario: ", email_destinatario);
        //return res.status(200).json({ data: `correo enviado a ${email_destinatario}` });
        return;
    }
    });
}

async function send_email_registro_success(body) {

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
}



module.exports.send_fiesta_chilena_email = send_fiesta_chilena_email;
module.exports.send_email_registro_success = send_email_registro_success