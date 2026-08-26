const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');


const SECRET_API_KEY = config_env.API_KEY;


