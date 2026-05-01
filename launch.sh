#!/bin/bash

set -x
set -e

ngrok service install --config /ruta/a/tu/ngrok.yml
ngrok service start

#node index.js
yarn start