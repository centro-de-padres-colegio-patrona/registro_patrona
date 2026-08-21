const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Usamos la versión basada en promesas

// Requerir dependencias compartidas necesarias para las entradas
const db_support = require('./db_support'); // Ajustado a la ruta relativa del backend
const apiKeyAuth = require('./apiKeyAuth');
const config_env = require('../src/setup/config/env.js');
const git_branch = require('./git_branch');

const SECRET_API_KEY = config_env.API_KEY;

router.get('/branch/produccion', async (req, res) => {
  const tag = '[GET /api/branch/produccion]';
  try {
    const productionBranch = config_env.GIT_BRANCH_PRODUCTION || 'produccion';
    console.log(`${tag} productionBranch: `, productionBranch);
    res.json({ productionBranch });
  } catch (error) {
    console.error(`${tag} Error: `, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/branch/current', async (req, res) => {
  const tag = '[GET /api/branch/current]';
  try {
    const currentBranch = git_branch.currentBranch;
    console.log(`${tag} currentBranch: `, currentBranch);
    res.json({ currentBranch });
  } catch (error) {
    console.error(`${tag} Error: `, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;