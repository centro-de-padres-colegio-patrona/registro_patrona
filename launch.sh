#!/bin/bash

set -x
set -e

ROOT_PATH=$(dirname "$(readlink -f "$BASH_SOURCE")")

set +e
PREV_INSTANCE=$(lsof -i :5001)
set -e
if [ ! -z "$PREV_INSTANCE" ]; then
    echo "Prev instance: $PREV_INSTANCE"
    echo "Cerrando instancia previa..."
    kill -9 $(echo "$PREV_INSTANCE" | awk 'NR>1 {print $2}')
fi

$ROOT_PATH/ngrok_launch_service.sh

#node index.js

#if [ -f "$ROOT_PATH/logs/server.log" ]; then
#    rm -f "$ROOT_PATH/logs/server.log"
#fi

echo "Iniciando servidor de desarrollo..."
echo "Los logs se guardarán en: $ROOT_PATH/logs/server.log"
yarn start 2>&1 | tee $ROOT_PATH/logs/server.log   #$(date +%Y-%m-%d_%H-%M-%S).log