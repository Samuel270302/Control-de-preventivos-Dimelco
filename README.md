# Respaldos de la base de datos (cifrados)

Los genera cada día el flujo "Mantenimiento de la base". Cada carpeta tiene dos archivos
cifrados con gpg (AES-256); la frase es el valor completo del secreto SUPABASE_DB_URL.

Restaurar en un proyecto Supabase nuevo y vacío:
1. gpg -d AAAA-MM-DD_usuarios.sql.gz.gpg | gunzip | psql "<cadena de conexión>"
2. gpg -d AAAA-MM-DD_public.sql.gz.gpg | gunzip | psql "<cadena de conexión>"
3. Aplicar supabase/migrations/002_rls.sql, 004_columnas_rls.sql y 015_unidades_rls.sql del repositorio.
