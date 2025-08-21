// Import the express lirbary
const express = require('express')
const bodyParser = require('body-parser');
const session = require('express-session');

const PORT = process.env.PORT || 5001;

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


const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const urlRender = 'https://registro-patrona.onrender.com'
const callbackURLLocal = '/auth/google/callback'
passport.use(new GoogleStrategy({
  clientID: '547108669206-gt688r7nm2186tetj2jopln6nhghsmr5.apps.googleusercontent.com',
  clientSecret: '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',
  //callbackURL: urlRender + callbackURLLocal
  callbackURL: callbackURLLocal
}, async (accessToken, refreshToken, profile, done) => {
  // Aquí puedes guardar al usuario en tu base de datos
    try {
      // Buscar usuario por ID de Google
      let user = await db_support.usersDB.findOne({ googleId: profile.id });

      if (user === undefined) {
        console.log('User undefined');
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
          pagos: null
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
app.use(express.static(__dirname + '/public'))
app.use(express.static(__dirname + '/src'))
app.use(express.static(__dirname + '/views'))

app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'Peroconrespeto', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');


// Ruta para la página "hello world" (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Validar credenciales aquí...
    // Aquí podrías validar contra una base de datos
  if (username === 'admin' && password === '1234') {
    //res.send('Acceso concedido');
    res.redirect('/login');
  } else {
    //res.status(401).send('Credenciales incorrectas');
    res.redirect('/signup');
  }
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'login', 'login.html'));
});

app.get('/login-error', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'login', 'login-error.html'));
});

// Ruta para la página "welcome" (welcome.html)
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'login', 'signup.html'));
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
      fecha_registro: Date.now
    });
  }
  res.json({ user, req:req.user }); // Aquí envías los datos del usuario al frontend
});


app.post('/api/registro', express.json(), (req, res) => {
  // Aquí puedes guardar los datos, enviarlos por correo, etc.

  const registro = req.body;
  console.log('Datos recibidos:', registro);

  // Ruta donde guardar el archivo
  const filePath = path.join(__dirname, 'registros.json');

  db_support.usersDB.findOneAndUpdate(registro)
  .then(userActualizado => {
    console.log('Usuario actualizado:', userActualizado);
  })
  .catch(err => {
    console.error('Error al actualizar usuario:', err);
  });
  // Leer archivo existente y agregar nueva entrada
  fs.readFile(filePath, 'utf8', (err, data) => {
    const registrosPrevios = !err && data ? JSON.parse(data) : [];

    registrosPrevios.push(registro);

    fs.writeFile(filePath, JSON.stringify(registrosPrevios, null, 2), (err) => {
      if (err) {
        console.error('Error al guardar en archivo:', err);
        return res.status(500).json({ error: 'No se pudo guardar en archivo' });
      }

      // Continúa con MongoDB...
    });
  });

  res.json({ status: 'ok', mensaje: 'Registro recibido' });

});

app.get('/api/alumnos', async (req, res) => {
  const { curso, seccion, apellido, nombre } = req.query;

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
    console.log(`cursoDB: ${JSON.stringify(cursoDB)}`);
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
    console.log(`listaCurso: ${JSON.stringify(listaCurso)}`);
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
  scope: ['profile', 'email']
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

app.get('/authenticated', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  //console.log('req.user: ', JSON.stringify(req.user))
  //console.log(JSON.stringify(req))
  //res.render('dashboard', { user: req.user });
  // Send the dashboard.html file as a response
  const dashboardPath = path.join(__dirname, '../views', 'dashboard.html');
  res.sendFile(dashboardPath);
});


// Start the server on port 8080
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
})
