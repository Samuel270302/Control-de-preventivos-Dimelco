# Preventivos HEMCO

Aplicación de escritorio (Windows) para el control de mantenimiento preventivo por horómetros de la flota HEMCO. Reemplaza el libro "Registro de horometros HEMCO v2.xlsx" conservando su lógica: lecturas por turno, acumulados por offset, ciclo de gamas, proyección de próximos PM y rutina de percusión de 40 h.

## Arquitectura

Electron + React + TypeScript. Base de datos PostgreSQL en Supabase compartida por 2 a 4 usuarios, con autenticación por correo y actualización en tiempo real. Los cálculos del control viven en vistas SQL (`supabase/migrations/001_schema.sql`); la app captura y presenta.

## Estructura

    supabase/migrations/   esquema, vistas de cálculo y políticas por rol
    electron/              proceso principal de Electron
    src/                   interfaz React (pantallas en src/pages)
    tools/                 importador del Excel, validador de cálculos, fixtures
    tests/capturas.mjs     prueba visual con Supabase simulado

## Comandos

    npm install            dependencias
    npm run dev            interfaz en modo desarrollo (navegador)
    npm run build          compila renderer y proceso principal
    npm run dist           instalador de Windows (requiere compilar en Windows o con wine)

## Validación de cálculos

Con PostgreSQL local:

    psql -f supabase/migrations/001_schema.sql
    python3 tools/import_excel.py "Registro de horometros HEMCO v2.xlsx" --fecha-ref 2026-10-22
    python3 tools/validate_control.py "Registro de horometros HEMCO v2.xlsx"

El validador compara las vistas `v_control_pm` y `v_control_40` contra las hojas Control PM y Control MP 40h del libro, campo por campo. Al corte del 22/10/2026: 46 filas, 0 diferencias.

## Puesta en marcha

1. Crear proyecto en supabase.com y aplicar las migraciones 001 y 002.
2. Importar el histórico con `tools/import_excel.py --dsn <cadena de conexión del proyecto>` (sin `--fecha-ref`).
3. Crear los usuarios en Authentication → Users; el disparador crea su perfil como capturador y el administrador ajusta roles en la pantalla Usuarios.
4. En cada PC, instalar la app y capturar URL del proyecto y llave anon en la primera pantalla.
