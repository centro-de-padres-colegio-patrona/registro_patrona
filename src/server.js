// Import the express lirbary
const express = require('express')
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const CryptoJS = require("crypto-js");

const flow_api_key = '7FEF32BF-B9D3-4DA8-A190-9422737A5LCD'
const flow_secret_key = 'aefc24bed6613e40db09df328849568a220085ca'

const FlowApi = require('./flow_api');
const flow = new FlowApi();

const MercadoPagoApi = require('./mercado_pago_api');
const mp = new MercadoPagoApi('sandbox');

const { genEntrada, genEntradaCanvas } = require('./generateTicket');
const { send_fiesta_chilena_email, send_email_registro_success, send_email_from_cpa_account } = require('../api-correo/send_fiesta_chilena_email.js');

const nodemailer = require('nodemailer');
const cors = require('cors');

const LOCAL_PORT = 5001;
const PORT = process.env.PORT || LOCAL_PORT;

// Si corre en local usa ngrok para callbacks de pago, si no usa la URL de producción (Render)
const BASEURL = (PORT === LOCAL_PORT)
  ? 'https://unhappily-correct-squeeze.ngrok-free.dev'
  : 'https://registro-patrona.onrender.com';

const db_support = require('../backend/db_support');
//const listado_cursos = require('./backend/listadoCurso');

const path = require('path'); 
const fs = require('fs');

// Import the axios library, to make HTTP requests
const axios = require('axios')

// This is the client ID and client secret that you obtained
// while registering the application
const clientID = 'Ov23lii9SwvjHBz1HcSG'
const clientSecret = '2cf3fb6940a31ff7e3889e6bb2a858c476047f38'

const curso_map = {
  "Prekínder": 'PK',
  "Kínder": 'K',
  "1° Básico": '1',
  "2° Básico": '2',
  "3° Básico": '3',
  "4° Básico": '4',
  "5° Básico": '5',
  "6° Básico": '6',
  "7° Básico": '7',
  "8° Básico": '8',
  "I° Medio": '1M',
  "II° Medio": '2M',
  "III° Medio": '3M',
  "IV° Medio": '4M'
}

let cursoToBloque = {
    "PKA": {
        "bloque": "bloque_01",
        "jornada": "manana",
        "color": "ama_m"
    },
    "PKB": {
        "bloque": "bloque_01",
        "jornada": "manana",
        "color": "ama_m"
    },
    "KA": {
        "bloque": "bloque_01",
        "jornada": "manana",
        "color": "ama_m"
    },
    "KB": {
        "bloque": "bloque_01",
        "jornada": "manana",
        "color": "ama_m"
    },
    "3A": {
        "bloque": "bloque_02",
        "jornada": "manana",
        "color": "ros_m"
    },
    "3B": {
        "bloque": "bloque_02",
        "jornada": "manana",
        "color": "ros_m"
    },
    "4A": {
        "bloque": "bloque_02",
        "jornada": "manana",
        "color": "ros_m"
    },
    "4B": {
        "bloque": "bloque_02",
        "jornada": "manana",
        "color": "ros_m"
    },
    "1MA": {
        "bloque": "bloque_03",
        "jornada": "manana",
        "color": "ver"
    },
    "2MA": {
        "bloque": "bloque_03",
        "jornada": "manana",
        "color": "ver"
    },
    "3MA": {
        "bloque": "bloque_03",
        "jornada": "manana",
        "color": "ver"
    },
    "HI": {
        "bloque": "bloque_03",
        "jornada": "manana",
        "color": "ver"
    },
    "HJ": {
        "bloque": "bloque_03",
        "jornada": "manana",
        "color": "ver"
    },
    "1A": {
        "bloque": "bloque_04",
        "jornada": "manana",
        "color": "roj"
    },
    "1B": {
        "bloque": "bloque_04",
        "jornada": "manana",
        "color": "roj"
    },
    "2A": {
        "bloque": "bloque_04",
        "jornada": "manana",
        "color": "roj"
    },
    "2B": {
        "bloque": "bloque_04",
        "jornada": "manana",
        "color": "roj"
    },
    "1MB": {
        "bloque": "bloque_05",
        "jornada": "tarde",
        "color": "azul"
    },
    "2MB": {
        "bloque": "bloque_05",
        "jornada": "tarde",
        "color": "azul"
    },
    "3MB": {
        "bloque": "bloque_05",
        "jornada": "tarde",
        "color": "azul"
    },
    "7A": {
        "bloque": "bloque_06",
        "jornada": "tarde",
        "color": "nar"
    },
    "7B": {
        "bloque": "bloque_06",
        "jornada": "tarde",
        "color": "nar"
    },
    "8A": {
        "bloque": "bloque_06",
        "jornada": "tarde",
        "color": "nar"
    },
    "8B": {
        "bloque": "bloque_06",
        "jornada": "tarde",
        "color": "nar"
    },
    "5A": {
        "bloque": "bloque_07",
        "jornada": "tarde",
        "color": "ama_t"
    },
    "5B": {
        "bloque": "bloque_07",
        "jornada": "tarde",
        "color": "ama_t"
    },
    "6A": {
        "bloque": "bloque_07",
        "jornada": "tarde",
        "color": "ama_t"
    },
    "6B": {
        "bloque": "bloque_07",
        "jornada": "tarde",
        "color": "ama_t"
    },
    "4MA": {
        "bloque": "bloque_08",
        "jornada": "tarde",
        "color": "ros_t"
    },
    "4MB": {
        "bloque": "bloque_08",
        "jornada": "tarde",
        "color": "ros_t"
    }
};

const passport = require('passport');
const { name } = require('ejs');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const urlRender = 'https://registro-patrona.onrender.com'
const callbackURLLocal = '/auth/google/callback'
passport.use(new GoogleStrategy({
  clientID: '547108669206-gt688r7nm2186tetj2jopln6nhghsmr5.apps.googleusercontent.com',
  clientSecret: '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',
  callbackURL: (PORT !== LOCAL_PORT ? urlRender : '') + callbackURLLocal
}, async (accessToken, refreshToken, profile, done) => {
  // Aquí puedes guardar al usuario en tu base de datos
    try {
      // Buscar usuario por ID de Google
      let user = await db_support.usersDB.findOne({ googleId: profile.id });
      if (user === undefined || user === null) {
        console.log('User undefined');
      } else {
        console.log('User:', user);
        console.log(`email: ${user.email}, correo_validado: ${user.correo_validado}`);
      }
      // Si no existe, podés crearlo o manejarlo como desees
      if (!user || user === undefined) {
        console.log(`Usuario ${profile.emails[0].value} no encontrado`)
        user = await db_support.usersDB.create({
          googleId: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0].value || '',
          photo: profile.photos?.[0].value || '',
          personalInfo: {nombres: profile.name.givenName, apellidos: profile.name.familyName},
          listaHijosColegio: null,
          listaPadres: null,
          listaOtros: null,
          listaAsistentes: null,
          pagos: null,
          fecha_registro: Date.now,
          correo_validado: false,
        });
        //console.log('User:', user);
      } /*else {
        console.log('Found user:', user.username);
      }*/

      return done(null, profile);
    } catch (err) {
      return done(err, null);
    }
}));

// Serializar usuario
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));


// Create a new express application and use
// the express static middleware, to serve all files
// inside the public directory
const app = express()

app.use(express.static('public'));

app.use(express.static(__dirname + '/public'))
app.use(express.static(__dirname + '/src'))
app.use(express.static(__dirname + '/views'))

// Servir archivos estáticos desde la carpeta views
app.use(express.static(path.join(__dirname, '../views')));

app.use(express.urlencoded({ extended: true }));
app.use(session({ 
  secret: 'Peroconrespeto', 
  resave: false, 
  saveUninitialized: false,
  cookie: { 
    secure: false, // Cambiar a true si estás usando HTTPS
    sameSite: 'lax' // Cambiar según tus necesidades
  }
}));
app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');

app.use(cors());
app.use(express.json());

// Ruta para la página "hello world" (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.post('/login', (req, res) => {
  const { username, correoManual } = req.body;
  if (username === 'admin' && correoManual === '1234') {
    //res.send('Acceso concedido');
    res.redirect('/login');
  } else {
    //res.status(401).send('Credenciales incorrectas');
   res.redirect(`/signup?username=${encodeURIComponent(username)}&correoManual=${encodeURIComponent(correoManual)}`);
  }
});

/*app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'login', 'login.html'));
});*/

app.get('/login-error', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'login', 'login-error.html'));
});

// Ruta para la página "welcome" (welcome.html)


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));


app.get('/signup', (req, res) => {
  const { username, correoManual } = req.query;
  const dashboardPath = path.join(__dirname, '../views', 'dashboard.html');
  res.sendFile(dashboardPath);

//  res.render('dashboard', { username, correoManual });
  
});

app.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);

    req.session.destroy(function (err) {
      if (err) {
        console.error('Error al destruir la sesión:', err);
      }

      res.clearCookie('connect.sid'); // limpia la cookie de sesión
      res.redirect('/'); // redirige al inicio o login
    });
  });
});

app.get('/register_success', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'register_success.html'));
});
app.get('/pagoCCPP', (req, res) => {
  res.sendFile(path.join(__dirname, 'login', 'pagoCCPP.html'));
});

app.get('/pagoEntrada', (req, res) => {
  res.sendFile(path.join(__dirname, 'login', 'pagoEntradas.html'));
});

app.post('/api/update_apoderado_email', express.json(), async (req, res) => {
  const { brothers_list, email } = req.body;
  const resultArray = {};
  for (const full_name of brothers_list) {
    const searchName = full_name.trim().toLowerCase();
    //console.log(`[/api/update_apoderado_email] Buscando: ${searchName}`);
    const query = {id: searchName };
    const estudianteInfo = await db_support.hermanosMapDB.findOne(query);
    //console.log('estudianteInfo: ', estudianteInfo);
    //console.log('apoderado_email: ', estudianteInfo.apoderado_email);
    const email_already_exists = estudianteInfo.apoderado_email.includes(email);
    if (!email_already_exists) {
      // Agregar Email.
      estudianteInfo.apoderado_email.push(email);
      result = await db_support.hermanosMapDB.updateOne(
        query,
        { $set: { apoderado_email: estudianteInfo.apoderado_email } }
      );
      //console.log(`/api/update_apoderado_email ${full_name}, emails: `, estudianteInfo.apoderado_email);
      resultArray[full_name] = result;
      //console.log(`[/api/update_apoderado_email] result for ${full_name}: `, resultArray[full_name]);
    }
  };
  res.json(resultArray);
});

app.post('/api/hermanos', express.json(), async(req, res) => {
  const { brothers_list } = req.body;
  console.log('[/api/hermanos] brother list: ', brothers_list);
  if (brothers_list === undefined || brothers_list === null || brothers_list.length == 0) {
    res.json({brotherInfoMap: {}});
  }

  const brotherInfoMap = {};
  for (const full_name of brothers_list) {
    const searchName = full_name.trim().toLowerCase();
    // Usamos $regex y $options para una búsqueda insensible a mayúsculas
    // Esto evita el problema de que el log muestre un objeto vacío
    console.log(`[/api/hermanos] Buscando: ${searchName}`);

    //const result = await db_support.hermanosMapDB.find({id: searchName});

    // EXPLICACIÓN: Usamos findOne para obtener el objeto y $regex para ignorar mayúsculas
    const result = await db_support.hermanosMapDB.findOne({
      id: { $regex: `^${searchName}$`, $options: 'i' }
    });

    brotherInfoMap[full_name] = result;
    console.log(`[/api/hermanos] brotherInfoMap[${full_name}]: `, brotherInfoMap[full_name])
  };
  console.log('brother info map: ', brotherInfoMap);
  res.json(brotherInfoMap);
});

app.get('/api/curso', async (req, res) => {
  const {nombre} = req.query;
  //console.log('/api/curso: ', nombre);
  const query = { id: nombre };
  const result = await db_support.nombreCursoMapDB.findOne(query);
  //console.log('result: ', result);
  let curso = result.value.slice(0,-1);
  let seccion = result.value.slice(-1);
  res.json({curso, seccion});
});

app.get('/api/user', async (req, res) => {
  if (!req.isAuthenticated()) {
    console.log('/api/user: No autenticado');
    return res.status(401).json({ error: 'No autorizado' });
  }
  // Aquí puedes enviar los datos del usuario autenticado
  console.log('/api/user: Autenticado');
  console.log('req.user:', req.user);
  let user = await db_support.usersDB.findOne({ googleId: req.user.id });

  if (user === undefined) {
    console.log('User undefined');
  } /*else {
    console.log('User:', user);
  }*/
  // Si no existe, podés crearlo o manejarlo como desees
  if (!user || user === undefined) {
    console.log(`Usuario ${req.user.emails[0].value} no encontrado`)
    user = await db_support.usersDB.create({
      googleId: req.user.id,
      displayName: req.user.displayName,
      email: req.user.emails?.[0].value || '',
      photo: req.user.photos?.[0].value || '',
      personalInfo: {nombres: req.user.name.givenName, apellidos: req.user.name.familyName},
      hijos: null,
      padres: null,
      invitados: null,
      pagos: null,
      fecha_registro: Date.now,
      correo_validado: false
    });
  }
  console.log(`email: ${user.email}, correo validado: ${user.correo_validado}`)
  res.json({ user, req:req.user }); // Aquí envías los datos del usuario al frontend
});

app.get('/api/manualUser', async (req, res) => {
  const { email } = req.query
  console.log(`/api/manualUser: req: ${JSON.stringify(email)}`);
  let user = await db_support.usersDB.findOne({ email: email });
  if (user === undefined) {
    console.log('User undefined');
  }
  if (!user || user === undefined) {
    console.log(`Usuario ${email} no encontrado`)
    return res.status(404).json({ error: 'No encontrado' });
  }
  console.log(`email: ${user.email}, user info: ${JSON.stringify(user)}`)
  res.json({ user }); // Aquí envías los datos del usuario al frontend
});

app.post('/api/add_user', express.json(), async (req, res) => {
  const { email } = req.body;
  let user = await db_support.usersDB.findOne({ email });

  if (user === undefined || user === null) {
    console.log(`Creating user with email: ${email}`)
    user = await db_support.usersDB.create({
      email: email,
      hijos: null,
      padres: null,
      invitados: null,
      pagos: null,
      fecha_registro: Date.now,
      correo_validado: false
    });
  }
  console.log(`email: ${user.email}, correo validado: ${user.correo_validado}`)
  res.json({ user, req:req.user }); // Aquí envías los datos del usuario al frontend
});


app.post('/api/verificarPassword', express.json(), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan datos' });

  const user = await db_support.usersDB.findOne({ email });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const ahora = Date.now();
  const bloqueado = user.bloqueadoHasta && ahora < user.bloqueadoHasta;

  if (bloqueado) {
    //return res.status(403).json({ error: 'Cuenta bloqueada. Intenta en unos minutos.' });
    return res.status(403).json({
      error: 'Cuenta bloqueada',
      bloqueadoHasta: user.bloqueadoHasta
    });
  }

  const coincide = await bcrypt.compare(password, user.passwordHash);
  if (coincide) {
    await db_support.usersDB.updateOne(
      { email },
      { $set: { intentosFallidos: 0, bloqueadoHasta: null } }
    );
    return res.json({ status: 'ok' });
  } else {
    let nuevosIntentos = (user.intentosFallidos || 0) + 1;
    let bloqueo = null;

    if (nuevosIntentos >= 3) {
      const minutos = Math.min(15 * nuevosIntentos, 60); // bloqueo progresivo
      bloqueo = ahora + minutos * 60 * 1000;
      const mensaje = `
        Se han detectado múltiples intentos fallidos de ingreso a tu cuenta.
        Si no fuiste tú, considera cambiar tu contraseña.
      `;
      await send_email_from_cpa_account({
        email_destinatario: email,
        asuntoCorreo: "Intentos fallidos de acceso",
        mensajeCorreo: mensaje
      });
    }

    await db_support.usersDB.updateOne(
      { email },
      { $set: { intentosFallidos: nuevosIntentos, bloqueadoHasta: bloqueo } }
    );

    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

app.post('/api/resetPassword', express.json(), async (req, res) => {
  const { token, nuevaPassword } = req.body;
  const user = await db_support.usersDB.findOne({ tokenRecuperacion: token });

  if (!user || Date.now() > user.tokenExpira) {
    return res.status(400).json({ error: 'Token inválido o expirado' });
  }

  const passwordHash = await bcrypt.hash(nuevaPassword, 10);

  await db_support.usersDB.updateOne(
    { email: user.email },
    { $set: { passwordHash }, $unset: { tokenRecuperacion: "", tokenExpira: "" } }
  );

  res.json({ status: 'ok', mensaje: 'Contraseña actualizada' });
});

app.get('/api/correo_validado', async (req, res) => {
  if (!req.isAuthenticated()) {
    console.log('/api/correo_validado[490]: No autenticado');
    try {
      const correoManual = sessionStorage.getItem('correoManual');
      const result = await db_support.usersDB.findOneAndUpdate(
        { email: correoManual },
        { $set: { correo_validado: true } },
        { returnDocument: 'after' }
      );
      if (result === undefined || !result) {
        console.log('/api/correo_validado:[499] Usuario no encontrado para correo manual:', correoManual);
        const create_result = await db_support.usersDB.create({
          email: correoManual,
          hijos: null,
          padres: null,
          invitados: null,
          pagos: null,
          fecha_registro: Date.now,
          correo_validado: true
        });
        if (!create_result) {
          return res.status(404).json({ error: 'Usuario no creado' });
        }
      }
      return res.status(401).json({ error: 'No autenticado' });
    } catch (err) {
      console.error('/api/correo_validado:[515] Error al actualizar usuario para correo manual:', err);
      return res.status(500).json({ error: 'Error al validar el correo' });
    }
  }
  // Aquí puedes enviar los datos del usuario autenticado
  console.log('/api/correo_validado:[520] Autenticado e Email validado: ', req.user.emails[0].value);
  //console.log('/api/correo_validado:[521] req.user:', req);
  console.log('/api/correo_validado:[521] req.user:', req.user);

  try {
    const result = await db_support.usersDB.findOneAndUpdate(
      { email: req.user.emails[0].value },
      { $set: { correo_validado: true } },
      { returnDocument: 'after' }
    );
    if (result === undefined || !result) {
      console.log('/api/correo_validado:[530] Usuario no encontrado:', req.user.email);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    console.log('/api/correo_validado: Usuario actualizado:', result);
    //const user
    res.json({ status: 'ok', mensaje: 'Correo validado correctamente' });

  } catch (err) {
    console.error('/api/correo_validado: Error al actualizar usuario:', err);
    res.status(500).json({ error: 'Error al validar el correo' });
  }
});

app.post('/api/registro', express.json(), (req, res) => {
  // Aquí puedes guardar los datos, enviarlos por correo, etc.

  const registro = req.body;
  console.log('Datos recibidos:', registro);

    db_support.usersDB.findOneAndUpdate(
      { _id: registro._id },       // Filtro para encontrar el usuario
      { $set: registro },          // Actualización: sobrescribe los campos con los de `registro`
      { returnDocument: 'after' }  // Opcional: retorna el documento actualizado
    )
    .then(userActualizado => {
      console.log('Usuario actualizado:', userActualizado);
      let findone = db_support.registroEntradasDB.findOne({id:'estudiantes'});
      console.log(`registros: ${JSON.stringify(findone.registros)}`);
    })
    .catch(err => {
      console.error('Error al actualizar usuario:', err);
    });

    res.json({ status: 'ok', mensaje: 'Registro recibido'});

});

app.post('/api/send_notify_mail', async (req, res) => {
  send_email_registro_success(req.body);
  res.json({status: 'ok', mensaje: 'Enviando email'})
});

app.get('/api/bloque', async (req, res) => {
  const { curso, seccion } = req.query;

  let query_curso = {id: curso_map[curso] + seccion}
  
  // Base query
  const query = {
    'hijos.curso': curso,
    'hijos.seccion': seccion
  };

  console.log(`[/api/bloque] query_curso: ${JSON.stringify(query_curso)}`)

  try {
    let bloqueDB = await db_support.cursoBloqueMap.find(query_curso);
    //console.log(`[/api/bloque] cursoDB: ${JSON.stringify(cursoDB)}`);
    //let curso = cursoDB[0];
    //let bloque = curso.bloque
    bloqueDB = cursoToBloque[query_curso.id]
    console.log(`[/api/bloque] Bloque: ${JSON.stringify(bloqueDB)}`);
    res.json(bloqueDB);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar bloque' });
  }
});

app.get('/api/max_invitados', async (req, res) => {
  const { curso, seccion } = req.query;

  let query_curso = {id: curso_map[curso] + seccion}
  
  console.log(`query_curso: ${JSON.stringify(query_curso)}`)

  try {
    let cursoDB = await db_support.listadoCursosDB.find(query_curso);
    //console.log(`cursoDB: ${JSON.stringify(cursoDB)}`);
    let curso = cursoDB[0];
    let num_invitados = curso.numeroInvitados;
    console.log(`num_invitados: ${JSON.stringify(num_invitados)}`);
    res.json(num_invitados);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar num_invitados' });
  }
});

app.get('/api/compromisos_pago', async (req, res) => {
  try {
    //console.log('[/api/compromisos_pago] Quering info to database...');
    const compromisos_pago = await db_support.compromisosPagoDB.find({});
    //console.log('[/api/compromisos_pago] returned info: ', compromisos_pago);
    res.json(compromisos_pago);
  } catch (error) {
    console.error(`[/api/compromisos_pago] Error al procesar la solicitud:`, error);
    res.status(500).json({
      error: 'Error interno del servidor',
      detalle: error.message,
    });
  }
});

app.get('/api/estado_pago_cpa', async (req, res) => {
  //console.log('req.user:', req.user);
  console.log('/api/estado_pago_cpa');
  try {
    const { user_email = null } = req.query;
    let user = null;
    console.log(`[/api/estado_pago_cpa] user_email: ${user_email}`);
    console.log(`[/api/estado_pago_cpa] req.user: ${JSON.stringify(req.user)}`);
    console.log(`[/api/estado_pago_cpa] req.query: ${JSON.stringify(req.query)}`);
    if ( user_email === undefined || user_email === null )
      user = await db_support.usersDB.findOne({ googleId: req.user.id });
    else
      user = await db_support.usersDB.findOne({ email: user_email });

    if (user === undefined) {
      console.log('User undefined');
      res.status(500).json({ error: 'Error User not defined' });
    } /*else {
      console.log('User:', user);
    }*/
    // Si no existe, podés crearlo o manejarlo como desees
    if (!user || user === undefined) {
      console.log(`Usuario ${req.user.emails[0].value} no encontrado`)
      res.status(500).json({ error: 'Error user not found' });
    } else {
      //console.log(`[/api/estado_pago_cpa] user: ${JSON.stringify(user)}`);
      //console.log(`[/api/estado_pago_cpa] user: ${JSON.stringify(user.hijos)}`);
      const pagos = [];
      if (user.hijos !== undefined && user.hijos.length > 0) {
        //console.log(JSON.stringify(req));
        for ( let childInfo of user.hijos ) {
          const estudiante = childInfo['nombre'];
          //console.log(estudiante);
          const pagos_estudantes = await db_support.pagosDB.find({id: estudiante});
          //console.log(`[/api/estado_pago_cpa] pago user: ${JSON.stringify(pago)}`);
          pagos.push(...pagos_estudantes);
        }
        /*estudiante = user.hijos[0]['nombre'];
        console.log(estudiante);
        pago = await db_support.pagosDB.findOne({id: estudiante});
        console.log(`[/api/estado_pago_cpa] pago user: ${JSON.stringify(pago)}`);*/
      } else {
        console.log(`[/api/estado_pago_cpa] req.query: ${JSON.stringify(req.query)}`);
        //console.log(JSON.stringify(user.hijos));
        //estudiante = user.hijos[0]['nombre'];
        const { estudiante } = req.query;
        console.log(estudiante);
        pago = await db_support.pagosDB.findOne({id: estudiante});
        console.log(`[/api/estado_pago_cpa] pago estudiante: ${JSON.stringify(pago)}`);
      }
      /*console.log(JSON.stringify(pago));
      const cuota_cpa_pagada = pago.cuota_cpa === true;
      const entradas_pagadas = pago.entradas_pagadas
      res.json({cuota_cpa_pagada, entradas_pagadas});*/
      //console.log(`[/api/estado_pago_cpa] pagos: ${JSON.stringify(pagos)}`);
      res.json(pagos);  
    }
  } catch (error) {
    console.error(`[/api/estado_pago_cpa] Error al procesar la solicitud:`, error);
    res.status(500).json({
      error: 'Error interno del servidor',
      detalle: error.message,
    });
  }
});

app.get('/api/alumnos', async (req, res) => {
  const { curso, seccion, apellido, nombre } = req.query;

  let query_curso = {id: curso_map[curso] + seccion}
  
  // Base query
  const query = {
    'hijos.curso': curso,
    'hijos.seccion': seccion
  };

  if (apellido) query['hijos.apellido'] = new RegExp(`^${apellido}$`, 'i');
  if (nombre) query['hijos.nombre'] = new RegExp(`^${nombre}$`, 'i');

  console.log(`curso: ${curso}, seccion: ${seccion}, apellido: ${apellido}, nombre: ${nombre}`);
  console.log(`query_curso: ${JSON.stringify(query_curso)}`)

  try {
    let cursoDB = await db_support.listadoCursosDB.find(query_curso);
    //console.log(`cursoDB: ${JSON.stringify(cursoDB)}`);
    /*const alumnos = familias.flatMap(f => f.hijos.filter(h => 
      h.curso === curso &&
      h.seccion === seccion &&
      (!apellido || h.apellido.toLowerCase() === apellido.toLowerCase()) &&
      (!nombre || h.nombre.toLowerCase() === nombre.toLowerCase())
    ));*/
    let curso = cursoDB[0];
    let listaCurso = curso.listaCurso 
    //console.log(`curso: ${JSON.stringify(curso)}`);
    //console.log(`keys: ${JSON.stringify(Object.keys(curso))}`);
    //console.log(`listaCurso: ${JSON.stringify(listaCurso)}`);
    res.json(listaCurso);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar alumnos' });
  }
});

app.get('/api/family_search', async (req, res) => {
  const apellido = req.query.apellido?.toLowerCase();
  if (!apellido) return res.status(400).json({ error: 'Apellido requerido' });

  try {
    const resultado = await Familia.findOne({ 'hijos.apellido': { $regex: `^${apellido}$`, $options: 'i' } });
    if (!resultado) return res.status(404).json({ mensaje: 'Alumno no encontrado' });

    res.json(resultado); // o puedes devolver solo el hijo coincidente
  } catch (err) {
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
});


app.get('/oauth/github/redirect', (req, res) => {
  // The req.query object has the query params that
  // were sent to this route. We want the `code` param
  const requestToken = req.query.code
  axios({
    // make a POST request
    method: 'post',
    // to the Github authentication API, with the client ID, client secret
    // and request token
    url: `https://github.com/login/oauth/access_token?client_id=${clientID}&client_secret=${clientSecret}&code=${requestToken}`,
    // Set the content type header, so that we get the response in JSOn
    headers: {
      accept: 'application/json'
    }
  }).then((response) => {
    // Once we get the response, extract the access token from
    // the response body
    const accessToken = response.data.access_token
    // redirect the user to the welcome page, along with the access token
    res.redirect(`/welcome.html?access_token=${accessToken}`)
  })
})

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account' // <--- ESTO obliga a Google a preguntar qué cuenta usar
}));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login-error' }),
  (req, res) => {
    res.redirect('/authenticated');
  }
);

/*app.get('/authenticated', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  //res.send(`<h1>Hola ${req.user.displayName}</h1><a href="/logout">Logout</a>`);
  console.log(JSON.stringify(res));
  res.sendFile(path.join(__dirname, 'src', 'dashboard', 'dashboard.html'));
});*/

app.get('/authenticated', async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');

  console.log(`--> req.user.id: ${req.user.id}`)
  let user = await db_support.usersDB.findOne({ googleId: req.user.id });
  console.log(`--> req.user.email: ${user.email}, correo validado: ${user.correo_validado}`)

  //console.log('--> req.user: ', JSON.stringify(req.user))
  //console.log(JSON.stringify(req))
  //res.render('dashboard', { user: req.user });
  // Send the dashboard.html file as a response
  if (typeof user.correo_validado === 'undefined' || !user.correo_validado) {
    console.log('Validando correo');
    const validarCorreoPath = path.join(__dirname, '../views', 'validar_correo.html');
    res.sendFile(validarCorreoPath);
  } else {
    console.log('Correo validado');
    const entradasBingoPath = path.join(__dirname, '../views', 'panel_usuario.html');
    res.sendFile(entradasBingoPath);
  }
  //const dashboardPath = path.join(__dirname, '../views', 'dashboard.html');
  //res.sendFile(dashboardPath);
});

app.get('/ingreso_manual.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'ingreso_manual.html'));
});

app.post('/api/boton_pago_compromiso', async (req, res) => {
  try {
    let {compromiso_key, cantidades = {}, user_email, nombre, rut, telefono, nombres_hijos} = req.body;
    let monto_total = 0;
    // Normalizar: siempre trabajar con array
    const keys = Array.isArray(compromiso_key) ? compromiso_key : [compromiso_key];
    for (const key of keys) {
      const compromiso_pago = await db_support.compromisosPagoDB.findOne({id: key});
      if (!compromiso_pago) {
        return res.status(400).json({ error: `Compromiso '${key}' no encontrado en la base de datos` });
      }
      const cantidad = (cantidades && cantidades[key]) ? parseInt(cantidades[key]) : 1;
      monto_total += compromiso_pago.monto * cantidad;
    }
    if ( user_email === undefined || user_email === null) 
      user_email = req.user.emails[0].value;
    console.log('email: ', user_email);
    console.log('compromiso_key: ', compromiso_key);
    console.log('nombre: ', nombre);
    console.log('rut: ', rut);
    console.log('telefono: ', telefono);
    console.log('nombres_hijos: ', nombres_hijos);
    //console.log('compromiso pago: ', compromiso_pago);
    console.log('monto_total: ', monto_total);

    optional = {
      rut: rut || "9999999-9",
      nombre: nombre || "Unknown",
      telefono: telefono || "",
      nombres_hijos: nombres_hijos.join(','),
      otroDato: "sin datos adicionales"
    };

    /*const params = {
      commerceOrder: 1111,
      subject: compromiso_key,
      currency: 'CLP',
      amount: String(monto_total),
      email: user_email,
      urlConfirmation: BASEURL + '/api/payments/confirm',
      urlReturn: BASEURL + '/api/payments/return',
      optional: JSON.stringify(optional)
    };*/
    /*const params_post = await fetch('/api/generate_payment_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: compromiso_key,
        email: user_email,
        amount: monto,
        optional: optional
      })
    });
    const params = await params_post.json();*/
    const params = await generatePaymentOrder(monto_total, compromiso_key, user_email, optional);

    const allParams = await flow.send("payment/create", params, "POST");
    //const {allParams} = response;
    commerceOrderUpdateResult = await db_support.paymentOrdersDB.findOneAndUpdate(
      { commerceOrder: allParams.commerceOrder },
      { $set: allParams },
      { returnDocument: 'after' }
    );
    console.log('Commerce Order Update Result: ', commerceOrderUpdateResult);
    console.log('Flow Response: ', allParams);
    //const {code} = allParams;
    if ( allParams.code === undefined && allParams.token !== undefined && allParams.url !== undefined && allParams.flowOrder !== undefined)
      return res.status(200).json(allParams);
    else
      return res.status(400).json({ error: 'Error al efectuar el pago: ' + allParams.message });
  } catch (error) {
    console.error("Error al enviar:", error);
    return res.status(400).json({ error: 'Error al efectuar el pago: ' + error });
  }

});

/*async function generarSiguienteCommerceOrder() {
  // Buscamos el último registro ordenado por commerceOrder de forma descendente[cite: 4]
  const lastOrder = await db_support.pagosDB.findOne({}, { sort: { commerceOrder: -1 } });
  
  let siguienteNumero = 1;
  
  if (lastOrder && lastOrder.commerceOrder) {
    // Asumiendo que commerceOrder es un número. 
    // Si es un string como "CPA-100", necesitarías usar regex para extraer el número.
    siguienteNumero = parseInt(lastOrder.commerceOrder) + 1;
  }
  
  return siguienteNumero;
}*/
async function getNextCorrelativeCommerceOrder() {
  const commerceOrder = await db_support.commerceOrderDB.findOneAndUpdate(
    { id: "pagos_flow" }, 
    { $inc: { secuencia: 1 } }, 
    { 
      upsert: true,     // Si no existe el documento, lo crea
      new: true,        // Retorna el documento actualizado
      returnDocument: 'after' 
    }
  );
  return commerceOrder.secuencia;
}

async function generatePaymentOrder(amount, subject, email, optional) {
  try {
    const commerceOrder = await getNextCorrelativeCommerceOrder();
    console.log(`[generatePaymentOrder] amount: ${amount}, subject: ${subject}, email: ${email}`);
    if (typeof subject === 'array') {
      // Manejar el caso donde subject es un array de IDs
      subject = subject.join(','); // Convertir el array a una cadena separada por comas
    }
    const paymentOrder = {
      commerceOrder: commerceOrder,
      subject: subject,
      currency: 'CLP',
      amount: parseInt(amount),
      email: email,
      urlConfirmation: BASEURL + '/api/payments/confirm',
      urlReturn: BASEURL + '/api/payments/return',
      optional: JSON.stringify(optional)
    };
    const resp = await db_support.paymentOrdersDB.create(paymentOrder);
    if (!resp) {
      console.error(`[generatePaymentOrder] Error al guardar la orden de pago en la base de datos. No se puede generar la orden de pago.`);
      //return res.status(500).json({ error: 'Error al generar la orden de pago' });
      throw new Error({ message: 'Error al generar la orden de pago', status: 500 });
    }
    console.log(`[generatePaymentOrder] order: ${JSON.stringify(paymentOrder)}`);
    return paymentOrder;
  } catch (error) {
    console.error(`[generatePaymentOrder] Error al generar la orden de pago:`, error);
    throw new Error({
      error: 'Error interno del servidor',
      detalle: error.message,
    });
  }
}
app.post('/api/generate_payment_order', async (req, res) => {
  try {
    const { amount, subject, email, optional } = req.body;
    console.log(`[/api/generate_payment_order] amount: ${amount}, subject: ${subject}, email: ${email}`);
    const paymentOrder = await generatePaymentOrder(amount, subject, email, optional);
    res.json(paymentOrder);
  } catch (error) {
    console.error(`[/api/generate_payment_order] Error al generar la orden de pago:`, error);
    res.status(500).json({
      error: 'Error interno del servidor',
      detalle: error.message,
    });
  }
}
);

app.get('/api/payments/confirm', async (req, res) => {
  console.log('[/api/payments/confirm] GET - Esto es una prueba');
  res.status(200).send('Test Request');
});

// Flow enviará un POST a esta ruta con el token del pago
app.post('/api/payments/confirm', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { token } = req.body;
    console.log('[/api/payments/confirm] Recibida confirmación de Flow para el token:', token);

    // 1. Consultar el estado real del pago en Flow
    console.log('[/api/payments/confirm] Consultando estado del pago en Flow...');
    const result = await flow.send("payment/getStatus", { token }, "GET");
    console.log('[/api/payments/confirm] Resultado:', result);
    if (result.status === 200) { // Estado 2 es "Pagado" en Flow
      console.log('[/api/payments/confirm] Pago confirmado exitosamente:', result.commerceOrder);
      const nombres_hijos = result.optional.nombres_hijos.split(',');
      const optional = {...result.optional};
      result.optional = JSON.stringify(optional);
      // 2. AQUÍ ACTUALIZAS TU BASE DE DATOS
      //const resultDbCreate = await db_support.paymentOrdersDB.create(result);
      const resultDbUpdate = await db_support.paymentOrdersDB.findOneAndUpdate(
        { commerceOrder: result.commerceOrder },
        { $set: result },
        { returnDocument: 'after' }
      );
      console.log('[/api/payments/confirm] Resultado guardado en DB:', resultDbUpdate);

      const pago = {
        id: nombres_hijos[0],
        num_folio: result.commerceOrder,
        tipo: 'flow',
        cuota_cpa: result.subject === 'cuota_cpa',
        monto: result.amount,
        cantidad_agendas: 0,
        entrega_agendas: 0,
        fecha: result.requestDate,
        comentarios: '',
        entradas_pagadas: 0,
        payment_method: 'flow',
        commerce_order: result.commerceOrder,
      }
      const resultPagoCreate = await db_support.pagosDB.create(pago);
      console.log('[/api/payments/confirm] Pago guardado en DB:', resultPagoCreate);
      // Ejemplo: buscar al usuario/estudiante y marcar el compromiso como pagado
      /*const emailPagador = result.payer;
      const concepto = result.subject; // 'cuota_cpa' por ejemplo
      
      await db_support.pagosDB.updateOne(
        { email: emailPagador, 'pagos.id': concepto },
        { $set: { 'pagos.$.estado': 'Pagado', 'pagos.$.fecha': new Date().toLocaleDateString() } }
      );*/
    } else {
      console.error('[/api/payments/confirm] Hubo un problema con el pago: ', result);
    }

    // SIEMPRE responder con un 200 para que Flow sepa que recibiste la notificación
    res.status(200).send('OK');
  } catch (error) {
    console.error('[/api/payments/confirm] Error en confirmación de pago:', error);
    res.status(500).send('Error');
  }
});

// Flow redirige al usuario aquí mediante POST
app.post('/api/payments/return', express.urlencoded({ extended: true }), async (req, res) => {
  const url_panel_usuario = path.join(__dirname, '../views', 'pagos_cpa.html');
  try {
    const { token } = req.body;
    
    // Consultamos el estado para mostrar un mensaje personalizado
    const result = await flow.send("payment/getStatus", { token }, "GET");
    
    // Renderizamos una vista con el resultado
    // Puedes crear un 'resultado_pago.ejs' o redirigir al panel con un mensaje
    let mensaje = "";
    let exito = false;

    if (result.status === 200) {
      mensaje = "¡Tu pago ha sido procesado con éxito!";
      exito = true;
    } else if (result.status === 1) {
      mensaje = "Tu pago aún está pendiente de confirmación.";
    } else {
      mensaje = "El pago no pudo ser procesado o fue cancelado.";
    }

    console.log('[/api/payments/return] Resultado del pago:', result);
    console.log('[/api/payments/return] Mensaje para el usuario:', mensaje);

    if (!req.session.user && result.payer) {
      // Asumiendo que guardas al usuario en req.session.user o req.session.passport
      req.session.user = { email: result.payer }; 
    }

    //const forwarding = `${url_panel_usuario}?user_email=${encodeURIComponent(result.payer)}&hijos=${encodeURIComponent(result.optional.nombres_hijos)}`;
    const webPath = "/pagos_cpa.html";
    const params = `?user_email=${encodeURIComponent(result.payer)}&hijos=${encodeURIComponent(result.optional.nombres_hijos)}`;
    console.log('[/api/payments/return] Redirigiendo al panel de usuario con mensaje...', webPath + params);
    // Opción A: Redirigir de vuelta al panel con parámetros
    req.session.save((err) => {
      if (err) {
        console.error("Error guardando la sesión:", err);
      }
      console.log('[/api/payments/return] Redirigiendo al panel con sesión guardada...');
      res.redirect(webPath + params);
    });
    //res.redirect(webPath + params);
    
  } catch (error) {
    console.error('[/api/payments/return] Error al verificar el estado del pago:', error);
    res.redirect(`${url_panel_usuario}?status=error&msg=Error al verificar el estado del pago`);
  }
});

app.post('/api/send_email_entradas', async (req, res) => {
  const {email_destinatario} = req.body;
  send_fiesta_chilena_email(req.body);
  return res.status(200).json({ data: `enviando correa a ${email_destinatario}` });

  console.log(`body: ${JSON.stringify(req.body)}`)

  const asuntoCorreo = 'PATRONA: Registro exitoso';
  const mensajeCorreo = 'El registro se ha enviado correctamente.';

    if (!email_destinatario || !asuntoCorreo || !mensajeCorreo) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
      console.info ('Faltan campos requeridos..');
    }

    const entradas = req.body.vectores_entradas.manana + req.body.vectores_entradas.tarde 
    const attachments = await Promise.all(
      entradas.map(async (entrada) => {
        const buffer = await genEntradaCanvas(entrada);
        const nombreArchivo = `entrada_${entrada.familia.replace(/\s+/g, '_')}_${String(entrada.correlativo).padStart(4, '0')}.png`;
        return {
          filename: nombreArchivo,
          content: buffer,
          contentType: 'image/png'
        };
      })
    );

    console.log(`entradas: ${JSON.stringify(entradas)}`);

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
    to: 'leo.herrera.mena.fotos.2020@gmail.com',
    subject: asuntoCorreo,
    text: mensajeCorreo,
    attachments
  };

  transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error("Error al enviar:", error);
    return res.status(400).json({ error: 'Error al enviar correo: ' + error });
  } else {
    console.log("Correo enviado:", info.response);
    return res.status(200).json({ data: `enviando correa a ${email_destinatario}` });
  }
});
});

app.post('/api/generar_entrada_canvas', async (req, res) => {
    try {
      console.log(JSON.stringify(req.body));
      const { familia, nombre_completo, colores, correlativo, total, num_listado, curso, jornada, tipo } = req.body;

      // Guardar ticket en BD
      const bloqueText = Array.isArray(colores) ? colores.join('/') : colores;
      await db_support.ticketsDB.create({
        correlativo: parseInt(correlativo),
        familia,
        nombre_completo,
        tipo,
        jornada,
        curso,
        bloque: bloqueText,
        num_listado: parseInt(num_listado) || 0,
        total: parseInt(total) || 0,
        fecha_generacion: new Date(),
        usado: false
      });
      console.log(`[/api/generar_entrada_canvas] Ticket ${correlativo} guardado en BD`);

      const buffer = await genEntradaCanvas(req.body);
      res.set('Content-Type', 'image/png');
      res.send(buffer);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error generando entrada' });
    }
  });


app.post('/api/enviarCodigo', express.json(), async (req, res) => {

  function mensaje_codigo_validacion(codigo) {
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="left" style="font-family:Arial,sans-serif;font-size:16px;color:#333;padding:0;"><p style="margin:0 0 12px 0;">Estimado/a apoderado/a,</p><p style="margin:0 0 12px 0;">Gracias por utilizar el <strong>Sistema de Registro</strong> del Centro de Padres del Colegio Patrona.</p><p style="margin:0 0 16px 0;">Para validar su correo electr&oacute;nico, por favor ingrese el siguiente c&oacute;digo en el formulario:</p><table border="0" cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse;margin:0 auto 16px auto;"><tr><td style="border:3px solid #1a3a6b;padding:18px 48px;background-color:#1a3a6b;"><span style="font-size:36px;font-weight:bold;color:#ffffff;letter-spacing:8px;font-family:monospace;">${codigo}</span></td></tr></table><p style="margin:0 0 12px 0;">Este c&oacute;digo es v&aacute;lido por unos minutos. Si no solicit&oacute; esta validaci&oacute;n, puede ignorar este mensaje.</p><p style="margin:16px 0 0 0;"><em>Centro de Padres - Colegio Patrona de Lourdes</em></p></td></tr></table>`;
  }

  const { email_destinatario, codigo } = req.body;
  console.log(`Código enviado al correo: ${codigo}`);
  const asuntoCorreo = `Centro General de Padres y Apoderados: Validaci\u00f3n de Correo #${codigo}`;
  const mensajeCorreo = mensaje_codigo_validacion(codigo);
  body = {email_destinatario, asuntoCorreo, mensajeCorreo};
  result = await send_email_from_cpa_account(body);
  if (result.status === 'ok') {
    res.json({ status: 'ok' });
  } else {
    console.log(`/api/enviarCodigo: error sending email to ${email_destinatario}. Error: ${result.message}`);
    res.status(500).json({ error: result.message });
  }
});


// ─── Perfiles / Roles ────────────────────────────────────────────────────────

// Obtener perfil del usuario logueado
app.get('/api/mi-perfil', async (req, res) => {
  try {
    let email = null;
    if (req.isAuthenticated && req.isAuthenticated()) {
      email = req.user.emails?.[0]?.value || req.user.email;
    } else {
      email = req.query.email;
    }
    if (!email) return res.status(401).json({ error: 'No autenticado' });

    const perfil = await db_support.perfilesDB.findOne({ email: email.toLowerCase() });
    if (!perfil) {
      // Usuario sin perfil asignado = apoderado por defecto
      return res.json({ email, rol: 'apoderado', nombre_completo: '', rut: '' });
    }
    res.json(perfil);
  } catch (error) {
    console.error('[/api/mi-perfil] Error:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Listar todos los perfiles (solo admin)
app.get('/api/perfiles', async (req, res) => {
  try {
    const perfiles = await db_support.perfilesDB.find({});
    res.json(perfiles);
  } catch (error) {
    console.error('[/api/perfiles] Error:', error);
    res.status(500).json({ error: 'Error al listar perfiles' });
  }
});

// Crear perfil
app.post('/api/perfiles', express.json(), async (req, res) => {
  try {
    const { email, rut, nombre_completo, rol } = req.body;
    if (!email || !rut || !nombre_completo || !rol) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    const rolesValidos = ['administrador', 'apoderado', 'validador', 'supervisor'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({ error: `Rol inválido. Opciones: ${rolesValidos.join(', ')}` });
    }
    // Verificar si ya existe
    const existente = await db_support.perfilesDB.findOne({ email: email.toLowerCase() });
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un perfil con ese correo' });
    }
    const nuevo = await db_support.perfilesDB.create({
      email: email.toLowerCase(),
      rut,
      nombre_completo,
      rol,
      activo: true,
      fecha_creacion: new Date()
    });
    res.status(201).json(nuevo);
  } catch (error) {
    console.error('[POST /api/perfiles] Error:', error);
    res.status(500).json({ error: 'Error al crear perfil' });
  }
});

// Actualizar perfil
app.put('/api/perfiles/:email', express.json(), async (req, res) => {
  try {
    const emailParam = decodeURIComponent(req.params.email).toLowerCase();
    const { rut, nombre_completo, rol, activo } = req.body;
    const updateData = {};
    if (rut !== undefined) updateData.rut = rut;
    if (nombre_completo !== undefined) updateData.nombre_completo = nombre_completo;
    if (rol !== undefined) updateData.rol = rol;
    if (activo !== undefined) updateData.activo = activo;

    const result = await db_support.perfilesDB.findOneAndUpdate(
      { email: emailParam },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json(result);
  } catch (error) {
    console.error('[PUT /api/perfiles] Error:', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// Eliminar perfil
app.delete('/api/perfiles/:email', async (req, res) => {
  try {
    const emailParam = decodeURIComponent(req.params.email).toLowerCase();
    const perfiles = await db_support.perfilesDB.find({});
    const idx = perfiles.findIndex(p => p.email === emailParam);
    if (idx === -1) return res.status(404).json({ error: 'Perfil no encontrado' });
    // En mock usamos findOneAndUpdate para desactivar, en prod podríamos borrar
    await db_support.perfilesDB.findOneAndUpdate(
      { email: emailParam },
      { $set: { activo: false } }
    );
    res.json({ status: 'ok', mensaje: 'Perfil desactivado' });
  } catch (error) {
    console.error('[DELETE /api/perfiles] Error:', error);
    res.status(500).json({ error: 'Error al eliminar perfil' });
  }
});

// ─── QR Entrada ──────────────────────────────────────────────────────────────

// ─── Buscar Entradas (Supervisor) ────────────────────────────────────────────

app.get('/api/buscar_entradas', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Ingrese al menos 2 caracteres para buscar' });
    }

    // Normalizar: quitar tildes y pasar a minúsculas
    const normalizar = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const busqueda = normalizar(q.trim());
    const todos = await db_support.ticketsDB.find({});

    // Filtrar por correlativo, familia, nombre_completo o curso (búsqueda flexible, sin tildes)
    const resultados = todos.filter(ticket => {
      const campos = [
        String(ticket.correlativo || ''),
        normalizar(ticket.familia),
        normalizar(ticket.nombre_completo),
        normalizar(ticket.curso),
        normalizar(ticket.bloque)
      ].join(' ');
      return campos.includes(busqueda);
    });

    res.json(resultados);
  } catch (error) {
    console.error('[/api/buscar_entradas] Error:', error);
    res.status(500).json({ error: 'Error al buscar entradas' });
  }
});

// ─── Consultar y Validar Entradas ────────────────────────────────────────────

// Consultar estado de un ticket (si existe y si fue usado)
app.get('/api/consultar_entrada', async (req, res) => {
  try {
    const { correlativo, familia } = req.query;
    if (!correlativo) return res.status(400).json({ error: 'Falta correlativo' });

    const ticket = await db_support.ticketsDB.findOne({ correlativo: parseInt(correlativo) });

    if (!ticket) {
      return res.json({ existe: false, mensaje: 'Ticket no registrado en el sistema' });
    }

    return res.json({
      existe: true,
      usado: ticket.usado || false,
      fecha_uso: ticket.fecha_uso || null,
      validado_por: ticket.validado_por || null,
      familia: ticket.familia,
      nombre_completo: ticket.nombre_completo,
      tipo: ticket.tipo,
      jornada: ticket.jornada,
      curso: ticket.curso,
      bloque: ticket.bloque,
      num_listado: ticket.num_listado,
      total: ticket.total,
      correlativo: ticket.correlativo
    });
  } catch (error) {
    console.error('[/api/consultar_entrada] Error:', error);
    res.status(500).json({ error: 'Error al consultar entrada' });
  }
});

// Marcar ticket como usado (validado)
app.post('/api/validar_entrada', express.json(), async (req, res) => {
  try {
    const { correlativo, validado_por } = req.body;
    if (!correlativo) return res.status(400).json({ error: 'Falta correlativo' });

    const ticket = await db_support.ticketsDB.findOne({ correlativo: parseInt(correlativo) });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado en el sistema' });
    }

    if (ticket.usado) {
      return res.status(409).json({
        error: 'Este ticket ya fue utilizado',
        fecha_uso: ticket.fecha_uso,
        validado_por: ticket.validado_por
      });
    }

    // Marcar como usado
    await db_support.ticketsDB.findOneAndUpdate(
      { correlativo: parseInt(correlativo) },
      { $set: { usado: true, fecha_uso: new Date(), validado_por: validado_por || 'desconocido' } }
    );

    console.log(`[/api/validar_entrada] Ticket ${correlativo} marcado como usado por ${validado_por}`);
    res.json({ status: 'ok', mensaje: 'Ticket validado correctamente' });
  } catch (error) {
    console.error('[/api/validar_entrada] Error:', error);
    res.status(500).json({ error: 'Error al validar entrada' });
  }
});

// Endpoint JSON para obtener datos completos de una entrada (usado por validar_qr.html)
app.get('/api/entrada_qr_data', async (req, res) => {
  try {
    const { familia, jornada, tipo, correlativo } = req.query;

    const jornadaMap = { 'manana': 'Mañana', 'tarde': 'Tarde' };
    const jornadaDisplay = jornadaMap[jornada] || jornada;

    // Buscar info en deliveryDB
    let info = null;
    if (correlativo) {
      info = await db_support.deliveryDB.findOne({ serial: parseInt(correlativo) });
    }

    res.json({
      familia: familia || '—',
      nombre_completo: info?.nombre_completo || familia || '—',
      tipo: tipo || '—',
      jornada: jornadaDisplay,
      curso: info?.curso || '—',
      bloque: info?.bloques ? (Array.isArray(info.bloques) ? info.bloques.join('/') : info.bloques) : '—',
      num_listado: info?.num_listado || '—',
      total: info?.total || '—',
      correlativo: correlativo || '—'
    });
  } catch (error) {
    console.error('[/api/entrada_qr_data] Error:', error);
    res.status(500).json({ error: 'Error al obtener datos de entrada' });
  }
});

app.get('/api/entrada_qr', async (req, res) => {
  try {
    const { familia, jornada, tipo, correlativo } = req.query;

    const jornadaMap = { 'manana': 'Mañana', 'tarde': 'Tarde' };
    const jornadaDisplay = jornadaMap[jornada] || jornada;

    // Buscar info adicional en la BD si existe
    let info = null;
    if (correlativo) {
      info = await db_support.deliveryDB.findOne({ serial: parseInt(correlativo) });
    }

    const nombre = info?.nombre_completo || familia || '—';
    const curso = info?.curso || '—';
    const bloque = info?.bloques || '—';
    const numListado = info?.num_listado || '—';
    const serial = String(correlativo).padStart(4, '0');

    // Responder con HTML presentable
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Entrada - Fiesta a la Chilena</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', Tahoma, sans-serif;
            background: #f1f4f9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .ticket-card {
            background: white;
            border-radius: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.12);
            max-width: 420px;
            width: 100%;
            overflow: hidden;
          }
          .ticket-header {
            background: linear-gradient(135deg, #e53935, #d32f2f);
            padding: 24px 20px;
            text-align: center;
            color: white;
          }
          .ticket-header h1 {
            font-size: 1.4rem;
            margin-bottom: 4px;
          }
          .ticket-header p {
            font-size: 0.85rem;
            opacity: 0.9;
          }
          .ticket-body {
            padding: 24px 20px;
          }
          .ticket-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          .ticket-row:last-child { border-bottom: none; }
          .ticket-label {
            font-size: 0.8rem;
            font-weight: 700;
            color: #888;
            text-transform: uppercase;
          }
          .ticket-value {
            font-size: 0.95rem;
            font-weight: 600;
            color: #333;
            text-align: right;
          }
          .ticket-serial {
            text-align: center;
            margin-top: 16px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .ticket-serial span {
            font-size: 1.8rem;
            font-weight: 800;
            color: #e53935;
            letter-spacing: 3px;
          }
          .ticket-serial small {
            display: block;
            font-size: 0.75rem;
            color: #999;
            margin-top: 2px;
          }
          .badge {
            display: inline-block;
            background: #e8f5e9;
            color: #2e7d32;
            font-size: 0.8rem;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 20px;
          }
        </style>
      </head>
      <body>
        <div class="ticket-card">
          <div class="ticket-header">
            <h1>🎉 Fiesta a la Chilena 2025</h1>
            <p>Colegio Patrona de Lourdes</p>
          </div>
          <div class="ticket-body">
            <div class="ticket-row">
              <span class="ticket-label">Tipo</span>
              <span class="ticket-value"><span class="badge">${tipo || '—'}</span></span>
            </div>
            <div class="ticket-row">
              <span class="ticket-label">Nombre</span>
              <span class="ticket-value">${nombre}</span>
            </div>
            <div class="ticket-row">
              <span class="ticket-label">Familia</span>
              <span class="ticket-value">${familia || '—'}</span>
            </div>
            <div class="ticket-row">
              <span class="ticket-label">Jornada</span>
              <span class="ticket-value">${jornadaDisplay}</span>
            </div>
            <div class="ticket-row">
              <span class="ticket-label">Curso</span>
              <span class="ticket-value">${curso}</span>
            </div>
            <div class="ticket-row">
              <span class="ticket-label">N° Listado</span>
              <span class="ticket-value">${numListado}</span>
            </div>
            <div class="ticket-serial">
              <small>N° ENTRADA</small>
              <span>${serial}</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('[/api/entrada_qr] Error:', error);
    res.status(500).send('Error al cargar entrada');
  }
});

// ─── Mercado Pago ────────────────────────────────────────────────────────────

// Crear preferencia de pago en MP
app.post('/api/mp/create', async (req, res) => {
  try {
    let { compromiso_key, cantidades = {}, user_email, nombre, rut, telefono, nombres_hijos } = req.body;

    // Calcular monto total igual que Flow
    let monto_total = 0;
    const keys = Array.isArray(compromiso_key) ? compromiso_key : [compromiso_key];
    const subjects = [];
    for (const key of keys) {
      const compromiso_pago = await db_support.compromisosPagoDB.findOne({ id: key });
      if (!compromiso_pago) {
        return res.status(400).json({ error: `Compromiso '${key}' no encontrado` });
      }
      const cantidad = (cantidades && cantidades[key]) ? parseInt(cantidades[key]) : 1;
      monto_total += compromiso_pago.monto * cantidad;
      subjects.push(key);
    }

    if (user_email === undefined || user_email === null)
      user_email = req.user.emails[0].value;

    const commerceOrder = await getNextCorrelativeCommerceOrder();
    const subject = subjects.join(',');

    // Mapa de códigos a glosas legibles
    const glosaMap = {
      'cuota_cpa': 'Cuota Centro de Padres',
      'entradas_fiesta': 'Entradas Fiesta'
    };
    const glosa = subjects.map(s => glosaMap[s] || s).join(' + ');

    const optional = {
      rut: rut || '9999999-9',
      nombre: nombre || 'Unknown',
      telefono: telefono || '',
      nombres_hijos: Array.isArray(nombres_hijos) ? nombres_hijos.join(',') : (nombres_hijos || ''),
    };

    // Guardar la orden en BD (mismo modelo que Flow)
    const paymentOrder = {
      commerceOrder: String(commerceOrder),
      subject,
      currency: 'CLP',
      amount: monto_total,
      email: user_email,
      urlConfirmation: BASEURL + '/api/mp/confirm',
      urlReturn: BASEURL + '/api/mp/return',
      optional: JSON.stringify(optional),
      status: 'pending',
      payment_method: 'mercadopago'
    };
    await db_support.paymentOrdersDB.create(paymentOrder);

    // Crear preferencia en MP
    const preference = await mp.createPreference({
      title: glosa,
      amount: monto_total,
      email: user_email,
      externalReference: commerceOrder,
      backUrls: {
        success: BASEURL + '/api/mp/return?status=approved',
        failure: BASEURL + '/api/mp/return?status=failure',
        pending: BASEURL + '/api/mp/return?status=pending'
      }
    });

    console.log('[/api/mp/create] Preferencia creada:', preference.id);
    return res.status(200).json({
      preference_id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point
    });

  } catch (error) {
    console.error('[/api/mp/create] Error:', error);
    return res.status(500).json({ error: 'Error al crear preferencia MP: ' + error.message });
  }
});

// MP notifica el pago aquí (webhook IPN)
app.post('/api/mp/confirm', express.json(), async (req, res) => {
  try {
    console.log('[/api/mp/confirm] Notificación recibida:', req.body, req.query);
    const { type, data } = req.body;

    if (type === 'payment' && data?.id) {
      const { MercadoPagoConfig, Payment } = require('mercadopago');
      const mpClient = new MercadoPagoConfig({ accessToken: mp.accessToken });
      const paymentClient = new Payment(mpClient);
      const payment = await paymentClient.get({ id: data.id });

      console.log('[/api/mp/confirm] Payment status:', payment.status, 'external_ref:', payment.external_reference);

      if (payment.status === 'approved') {
        const commerceOrder = payment.external_reference;
        const orderInDB = await db_support.paymentOrdersDB.findOne({ commerceOrder });
        if (orderInDB) {
          await db_support.paymentOrdersDB.findOneAndUpdate(
            { commerceOrder },
            { $set: { status: 'approved', paymentData: payment } },
            { returnDocument: 'after' }
          );

          const optional = orderInDB.optional ? JSON.parse(orderInDB.optional) : {};
          const nombres_hijos = optional.nombres_hijos ? optional.nombres_hijos.split(',') : [];

          const pago = {
            id: nombres_hijos[0] || orderInDB.email,
            num_folio: commerceOrder,
            tipo: 'mercadopago',
            cuota_cpa: orderInDB.subject?.includes('cuota_cpa'),
            monto: payment.transaction_amount,
            cantidad_agendas: 0,
            entrega_agendas: 0,
            fecha: new Date().toLocaleDateString('es-CL'),
            comentarios: '',
            entradas_pagadas: 0,
            payment_method: 'mercadopago',
            commerce_order: commerceOrder,
          };
          await db_support.pagosDB.create(pago);
          console.log('[/api/mp/confirm] Pago guardado en DB');
        }
      }
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('[/api/mp/confirm] Error:', error);
    res.status(500).send('Error');
  }
});

// MP redirige al usuario aquí después del pago
app.get('/api/mp/return', async (req, res) => {
  try {
    const { status, external_reference, payment_id } = req.query;
    console.log('[/api/mp/return] status:', status, 'ref:', external_reference);

    const webPath = '/pagos_cpa.html';
    let params = '';

    if (external_reference) {
      const orderInDB = await db_support.paymentOrdersDB.findOne({ commerceOrder: external_reference });
      if (orderInDB) {
        const optional = orderInDB.optional ? JSON.parse(orderInDB.optional) : {};
        params = `?user_email=${encodeURIComponent(orderInDB.email)}&mp_status=${status}`;
        if (optional.nombres_hijos) {
          params += `&hijos=${encodeURIComponent(optional.nombres_hijos)}`;
        }
      }
    }

    res.redirect(webPath + params);
  } catch (error) {
    console.error('[/api/mp/return] Error:', error);
    res.redirect('/pagos_cpa.html?mp_status=error');
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// Start the server on port 8080
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
})
