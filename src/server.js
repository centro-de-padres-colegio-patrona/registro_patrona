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

const { genEntrada, genEntradaCanvas } = require('./generateTicket');
const { send_fiesta_chilena_email, send_email_registro_success, send_email_from_cpa_account } = require('../api-correo/send_fiesta_chilena_email.js');

const BASEURL = 'http://localhost:5001';

const nodemailer = require('nodemailer');
const cors = require('cors');

const LOCAL_PORT = 5001;
const PORT = process.env.PORT || LOCAL_PORT;

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
app.use(session({ secret: 'Peroconrespeto', resave: false, saveUninitialized: false }));
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
  //console.log('/api/estado_pago_cpa');
  try {
    const { user_email = null } = req.query;
    let user = null;
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
          estudiante = childInfo['nombre'];
          //console.log(estudiante);
          pago = await db_support.pagosDB.findOne({id: estudiante});
          //console.log(`[/api/estado_pago_cpa] pago user: ${JSON.stringify(pago)}`);
          pagos.push(pago);
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
    const {compromiso_key, user_email} = req.body;
    const compromiso_pago = await db_support.compromisosPagoDB.findOne({id: compromiso_key});
    const {monto} = compromiso_pago;
    console.log('compromiso pago: ', compromiso_pago);
    console.log('monto: ', monto);
    optional = {
      rut: "9999999-9",
      otroDato: "otroDato"
    };

    const params = {
      commerceOrder: 1111,
      subject: compromiso_key,
      currency: 'CLP',
      amount: String(monto),
      email: user_email,
      //paymentMethod: 9,
      urlConfirmation: BASEURL + '/api/payments/confirm',
      urlReturn: BASEURL + '/api/payments/result',
      optional: JSON.stringify(optional)
      //apiKey: flow_api_key,
    };

    /*keys = Object.keys(params);
    keys.sort();
    let stringToSign = '';
    keys.forEach(key => {
      stringToSign += key + params[key];
    });
    console.log('stringToSign', stringToSign);
    const sign = CryptoJS.HmacSHA256(stringToSign, flow_secret_key);
    params['s'] = sign;

    console.log('params: ', params);
    //let url = 'https://www.flow.cl/api';
    let url = 'https://sandbox.flow.cl/api';
    service = '/payment/create';
    url = url + service;
    url = url + '?' + encodeURIComponent(sign);
    //const raw_response = await fetch(url);
    const raw_response = await fetch(url , {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });*/

    //const response = await raw_response.json();
    const simpleParams = {apiKey: flow_api_key};
    const sgn = flow.sign(simpleParams);
    simpleParams.s = sgn;
    console.log('simpleParams: ', simpleParams);

    const response = await flow.send("payment/create", params, "POST");

    console.log('Flow Response: ', response);
    if ( response.code === 200 )
      return res.status(200).json({ data: `pago efectuado ${user_email}` });
    else
      return res.status(400).json({ error: 'Error al efectuar el pago: ' + response });
  } catch (error) {
    console.error("Error al enviar:", error);
    return res.status(400).json({ error: 'Error al efectuar el pago: ' + error });
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
    return `
      <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333;">
        <p>Estimado/a apoderado/a,</p>
        <p>Gracias por utilizar el <strong>Sistema de Registro</strong> del Centro de Padres del Colegio Patrona.</p>
        <p>Para validar su correo electrónico, por favor ingrese el siguiente código en el formulario:</p>
        <p style="font-size: 24px; font-weight: bold; color: #4A90E2; text-align: center;">${codigo}</p>
        <p>Este código es válido por unos minutos. Si no solicitó esta validación, puede ignorar este mensaje.</p>
        <br>
        <p>Saludos cordiales,<br>
        Centro de Padres Colegio Patrona</p>
      </div>
    `;
  }

  const { email_destinatario, codigo } = req.body;
  console.log(`Código enviado al correo: ${codigo}`);
  const asuntoCorreo = "Registro Centro Padres Colegio Patrona: Validación Correo";
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


// Start the server on port 8080
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
})
