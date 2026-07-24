#!/bin/bash

# Salir inmediatamente si ocurre un error
set -e

echo "🧹 Inicializando un nuevo proyecto Yarn..."
# Crea un package.json base con la estructura limpia
yarn init -y

echo "🚀 Instalando las últimas versiones de los paquetes..."

# Yarn buscará la mejor versión disponible para cada librería
yarn add \
  @fdograph/rut-utilities \
  axios \
  bcrypt \
  canvas \
  cors \
  crypto-js \
  dotenv \
  ejs \
  express \
  express-session \
  jimp \
  mercadopago \
  mongoose \
  nodemailer \
  passport \
  passport-google-oauth20 \
  pdfkit \
  qrcode

echo "✅ ¡`package.json` y `yarn.lock` recreados exitosamente con las últimas versiones!"