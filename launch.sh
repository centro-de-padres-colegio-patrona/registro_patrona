#!/bin/bash

set -x
set -e

ROOT_PATH=$(dirname "$(readlink -f "$BASH_SOURCE")")

$ROOT_PATH/ngrok_launch_service.sh


#node index.js
yarn start