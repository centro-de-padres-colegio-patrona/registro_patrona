#!/bin/bash
set -e

echo "=== Verificación de configuración entre branches ==="

# 1. Node versión
echo "--- Node.js ---"
node -v

# 2. Yarn versión
echo "--- Yarn ---"
yarn -v

# 3. Tipo de módulo en package.json
echo "--- package.json type ---"
grep '"type"' package.json || echo "No se define 'type' en package.json"

# 4. Extensiones de archivos clave
echo "--- Extensiones de archivos ---"
ls src | grep -E "server\.(js|cjs|mjs)"

# 5. Archivos ocultos de configuración
echo "--- Archivos ocultos ---"
ls -a | grep -E "(\.nvmrc|\.node-version|\.babelrc|tsconfig\.json)" || echo "No hay archivos ocultos relevantes"

# 6. Variables de entorno relacionadas con Node
echo "--- Variables de entorno ---"
env | grep NODE || echo "No hay variables NODE definidas"

# 7. Dependencias instaladas
echo "--- Dependencias instaladas ---"
ls node_modules | wc -l
