# Instalación por PC

Requisitos: Windows 10 u 11 con internet.

1. Descargar el instalador `Control-de-Preventivos-Dimelco-Setup-x.x.x.exe` (de la sección Releases del repositorio en GitHub) y ejecutarlo. Si Windows SmartScreen pregunta, clic en "Más información" y "Ejecutar de todas formas" (el instalador no está firmado con certificado comercial).
2. Al abrir la app por primera vez pide dos datos, que entrega el administrador:
   URL del proyecto: https://ltgsfgcmznausdotbyqk.supabase.co
   Llave anon: la entrega el administrador (es la llave pública del proyecto; no da acceso a los datos sin usuario y contraseña).
3. Entrar con el correo y la contraseña del usuario. En el primer ingreso conviene cambiar la contraseña inicial (por ahora la cambia el administrador desde el panel de Supabase, Authentication, Users, Reset password).
4. Listo: la pantalla inicial es el Control PM. Lo que grabe cualquier usuario se refleja en los demás PC en segundos.

## Roles

admin: todo, incluido Plan MP, maestro de equipos, usuarios, validar offsets y anular registros.
capturador: captura lecturas y PM y propone cambios de horómetro.
invitado: solo consulta. Ve Control PM, Rutina 40 h e Historial, y puede exportar; no ve las pantallas de captura y la base rechaza cualquier escritura suya.

## Respaldo y continuidad

Los datos viven en Supabase (PostgreSQL en la nube, plan Free). El flujo de GitHub Actions "Mantenimiento de la base" (.github/workflows/mantenimiento.yml) hace dos cosas:

1. Todos los días a las 11:43 UTC ejecuta una consulta real a la base, para que Supabase no pause el proyecto por inactividad (el plan Free pausa tras 7 días sin uso).
2. Cada domingo genera un respaldo completo (tablas de la app y usuarios) y lo guarda en la rama "respaldos" del repositorio, en una carpeta por fecha. El README de esa rama explica cómo restaurar.

El flujo necesita el secreto SUPABASE_DB_URL en Settings, Secrets and variables, Actions. Se puede lanzar a mano desde la pestaña Actions con "Run workflow"; una ejecución manual siempre incluye respaldo.
