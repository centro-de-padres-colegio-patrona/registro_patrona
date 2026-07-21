// ./backend/apiKeyAuth.js

const config_env = require('./setup/config/env.js');


const API_KEY_SECRET = config_env.API_KEY;


const apiKeyAuth = (req, res, next) => {
  // Permite enviar la API key vía cabecera ('x-api-key') o por query params ('?api_key=...')
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey || apiKey !== API_KEY_SECRET) {
    return res.status(401).json({ error: 'Acceso no autorizado: API Key inválida o no provista' });
  }

  next(); // Si la API key es correcta, continua hacia el endpoint
};

module.exports = apiKeyAuth;
