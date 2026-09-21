#!/bin/bash
# Post-merge setup: runs automatically after a task merge (stdin closed, non-interactive).
set -e

pnpm install --frozen-lockfile

# NO ejecutamos `drizzle-kit push` aquí: el esquema de la BD se mantiene con migraciones
# SQL idempotentes (ensureMigration) que corren al arrancar api-server, y varias tablas/columnas
# existen solo en la BD. `push` pide confirmación interactiva de pérdida de datos (borraría
# tablas reales) y `push --force` las destruiría. Si hace falta aplicar un cambio de esquema
# nuevo de drizzle, revisarlo a mano: cd lib/db && pnpm run push
echo "DB: esquema gestionado por migraciones SQL en el arranque de api-server (drizzle push omitido a propósito)."
