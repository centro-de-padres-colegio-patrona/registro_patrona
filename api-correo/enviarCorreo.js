
const nodemailer = require('nodemailer');
const express = require('express');
const cors = require('cors');

const config_env = require('../src/setup/config/env.js');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/enviarCorreo', async (req, res) => {
  const { para, asunto, mensaje } = req.body;

  

  console.info('PARA :' + para);
  console.info('ASUNTO :' + asunto);
  console.info('MENSAJE :' + mensaje);

    if (!para || !asunto || !mensaje) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const transporter = nodemailer.createTransport({
     service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: config_env.EMAIL_USER,
        pass: config_env.EMAIL_PASS,
        clientId: config_env.EMAIL_CLIENT_ID,
        clientSecret: config_env.EMAIL_CLIENT_SECRET,
        refreshToken: config_env.EMAIL_REFRESH_TOKEN
      },
      tls: {
        rejectUnauthorized: false  // evita problemas con certificados autofirmados
      }
    });

  const mailOptions = {
    from: config_env.EMAIL_USER,
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