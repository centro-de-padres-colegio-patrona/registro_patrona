#!/bin/bash

set -x
set -e

ROOT_PATH=$(dirname "$(readlink -f "$BASH_SOURCE")")

$ROOT_PATH/ngrok_launch_service.sh

#lsof -i :5001

#node index.js
yarn start 2>&1 | tee -a $ROOT_PATH/logs/server.log   #$(date +%Y-%m-%d_%H-%M-%S).log