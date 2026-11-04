#!/usr/bin/env python3
"""Arma un Excel con todas las tablas de registros y, con --enviar, lo manda por correo.

Hojas: Resumen, Control PM, Lecturas, Registros PM, Cambios horómetro, Registros manuales,
Anulados, Equipos y componentes, Planes MP.

Uso:
    python3 tools/reporte_registros.py --salida registros.xlsx [--dsn ...] [--enviar]

--dsn toma por defecto la variable DB_URL. --enviar usa Gmail (smtp.gmail.com, puerto 465)
con las variables CORREO_REPORTE (cuenta que envía y recibe) y CORREO_CLAVE_APP (contraseña
de aplicación de esa cuenta).
"""
import argparse
import datetime as dt
import decimal
import os
import smtplib
import ssl
from email.message import EmailMessage

import openpyxl
import psycopg2
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

APP = "Control de Preventivos - Dimelco"
OSCURO = PatternFill("solid", fgColor="252525")
LETRA_ENCABEZADO = Font(bold=True, color="F5B301")

# Cada hoja: (nombre, consulta, [(encabezado, ancho, formato)])
EQ = """join componentes c on c.id = x.componente_id
        join equipos e on e.id = c.equipo_id
        join unidades u on u.id = e.unidad_id"""
NOMBRE = "(select nombre from perfiles p where p.user_id = {})"
HOJAS = [
    ("Control PM", """
        select unidad, cod_interno, cod_sap, modelo, nombre, sistema, tipo_horometro, plan_clave,
               fecha_ultimo_pm, gama_ultimo_pm, horometro_ultimo_pm, proxima_gama, meta_acum,
               ultima_lectura_acum, fecha_ultima_lectura, hrs_faltantes, tendencia, fecha_estimada,
               regexp_replace(estado, '^[^[:alpha:]]+', ''), observacion
        from v_control_pm order by unidad, seccion, cod_interno, nombre""",
     [("Unidad", 14, None), ("Cód. equipo", 16, None), ("Cód. interno", 12, None), ("Modelo", 22, None),
      ("Componente", 30, None), ("Sistema", 14, None), ("Horómetro", 14, None), ("Plan MP", 12, None),
      ("Fecha último PM", 12, "dd/mm/yyyy"), ("Gama último PM", 10, None), ("Horómetro último PM", 12, "#,##0.0"),
      ("Próxima gama", 10, None), ("Meta (acum.)", 12, "#,##0.0"), ("Última lectura (acum.)", 12, "#,##0.0"),
      ("Fecha última lectura", 12, "dd/mm/yyyy"), ("Hrs faltantes", 11, "#,##0.0"), ("Tendencia (h/día)", 10, "0.00"),
      ("Fecha estimada", 12, "dd/mm/yyyy"), ("Estado", 18, None), ("Observación", 40, None)]),
    ("Lecturas", f"""
        select u.nombre, e.cod_interno, c.tipo_horometro, c.nombre, x.fecha, x.turno, x.lectura, x.lectura_acum,
               x.horas_intervalo, x.control, x.origen, {NOMBRE.format('x.creado_por')}, x.creado_en at time zone 'America/Managua'
        from v_lecturas x {EQ} order by u.nombre, e.cod_interno, c.tipo_horometro, x.fecha, x.turno""",
     [("Unidad", 14, None), ("Cód. equipo", 16, None), ("Horómetro", 14, None), ("Componente", 30, None),
      ("Fecha", 12, "dd/mm/yyyy"), ("Turno", 8, None), ("Lectura (contador)", 12, "#,##0.0"),
      ("Lectura (acum.)", 12, "#,##0.0"), ("Horas del intervalo", 10, "#,##0.0"), ("Control", 30, None),
      ("Origen", 9, None), ("Capturado por", 22, None), ("Grabado el", 17, "dd/mm/yyyy hh:mm")]),
    ("Registros PM", f"""
        select u.nombre, e.cod_interno, c.tipo_horometro, c.nombre, x.fecha, x.gama, x.lectura, x.lectura_acum,
               x.clase, x.responsable, {NOMBRE.format('x.creado_por')}, x.creado_en at time zone 'America/Managua'
        from v_registros_pm x {EQ} order by u.nombre, e.cod_interno, c.tipo_horometro, x.fecha""",
     [("Unidad", 14, None), ("Cód. equipo", 16, None), ("Horómetro", 14, None), ("Componente", 30, None),
      ("Fecha", 12, "dd/mm/yyyy"), ("Gama", 8, None), ("Lectura (contador)", 12, "#,##0.0"),
      ("Lectura (acum.)", 12, "#,##0.0"), ("Clase", 12, None), ("Responsable", 28, None),
      ("Grabado por", 22, None), ("Grabado el", 17, "dd/mm/yyyy hh:mm")]),
    ("Cambios horómetro", f"""
        select u.nombre, e.cod_interno, c.tipo_horometro, c.nombre, x.vigente_desde, x.offset_h,
               x.ultima_lectura_vieja, x.primera_lectura_nueva, x.metodo, x.fuente, x.estado,
               {NOMBRE.format('x.creado_por')}, x.creado_en at time zone 'America/Managua'
        from cambios_horometro x {EQ} order by u.nombre, e.cod_interno, x.vigente_desde""",
     [("Unidad", 14, None), ("Cód. equipo", 16, None), ("Horómetro", 14, None), ("Componente", 30, None),
      ("Vigente desde", 12, "dd/mm/yyyy"), ("Offset (h)", 11, "#,##0.0"), ("Última lectura vieja", 12, "#,##0.0"),
      ("Primera lectura nueva", 12, "#,##0.0"), ("Método", 30, None), ("Fuente", 30, None), ("Estado", 11, None),
      ("Grabado por", 22, None), ("Grabado el", 17, "dd/mm/yyyy hh:mm")]),
    ("Registros manuales", f"""
        select u.nombre, e.cod_interno, c.tipo_horometro, c.nombre, x.fecha, x.turno, x.turno_texto,
               x.lectura_inicio, x.lectura_final, {NOMBRE.format('x.creado_por')}, x.creado_en at time zone 'America/Managua'
        from registros_manuales x {EQ} order by u.nombre, e.cod_interno, x.fecha, x.turno""",
     [("Unidad", 14, None), ("Cód. equipo", 16, None), ("Horómetro", 14, None), ("Componente", 30, None),
      ("Fecha", 12, "dd/mm/yyyy"), ("Turno", 8, None), ("Turno (texto)", 16, None), ("Lectura inicio", 12, "#,##0.0"),
      ("Lectura final", 12, "#,##0.0"), ("Grabado por", 22, None), ("Grabado el", 17, "dd/mm/yyyy hh:mm")]),
    ("Anulados", f"""
        select 'Lectura', u.nombre, e.cod_interno, c.tipo_horometro, x.fecha, x.turno, null::numeric, x.lectura,
               x.motivo_anulacion, {NOMBRE.format('x.creado_por')}, {NOMBRE.format('x.anulado_por')},
               x.anulado_en at time zone 'America/Managua'
        from lecturas x {EQ} where x.anulada
        union all
        select 'PM', u.nombre, e.cod_interno, c.tipo_horometro, x.fecha, null, x.gama, x.lectura,
               x.motivo_anulacion, {NOMBRE.format('x.creado_por')}, {NOMBRE.format('x.anulado_por')},
               x.anulado_en at time zone 'America/Managua'
        from registros_pm x {EQ} where x.anulado
        order by 2, 3, 5""",
     [("Tipo", 9, None), ("Unidad", 14, None), ("Cód. equipo", 16, None), ("Horómetro", 14, None),
      ("Fecha", 12, "dd/mm/yyyy"), ("Turno", 8, None), ("Gama", 8, None), ("Lectura", 12, "#,##0.0"),
      ("Motivo", 40, None), ("Grabado por", 22, None), ("Anulado por", 22, None), ("Anulado el", 17, "dd/mm/yyyy hh:mm")]),
    ("Equipos y componentes", """
        select u.nombre, e.cod_interno, e.cod_sap, e.modelo, e.fecha_inicio_operacion, e.activo,
               c.tipo_horometro, c.nombre, c.sistema, c.cod_sap, c.plan_clave, c.aplica_rutina40, c.activo
        from equipos e join unidades u on u.id = e.unidad_id
        left join componentes c on c.equipo_id = e.id
        order by u.orden, e.cod_interno, c.seccion, c.nombre""",
     [("Unidad", 14, None), ("Cód. equipo", 16, None), ("Cód. interno", 12, None), ("Modelo", 22, None),
      ("Inicio operación", 12, "dd/mm/yyyy"), ("Equipo activo", 9, None), ("Horómetro", 14, None),
      ("Componente", 30, None), ("Sistema", 14, None), ("Cód. interno componente", 14, None),
      ("Plan MP", 12, None), ("Rutina 40 h", 9, None), ("Componente activo", 10, None)]),
    ("Planes MP", """
        select clave, sistema, componente_desc, intervalo_h, array_to_string(ciclo_gamas, ' - '),
               dias_programar, dias_verificar, base_sin_pm, kits_sap, observaciones
        from planes_mp order by orden""",
     [("Clave", 14, None), ("Sistema", 14, None), ("Componente / modelo", 30, None), ("Intervalo (h)", 10, None),
      ("Ciclo de gamas", 40, None), ("Programar ≤ (días)", 10, None), ("Verificar repuestos ≤ (días)", 12, None),
      ("Base sin PM (h)", 10, None), ("Kit de mantenimiento", 30, None), ("Observaciones", 40, None)]),
]


def valor(v):
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, bool):
        return "Sí" if v else "No"
    if isinstance(v, dt.datetime):
        return v.replace(tzinfo=None)
    return v


def hoja(wb, nombre, filas, columnas):
    ws = wb.create_sheet(nombre)
    ws.append([c[0] for c in columnas])
    for celda in ws[1]:
        celda.fill, celda.font = OSCURO, LETRA_ENCABEZADO
        celda.alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[1].height = 32
    for f in filas:
        ws.append([valor(v) for v in f])
    for i, (_, ancho, formato) in enumerate(columnas, start=1):
        letra = get_column_letter(i)
        ws.column_dimensions[letra].width = ancho
        if formato:
            for (celda,) in ws.iter_rows(min_row=2, min_col=i, max_col=i):
                celda.number_format = formato
    ws.freeze_panes = "C2" if nombre != "Planes MP" else "B2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(columnas))}{max(ws.max_row, 1)}"
    return len(filas)


def armar(dsn, salida):
    con = psycopg2.connect(dsn)
    cur = con.cursor()
    cur.execute("set time zone 'America/Managua'")
    wb = openpyxl.Workbook()
    resumen = wb.active
    resumen.title = "Resumen"
    conteos = []
    for nombre, consulta, columnas in HOJAS:
        cur.execute(consulta)
        conteos.append((nombre, hoja(wb, nombre, cur.fetchall(), columnas)))
    cur.execute("""select u.nombre, count(distinct e.id), count(distinct c.id),
                          (select count(*) from lecturas l join componentes c2 on c2.id = l.componente_id
                           join equipos e2 on e2.id = c2.equipo_id where e2.unidad_id = u.id and not l.anulada),
                          (select max(l.fecha) from lecturas l join componentes c2 on c2.id = l.componente_id
                           join equipos e2 on e2.id = c2.equipo_id where e2.unidad_id = u.id and not l.anulada)
                   from unidades u left join equipos e on e.unidad_id = u.id
                   left join componentes c on c.equipo_id = e.id
                   group by u.id, u.nombre, u.orden order by u.orden""")
    por_unidad = cur.fetchall()
    con.close()

    hoy = dt.datetime.now(dt.timezone(dt.timedelta(hours=-6)))
    resumen["A1"] = f"{APP} · registros al {hoy:%d/%m/%Y %H:%M} (hora de Nicaragua)"
    resumen["A1"].font = Font(bold=True, size=13)
    resumen.append([])
    resumen.append(["Hoja", "Filas"])
    for nombre, n in conteos:
        resumen.append([nombre, n])
    resumen.append([])
    resumen.append(["Unidad", "Equipos", "Horómetros", "Lecturas válidas", "Última lectura"])
    for f in por_unidad:
        resumen.append([valor(v) for v in f])
        resumen.cell(resumen.max_row, 5).number_format = "dd/mm/yyyy"
    for fila in (3, 4 + len(conteos) + 1):
        for celda in resumen[fila]:
            if celda.value is not None:
                celda.fill, celda.font = OSCURO, LETRA_ENCABEZADO
    for letra, ancho in zip("ABCDE", (24, 10, 12, 16, 14)):
        resumen.column_dimensions[letra].width = ancho
    wb.save(salida)
    return hoy, conteos, por_unidad


def enviar(ruta, hoy, conteos, por_unidad):
    cuenta, clave = os.environ["CORREO_REPORTE"], os.environ["CORREO_CLAVE_APP"].replace(" ", "")
    m = EmailMessage()
    m["Subject"] = f"{APP}: registros al {hoy:%d/%m/%Y}"
    m["From"], m["To"] = f"{APP} <{cuenta}>", cuenta
    lineas = [f"Registros de {APP} al {hoy:%d/%m/%Y %H:%M} (hora de Nicaragua).", ""]
    lineas += [f"{n}: {c} filas" for n, c in conteos]
    lineas += ["", "Por unidad (equipos, horómetros, lecturas válidas, última lectura):"]
    lineas += [f"{u}: {e}, {c}, {l}, {f:%d/%m/%Y}" if f else f"{u}: {e}, {c}, {l}, sin lecturas"
               for u, e, c, l, f in por_unidad]
    lineas += ["", "El respaldo completo cifrado sigue guardándose cada día en la rama respaldos de GitHub."]
    m.set_content("\n".join(lineas))
    with open(ruta, "rb") as f:
        m.add_attachment(f.read(), maintype="application",
                         subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                         filename=os.path.basename(ruta))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=60) as s:
        s.login(cuenta, clave)
        s.send_message(m)
    print("Correo enviado")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", required=True)
    ap.add_argument("--dsn", default=os.environ.get("DB_URL"))
    ap.add_argument("--enviar", action="store_true")
    a = ap.parse_args()
    hoy, conteos, por_unidad = armar(a.dsn, a.salida)
    for n, c in conteos:
        print(f"{n}: {c} filas")
    if a.enviar:
        enviar(a.salida, hoy, conteos, por_unidad)


if __name__ == "__main__":
    main()
