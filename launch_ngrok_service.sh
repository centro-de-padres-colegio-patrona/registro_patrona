#!/bin/bash

set -e
set -x


# Configuración
ROOT_PATH=$(dirname "$(readlink -f "$BASH_SOURCE")")
CONFIG_PATH="${ROOT_PATH}/ngrok.yml"
SERVICE_NAME="ngrok"

echo "--- Verificando estado de ngrok ---"

# 1. Verificar si el servicio está instalado en systemd
if systemctl list-unit-files | grep -q "^$SERVICE_NAME.service"; then
    echo "[✔] El servicio ya está instalado."
    
    # 2. Verificar si ya está corriendo
    if systemctl is-active --quiet $SERVICE_NAME; then
        echo "[✔] El servicio ya está en ejecución. No hay nada que hacer."
    else
        echo "[!] El servicio existe pero está detenido. Arrancando..."
        sudo ngrok service start
    fi
else
    echo "[+] El servicio no está instalado. Procediendo con la instalación..."
    
    # 3. Validar si el archivo de configuración existe antes de instalar
    if [ -f "$CONFIG_PATH" ]; then
        sudo ngrok service install --config "$CONFIG_PATH"
        sudo ngrok service start
        echo "[✔] Servicio instalado y arrancado con éxito."
    else
        echo "[✘] ERROR: El archivo de configuración en $CONFIG_PATH no existe."
        exit 1
    fi
fi

echo "--- Proceso finalizado ---"