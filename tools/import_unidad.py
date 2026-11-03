#!/usr/bin/env python3
"""Carga la flota de una unidad minera sin tocar las demás.

Uso:
    python3 tools/import_unidad.py explotec <libro.xlsx> [--dsn ...]
    python3 tools/import_unidad.py veta-nueva tools/datos/veta_nueva_s43.csv [--dsn ...]

Explotec: libro "Registro de tiempos de paro - EXPLOTEC" (hojas Parametros,
Horometros y Registro PM). Veta Nueva: archivo de arranque armado desde el reporte
semanal (último PM y horómetro actual por equipo).

Reemplaza los equipos, componentes, lecturas y PM de esa unidad; los planes de
tools/datos/planes_unidades.json se crean o actualizan por clave.
"""
import argparse
import csv
import datetime as dt
import json
import os

import openpyxl
import psycopg2

DSN_LOCAL = "host=/home/user/.pgrun port=5433 user=dev dbname=hemco"
DATOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "datos")

# Explotec: equipos fuera de servicio al cargar (bitácora del libro), quedan inactivos.
EXPLOTEC_INACTIVOS = {"B1-24": "fuera de servicio desde el 01/09/2026"}

# Fecha y turno de la lectura de arranque de Veta Nueva (cierre de la semana 43).
ARRANQUE_VN = (dt.date(2026, 10, 25), "Noche")


def num(v):
    if v is None or v == "":
        return None
    return float(v)


def fecha(v):
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    if isinstance(v, str) and v.strip():
        return dt.date.fromisoformat(v.strip())
    return None


def turno(v):
    t = str(v or "").strip().lower()
    return {"dia": "Dia", "día": "Dia", "noche": "Noche"}.get(t)


def cargar_planes(cur, claves):
    with open(os.path.join(DATOS, "planes_unidades.json"), encoding="utf-8") as f:
        planes = [p for p in json.load(f) if p["clave"] in claves]
    for p in planes:
        cur.execute(
            """insert into planes_mp (clave, sistema, componente_desc, aplica_a, tipo_horometro_desc,
                 intervalo_h, ciclo_gamas, dias_programar, dias_verificar, observaciones, orden)
               values (%(clave)s, %(sistema)s, %(componente_desc)s, %(aplica_a)s, %(tipo_horometro_desc)s,
                 %(intervalo_h)s, %(ciclo_gamas)s, %(dias_programar)s, %(dias_verificar)s, %(observaciones)s,
                 (select coalesce(max(orden), 0) + 1 from planes_mp))
               on conflict (clave) do update set sistema = excluded.sistema,
                 componente_desc = excluded.componente_desc, aplica_a = excluded.aplica_a,
                 tipo_horometro_desc = excluded.tipo_horometro_desc, intervalo_h = excluded.intervalo_h,
                 ciclo_gamas = excluded.ciclo_gamas, dias_programar = excluded.dias_programar,
                 dias_verificar = excluded.dias_verificar, observaciones = excluded.observaciones""",
            p)
    return {p["clave"]: p for p in planes}


def vaciar_unidad(cur, nombre):
    cur.execute("select id from unidades where nombre = %s", (nombre,))
    fila = cur.fetchone()
    if not fila:
        raise SystemExit(f"No existe la unidad {nombre}: aplique antes 014_unidades.sql")
    unidad = fila[0]
    cur.execute("""
        create temp table comp_unidad on commit drop as
          select c.id from componentes c join equipos e on e.id = c.equipo_id where e.unidad_id = %(u)s;
        delete from registros_manuales where componente_id in (select id from comp_unidad);
        delete from lecturas where componente_id in (select id from comp_unidad);
        delete from registros_pm where componente_id in (select id from comp_unidad);
        delete from cambios_horometro where componente_id in (select id from comp_unidad);
        delete from componentes where id in (select id from comp_unidad);
        delete from equipos where unidad_id = %(u)s;
    """, {"u": unidad})
    return unidad


def triggers(cur, activar):
    # El histórico se carga tal cual, igual que en tools/import_excel.py.
    accion = "enable" if activar else "disable"
    cur.execute(f"""
        do $$ begin
          if exists (select 1 from pg_trigger where tgname = 'validar_registro_pm') then
            alter table registros_pm {accion} trigger validar_registro_pm;
          end if;
          if exists (select 1 from pg_trigger where tgname = 'validar_lectura') then
            alter table lecturas {accion} trigger validar_lectura;
          end if;
        end $$;""")


def equipo(cur, unidad, cod, modelo, inicio=None):
    cur.execute(
        """insert into equipos (cod_interno, modelo, fecha_inicio_operacion, unidad_id)
           values (%s, %s, %s, %s) returning id""", (cod, modelo, inicio, unidad))
    return cur.fetchone()[0]


def componente(cur, equipo_id, tipo, nombre, sistema, seccion, plan):
    cur.execute(
        """insert into componentes (equipo_id, tipo_horometro, nombre, sistema, seccion, plan_clave)
           values (%s, %s, %s, %s, %s, %s) returning id""",
        (equipo_id, tipo, nombre, sistema, seccion, plan))
    return cur.fetchone()[0]


def explotec(cur, ruta, avisos):
    wb = openpyxl.load_workbook(ruta, data_only=True, read_only=True)
    unidad = vaciar_unidad(cur, "Explotec")
    cargar_planes(cur, {"DIESEL-EXP"})

    # Plan del libro (Parametros M:W) contra el de planes_unidades.json
    ws = wb["Parametros"]
    filas = list(ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=23, values_only=True))
    plan_libro = [f for f in filas if f[12] == "Motor Diésel"][0]
    gamas = [g for g in plan_libro[15:23] if g is not None]
    if gamas != [250, 500, 750, 1000, 250, 500, 750, 2000] or plan_libro[13] != 250:
        avisos.append(f"El plan diésel del libro cambió: intervalo {plan_libro[13]}, gamas {gamas}")

    # Equipos: Parametros F:I (código, modelo, inicio de operación, control perforadora)
    equipos, comps = {}, {}
    lecturas_perf = set()
    hor = wb["Horometros"]
    filas_hor = [f for f in hor.iter_rows(min_row=2, max_col=5, values_only=True) if f[0] is not None]
    for f in filas_hor:
        if str(f[3]).strip().lower().startswith("percusi"):
            lecturas_perf.add(str(f[1]).strip().upper())
    for f in filas[1:]:
        cod = f[5]
        if not cod:
            continue
        cod = str(cod).strip().upper()
        equipos[cod] = equipo(cur, unidad, cod, str(f[6]).strip(), fecha(f[7]))
        if cod in EXPLOTEC_INACTIVOS:
            cur.execute("update equipos set activo = false where id = %s", (equipos[cod],))
            avisos.append(f"{cod}: queda inactivo, {EXPLOTEC_INACTIVOS[cod]}")
        comps[(cod, "Diesel")] = componente(cur, equipos[cod], "Diesel", "Motor Diésel", "Motor Diésel", 1, "DIESEL-EXP")
        # Horómetro de perforación: los marcados "Sí" y los que tienen lecturas de percusión.
        if str(f[8]).strip().lower() in ("sí", "si") or cod in lecturas_perf:
            comps[(cod, "Percusión #1")] = componente(
                cur, equipos[cod], "Percusión #1", "Perforadora", "Perforadora", 3, None)
    print(f"equipos: {len(equipos)} · componentes: {len(comps)}")

    # Lecturas: hoja Horometros (fecha, equipo, turno, tipo, lectura).
    # Una lectura de perforación mayor que todo el horómetro diésel del equipo no es posible
    # (el martillo trabaja menos horas que el motor): no se carga y se informa.
    max_diesel = {}
    for f in filas_hor:
        if str(f[3]).strip().lower() == "diesel" and f[4] is not None:
            cod = str(f[1]).strip().upper()
            max_diesel[cod] = max(max_diesel.get(cod, 0), float(f[4]))
    vistas = {}
    for i, f in enumerate(filas_hor, start=2):
        cod = str(f[1]).strip().upper()
        tipo = "Diesel" if str(f[3]).strip().lower() == "diesel" else "Percusión #1"
        comp = comps.get((cod, tipo))
        t = turno(f[2])
        if comp is None or t is None or f[4] is None:
            avisos.append(f"Horometros fila {i}: sin componente, turno o lectura ({cod}, {f[3]}, {f[2]})")
            continue
        if tipo == "Percusión #1" and float(f[4]) > max_diesel.get(cod, float("inf")):
            avisos.append(f"Horometros fila {i}: {cod} perforación {f[4]} h mayor que su diésel ({max_diesel[cod]} h); no se carga")
            continue
        clave = (comp, fecha(f[0]), t)
        if clave in vistas:
            avisos.append(f"Horometros fila {i}: duplicada con la fila {vistas[clave]} ({cod} {f[0]:%d/%m/%Y} {t}); se usa la primera")
            continue
        vistas[clave] = i
        cur.execute(
            """insert into lecturas (componente_id, fecha, turno, lectura, origen)
               values (%s, %s, %s, %s, 'import')""", (comp, fecha(f[0]), t, float(f[4])))
    print(f"lecturas: {len(vistas)}")

    # PM: hoja Registro PM (fecha, equipo, modelo, sistema, gama, h. diésel, h. perf., responsable)
    n = 0
    for i, f in enumerate(wb["Registro PM"].iter_rows(min_row=2, max_col=8, values_only=True), start=2):
        if f[0] is None:
            continue
        cod = str(f[1]).strip().upper()
        if f[3] != "Motor Diésel":
            avisos.append(f"Registro PM fila {i}: sistema {f[3]} no cargado")
            continue
        cur.execute(
            """insert into registros_pm (componente_id, fecha, gama, lectura, responsable)
               values (%s, %s, %s, %s, %s)""",
            (comps[(cod, "Diesel")], fecha(f[0]), num(f[4]), num(f[5]), f[7]))
        n += 1
        if f[6] is not None:
            avisos.append(f"Registro PM fila {i}: {cod} trae H. Perf. {f[6]} en un PM diésel; no se carga como lectura")
    print(f"registros_pm: {n}")


def veta_nueva(cur, ruta, avisos):
    unidad = vaciar_unidad(cur, "Veta Nueva")
    cargar_planes(cur, {"DIESEL-VN"})
    fecha_lect, turno_lect = ARRANQUE_VN
    n = 0
    with open(ruta, encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            cod = fila["cod_interno"].strip()
            eq = equipo(cur, unidad, cod, fila["modelo"].strip())
            comp = componente(cur, eq, "Diesel", "Motor Diésel", "Motor Diésel", 1, "DIESEL-VN")
            cur.execute(
                """insert into registros_pm (componente_id, fecha, gama, lectura, responsable)
                   values (%s, %s, %s, %s, 'Reporte semana 43')""",
                (comp, fecha(fila["fecha_ultimo_pm"]), num(fila["gama_ultimo_pm"]),
                 num(fila["horometro_ultimo_pm"])))
            cur.execute(
                """insert into lecturas (componente_id, fecha, turno, lectura, origen)
                   values (%s, %s, %s, %s, 'import')""",
                (comp, fecha_lect, turno_lect, num(fila["lectura_actual"])))
            if fila["nota"]:
                avisos.append(f"{cod}: {fila['nota']}")
            n += 1
    print(f"equipos: {n} (un horómetro Diesel cada uno, lectura de arranque {fecha_lect:%d/%m/%Y} {turno_lect})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("unidad", choices=["explotec", "veta-nueva"])
    ap.add_argument("archivo")
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", DSN_LOCAL))
    args = ap.parse_args()

    con = psycopg2.connect(args.dsn)
    cur = con.cursor()
    avisos = []
    triggers(cur, False)
    if args.unidad == "explotec":
        explotec(cur, args.archivo, avisos)
    else:
        veta_nueva(cur, args.archivo, avisos)
    triggers(cur, True)
    con.commit()
    if avisos:
        print(f"\nAvisos ({len(avisos)}):")
        for a in avisos:
            print(" -", a)


if __name__ == "__main__":
    main()
