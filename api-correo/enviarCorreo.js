
const nodemailer = require('nodemailer');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/enviarCorreo', async (req, res) => {
  const { para, asunto, mensaje } = req.body;

  

  console.info('PARA: ' + para);
  console.info('ASUNTO: ' + asunto);
  console.info('MENSAJE: ' + mensaje);

    if (!para || !asunto || !mensaje) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

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

    //ID: 110435636758-vvkr480b6l0lu7ninig8ddvrkbssuhk7.apps.googleusercontent.com
    //SECRET: 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
  const mailOptions = {
    from: 'centrodepadres@colegiopatrona.cl',
    to: para,
    subject: asunto,
    text: mensaje
  };

  transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error("Error al enviar:", error);
  } else {
    console.log("Correo enviado:", info.response);
  }
});
});


app.listen(3001, () => {
  console.log('Servidor corriendo en puerto 3001');
});