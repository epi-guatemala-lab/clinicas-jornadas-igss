#!/usr/bin/env bash
# Compila el frontend con base path /clinicas-jornadas/ y lo sube al server.

set -euo pipefail

# Este repo es PUBLICO: nunca poner acá una contraseña, una IP interna ni un
# host real, ni siquiera como valor por defecto. Se pasan por variable de
# entorno al invocar, y el script falla si faltan en vez de traer un default.
#
#   SERVER=root@<host> SSHPASS='<clave>' ./deploy/build_and_upload_frontend.sh
#
# (Una credencial de producción vivió acá desde may-2026 hasta ago-2026.)
: "${SERVER:?falta SERVER — ej: SERVER=root@mi-host}"
: "${SSHPASS:?falta SSHPASS — pasala por entorno, nunca la escribas en el repo}"
LOCAL_FRONT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ Build con base /clinicas-jornadas/ + API en /jornadas/api"
cd "$LOCAL_FRONT"
VITE_API_URL=https://igss.mediclic.org/jornadas \
VITE_BASE_PATH=/clinicas-jornadas/ \
    npm run build

echo "▶ Tar + scp …"
tar czf /tmp/clinicas-jornadas-frontend.tgz -C "$LOCAL_FRONT/dist" .
sshpass -p "$SSHPASS" scp -o StrictHostKeyChecking=no \
    /tmp/clinicas-jornadas-frontend.tgz "$SERVER:/tmp/"

sshpass -p "$SSHPASS" ssh "$SERVER" "
    mkdir -p /opt/jornadas-igss/frontend
    rm -rf /opt/jornadas-igss/frontend/*
    tar xzf /tmp/clinicas-jornadas-frontend.tgz -C /opt/jornadas-igss/frontend/
    ls /opt/jornadas-igss/frontend/ | head -5
"
echo "✅ Frontend en /opt/jornadas-igss/frontend/ (servido por nginx en /clinicas-jornadas/)"
