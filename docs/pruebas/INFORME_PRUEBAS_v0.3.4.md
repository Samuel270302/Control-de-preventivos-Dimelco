# Informe de pruebas · Preventivos HEMCO v0.3.4

Fecha: 29/10/2026. Base de datos: proyecto Supabase de producción. App: instalador v0.3.4 (Electron 33).

## 1. Qué se probó y cómo

| Prueba | Método | Resultado |
|---|---|---|
| Permisos por usuario en la base | Cada uno de los 4 usuarios reales ejecuta 17 acciones en producción dentro de transacciones que se deshacen; no queda ningún dato | 68 de 68 según diseño |
| Recorrido por rol en la app | `tests/electron_roles.mjs`: Electron real, Supabase simulado, roles admin, capturador e invitado | 81 de 81 |
| Funciones de escritorio | `tests/electron.mjs`: editor del plan, Anular (Registro PM e Historial), reporte PDF, exportar a Excel, columnas, gráficas, lecturas | 9 de 9 |
| Cálculos contra el libro Excel | `tools/validate_control.py`, corte 22/10/2026 | 46 filas, 0 diferencias |
| Control de lecturas en registros PM | Casos de lectura menor, horas imposibles, PM atrasado, sin lectura y con offset | Rechaza y acepta según regla |
| Tiempo real | Dos sesiones reales (admin e invitado); un cambio sin efecto en datos | Aviso recibido en 0,5 s |
| Rendimiento | EXPLAIN ANALYZE en la base y tiempo total desde la nube de pruebas | 80 a 100 ms en la base; 0,6 a 1,3 s con red |
| Calidad de datos reales | Consultas sobre lo capturado desde la puesta en marcha | Ver hallazgos H3 y H4 |
| Configuración de Supabase | API de administración | Ver hallazgo H1 |

## 2. Matriz de permisos verificada en producción

| Acción | Admin | Capturador | Invitado |
|---|---|---|---|
| Ver controles, lecturas, historial y gráficas | Sí | Sí | Sí |
| Grabar lecturas, registros PM y cambios de horómetro | Sí | Sí | No |
| Anular lecturas y registros PM | Sí | No | No |
| Validar cambios de horómetro | Sí | No | No |
| Editar plan MP, parámetros, columnas visibles | Sí | No | No |
| Crear equipos, activar o desactivar componentes | Sí | No | No |
| Cambiar roles | Sí | No | No |
| Borrar registros físicamente | Sí (solo vía base; ver H6) | No | No |

## 3. Hallazgos

| ID | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| H1 | Alta | El registro abierto de cuentas está activo (`disable_signup = false`) y la función `crear_perfil` asigna rol capturador a toda cuenta nueva. Quien tenga la llave anon (instalada en cada PC) y un correo propio puede crearse una cuenta capturador. | Configuración de autenticación del proyecto |
| H2 | Media | La validación de lecturas compara el contador crudo, no el acumulado. Si se instala un horómetro de reemplazo usado (por ejemplo con 300 h), la lectura se marca "Horas imposibles" y no se puede grabar aunque el offset esté registrado. La tendencia sumaría esas 300 h como trabajadas. | Revisión de `src/lib/validacion.ts` y de la vista `v_lecturas` |
| H3 | Media | Registros PM con lectura incorrecta en producción: Boomer #1 Percusión #1 del 25/10 (1.294,2), Simba #2 Percusión #1 del 22/10 (1.693, es el acumulado) y del 25/09 (1.226). Hay además 7 registros PM sin gama, que dejan "Validar gama" en el control. | Control de PM ejecutado sobre los datos reales |
| H4 | Media | 5 componentes llevan más de 7 días sin lectura: Scooptram #3 diésel (21 días), Simba #2 diésel, compresor y perforadora (11 días), Scooptram #4 diésel (8 días). | `v_control_pm` |
| H5 | Baja | Una baja grande por error de digitación (por ejemplo 50 h menos) se informa como "Horas imposibles: 10.868 h en 1 turno", que no orienta al capturador. Es la misma regla del libro. | Prueba en Electron |
| H6 | Baja | La política de administración permite DELETE físico al admin desde la base. La app no lo ofrece, pero contradice la regla de no borrar registros. | Matriz de permisos |
| H7 | Baja | Lecturas y Registro PM toman la última lectura de entre las 1.500 más recientes de toda la flota. Hoy cubren unos 230 días; si la captura crece mucho, un equipo parado largo tiempo figuraría "sin lecturas". | Revisión de código |
| H8 | Decisión pendiente | Instalador sin firma de código: Smart App Control de Windows lo bloquea en algunos PC. | Reporte del usuario |
| H9 | Pendiente | El token de administración de Supabase sigue activo; se usó para estas pruebas. Conviene revocarlo cuando no se requiera. | API de administración |
| H10 | Baja | La ventana, la barra de tareas y el instalador usan el ícono genérico de Electron. | Captura del usuario |

No se encontró ninguna función rota en la v0.3.4.

## 4. Datos de operación al 29/10/2026

29 lecturas capturadas desde la app (26 OK, 3 con aviso de hueco de 9 a 12 días). Control PM: 13 vencidos, 1 por programar, 12 normales, 6 sin PM registrado, 1 sin tendencia. Rutina 40 h: 8 vencidos, 1 por programar, 2 normales. Tamaño de la base: 12 MB de 500 MB.

## 5. Pruebas automáticas disponibles

| Archivo | Qué cubre | Cómo se corre |
|---|---|---|
| `tests/electron.mjs` | 9 funciones de escritorio | `npm run prueba:electron` |
| `tests/electron_roles.mjs` | 81 verificaciones por rol | `npm run build && xvfb-run -a node tests/electron_roles.mjs` |
| `tests/capturas.mjs` | Capturas de todas las pantallas | `node tests/capturas.mjs` |
| `tools/validate_control.py` | Cálculos contra el libro Excel | `python3 tools/validate_control.py <xlsx>` |

Las pruebas de la app usan los datos de `tests/fixtures`, generados con `tools/export_fixtures.py`.
