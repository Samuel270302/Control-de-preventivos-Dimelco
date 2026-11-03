#!/usr/bin/env python3
"""Genera el SQL que reemplaza una unidad en otra base, a partir de la base local ya cargada
con tools/import_unidad.py. Sirve para aplicarlo por la API de administración de Supabase
cuando no hay conexión directa al puerto de la base.

Uso:
    python3 tools/exportar_unidad_sql.py "Explotec" > explotec.sql
"""
import argparse
import datetime as dt
import decimal
import json
import os

import psycopg2
import psycopg2.extras

DSN_LOCAL = "host=/home/user/.pgrun port=5433 user=dev dbname=hemco"


class Sql(str):
    """Texto SQL que va tal cual (por ejemplo, una subconsulta)."""


def lit(v):
    if isinstance(v, Sql):
        return str(v)
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float, decimal.Decimal)):
        return str(v)
    if isinstance(v, (dt.date, dt.datetime)):
        return f"'{v.isoformat()}'"
    if isinstance(v, list):
        return "array[" + ",".join(lit(x) for x in v) + "]::numeric[]"
    return "'" + str(v).replace("'", "''") + "'"


def insertar(tabla, filas, columnas):
    if not filas:
        return ""
    valores = ",\n".join("(" + ",".join(lit(f[c]) for c in columnas) + ")" for f in filas)
    return f"insert into {tabla} ({','.join(columnas)}) values\n{valores};\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("unidad")
    ap.add_argument("--dsn", default=os.environ.get("BD_LOCAL", DSN_LOCAL))
    args = ap.parse_args()
    con = psycopg2.connect(args.dsn)
    cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    u = args.unidad.replace("'", "''")

    cur.execute("""select e.* from equipos e join unidades u on u.id = e.unidad_id where u.nombre = %s""", (args.unidad,))
    equipos = cur.fetchall()
    ids_eq = [e["id"] for e in equipos]
    cur.execute("select * from componentes where equipo_id = any(%s::uuid[])", (ids_eq,))
    comps = cur.fetchall()
    ids_c = [c["id"] for c in comps]
    planes = sorted({c["plan_clave"] for c in comps if c["plan_clave"]})
    cur.execute("select * from planes_mp where clave = any(%s)", (planes,))
    planes_f = cur.fetchall()
    cur.execute("select * from lecturas where componente_id = any(%s::uuid[]) and not anulada", (ids_c,))
    lecturas = cur.fetchall()
    cur.execute("select * from registros_pm where componente_id = any(%s::uuid[]) and not anulado", (ids_c,))
    pms = cur.fetchall()

    sel_u = f"(select id from unidades where nombre = '{u}')"
    for e in equipos:
        e["unidad_id"] = Sql(sel_u)  # se resuelve por nombre en la base de destino
    out = [f"-- Unidad {args.unidad}: {len(equipos)} equipos, {len(comps)} componentes, "
           f"{len(lecturas)} lecturas, {len(pms)} PM. Generado desde la base local.\n"]
    out.append("begin;\n")
    out.append(f"""create temp table comp_unidad on commit drop as
  select c.id from componentes c join equipos e on e.id = c.equipo_id where e.unidad_id = {sel_u};
delete from registros_manuales where componente_id in (select id from comp_unidad);
delete from lecturas where componente_id in (select id from comp_unidad);
delete from registros_pm where componente_id in (select id from comp_unidad);
delete from cambios_horometro where componente_id in (select id from comp_unidad);
delete from componentes where id in (select id from comp_unidad);
delete from equipos where unidad_id = {sel_u};
alter table registros_pm disable trigger validar_registro_pm;
alter table lecturas disable trigger validar_lectura;
""")
    cols_p = ["clave", "sistema", "componente_desc", "aplica_a", "tipo_horometro_desc", "intervalo_h",
              "ciclo_gamas", "dias_programar", "dias_verificar", "base_sin_pm", "observaciones", "orden"]
    for p in planes_f:
        out.append(insertar("planes_mp", [p], cols_p).rstrip(";\n") +
                   "\non conflict (clave) do update set " +
                   ", ".join(f"{c} = excluded.{c}" for c in cols_p[1:] if c != "orden") + ";\n")
    cols_e = ["id", "cod_interno", "cod_sap", "modelo", "fecha_inicio_operacion", "activo", "unidad_id"]
    out.append(insertar("equipos", equipos, cols_e))
    out.append(insertar("componentes", comps, ["id", "equipo_id", "tipo_horometro", "nombre", "sistema", "seccion",
                                                "cod_sap", "plan_clave", "aplica_rutina40", "lectura_manual", "activo"]))
    out.append(insertar("lecturas", lecturas, ["id", "componente_id", "fecha", "turno", "lectura", "origen"]))
    out.append(insertar("registros_pm", pms, ["id", "componente_id", "fecha", "gama", "lectura", "responsable"]))
    out.append("alter table registros_pm enable trigger validar_registro_pm;\n"
               "alter table lecturas enable trigger validar_lectura;\n"
               "commit;\n")
    print("".join(out))


if __name__ == "__main__":
    main()
