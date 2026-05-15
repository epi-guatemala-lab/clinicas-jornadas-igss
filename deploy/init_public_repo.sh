#!/usr/bin/env bash
# Inicializa el repo público epi-guatemala-lab/clinicas-jornadas-igss
# y lo conecta con el código local. Idempotente: si el repo ya existe
# solo agrega remote y empuja.

set -euo pipefail

LOCAL_FRONT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="epi-guatemala-lab/clinicas-jornadas-igss"

cd "$LOCAL_FRONT"

# 1) Asegurar git init local
[ -d .git ] || git init -b main

# 2) Crear .nojekyll para que GitHub Pages no procese con Jekyll
touch public/.nojekyll

# 3) Workflow de Pages
mkdir -p .github/workflows
cat > .github/workflows/deploy.yml <<'YML'
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: VITE_API_URL=https://igss.mediclic.org/jornadas VITE_BASE_PATH=/clinicas-jornadas-igss/ npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
YML

# 4) Commit inicial
git add -A
git commit -m "feat: initial commit Jornadas IGSS (CE + SIPRESALUD) — frontend público" 2>/dev/null || true

# 5) Crear repo público en GitHub si no existe + push
if gh repo view "$REPO" >/dev/null 2>&1; then
    echo "▶ Repo $REPO ya existe, agrego remote …"
else
    echo "▶ Creando repo público $REPO …"
    gh repo create "$REPO" --public --description "Jornadas SIPRESALUD + Clínicas de Empresa IGSS · Portal interno (no clínico)"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "https://github.com/$REPO.git"
fi
git branch -M main
git push -u origin main

echo "✅ Repo publicado en https://github.com/$REPO"
echo "   GitHub Pages activará automáticamente desde el workflow."
echo "   URL pública: https://epi-guatemala-lab.github.io/clinicas-jornadas-igss/"
