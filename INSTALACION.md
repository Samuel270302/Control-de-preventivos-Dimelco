# Instalación por PC

Requisitos: Windows 10 u 11 con internet.

1. Descargar el instalador `Preventivos HEMCO Setup x.x.x.exe` (de la sección Releases del repositorio en GitHub) y ejecutarlo. Si Windows SmartScreen pregunta, clic en "Más información" y "Ejecutar de todas formas" (el instalador no está firmado con certificado comercial).
2. Al abrir la app por primera vez pide dos datos, que entrega el administrador:
   URL del proyecto: https://ltgsfgcmznausdotbyqk.supabase.co
   Llave anon: la entrega el administrador (es la llave pública del proyecto; no da acceso a los datos sin usuario y contraseña).
3. Entrar con el correo y la contraseña del usuario. En el primer ingreso conviene cambiar la contraseña inicial (por ahora la cambia el administrador desde el panel de Supabase, Authentication, Users, Reset password).
4. Listo: la pantalla inicial es el Control PM. Lo que grabe cualquier usuario se refleja en los demás PC en segundos.

## Roles

admin: todo, incluido Plan MP, maestro de equipos, usuarios, validar offsets y anular registros.
capturador: captura lecturas y PM y propone cambios de horómetro.

## Respaldo

Los datos viven en Supabase (PostgreSQL en la nube). El plan gratuito no incluye respaldos automáticos; el plan Pro sí los hace a diario. Como respaldo manual, el administrador puede exportar el historial completo a Excel desde la app, o generar un volcado de la base con pg_dump.
