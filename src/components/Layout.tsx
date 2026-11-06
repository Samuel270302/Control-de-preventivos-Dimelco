import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEsMovil } from "../lib/movil";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import { useEstadoConexion } from "../lib/conexion";
import { lecturasPendientes, marcarPendientes } from "../lib/pendientes";
import DialogoConfirmar from "./DialogoConfirmar";
import DialogoContrasena from "./DialogoContrasena";
import AvisoActualizacion from "./AvisoActualizacion";
import { SelectorUnidad } from "../lib/unidad";
import { useAvisos } from "./Avisos";
import {
  IconoCalendario,
  IconoCamion,
  IconoGrafica,
  IconoHistorial,
  IconoIndicadores,
  IconoLlave,
  IconoMas,
  IconoPlanilla,
  IconoPrograma,
  IconoReinicio,
  IconoTablero,
  IconoTemporizador,
  IconoUsuarios,
} from "./Iconos";
import logoApp from "../assets/logo-app.svg";

const enlaces = [
  { a: "/control", texto: "Control PM", icono: <IconoTablero />, captura: false },
  { a: "/rutina40", texto: "Rutina 40 h", icono: <IconoTemporizador />, captura: false },
  { a: "/graficas", texto: "Gráficas", icono: <IconoGrafica />, captura: false },
  { a: "/programa", texto: "Programa 4 semanas", icono: <IconoPrograma />, captura: false },
  { a: "/indicadores", texto: "Indicadores", icono: <IconoIndicadores />, captura: false },
  { a: "/lecturas", texto: "Lecturas", icono: <IconoPlanilla />, captura: true },
  { a: "/registro-pm", texto: "Registro PM", icono: <IconoLlave />, captura: true },
  { a: "/cambios", texto: "Cambios horómetro", icono: <IconoReinicio />, captura: true },
  { a: "/historial", texto: "Historial", icono: <IconoHistorial />, captura: false },
];

// Título de la cabecera en el celular.
function tituloDe(ruta: string) {
  const e = [...enlaces, ...enlacesAdmin].find((x) => ruta.startsWith(x.a));
  if (e) return e.texto;
  if (ruta.startsWith("/equipo/")) return "Ficha del equipo";
  return "Control de Preventivos";
}

const NOMBRE_ROL = { admin: "Administrador", capturador: "Capturador", invitado: "Invitado (solo consulta)" };

const enlacesAdmin = [
  { a: "/equipos", texto: "Equipos", icono: <IconoCamion /> },
  { a: "/plan", texto: "Plan MP", icono: <IconoCalendario /> },
  { a: "/usuarios", texto: "Usuarios", icono: <IconoUsuarios /> },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { perfil, esAdmin, puedeCapturar } = useAuth();
  const conexion = useEstadoConexion();
  const navegar = useNavigate();
  const [destino, setDestino] = useState<string | null>(null);
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [guardandoClave, setGuardandoClave] = useState(false);
  const { avisar } = useAvisos();
  const esMovil = useEsMovil();
  const { pathname } = useLocation();
  const [masAbierto, setMasAbierto] = useState(false);
  useEffect(() => setMasAbierto(false), [pathname]);
  // Barra inferior del celular: quien captura tiene Lecturas y Registro PM; el invitado,
  // Programa e Indicadores. El resto del menú queda en "Más".
  const barra = (puedeCapturar ? ["/control", "/lecturas", "/registro-pm"] : ["/control", "/programa", "/indicadores"])
    .map((a) => enlaces.find((e) => e.a === a)!);
  const CORTO: Record<string, string> = { "Registro PM": "PM", "Programa 4 semanas": "Programa" };

  async function cambiarClave(contrasena: string) {
    setGuardandoClave(true);
    const { error } = await supabase().auth.updateUser({ password: contrasena });
    setGuardandoClave(false);
    if (error) {
      avisar(
        error.message.includes("different from the old")
          ? "La contraseña nueva debe ser distinta de la actual"
          : `No se pudo cambiar la contraseña: ${error.message}`,
        "error"
      );
      return;
    }
    setCambiandoClave(false);
    avisar("Contraseña cambiada");
  }

  function alNavegar(e: React.MouseEvent, a: string) {
    if (lecturasPendientes() > 0) {
      e.preventDefault();
      setDestino(a);
    }
  }
  return (
    <div className="app">
      {cambiandoClave && (
        <DialogoContrasena
          titulo="Cambiar mi contraseña"
          detalle={perfil?.correo ?? undefined}
          boton="Cambiar"
          ocupado={guardandoClave}
          onAceptar={cambiarClave}
          onCerrar={() => setCambiandoClave(false)}
        />
      )}
      {esMovil && (
        <header className="cabecera-movil">
          <img className="logo-app" src={logoApp} alt="" />
          <span>{tituloDe(pathname)}</span>
          <span className={`punto-conexion ${conexion}`} title={conexion === "en_linea" ? "En línea" : "Sin conexión"} />
        </header>
      )}
      {esMovil && masAbierto && <div className="velo-menu" onClick={() => setMasAbierto(false)} />}
      <aside className={`menu${esMovil ? " menu-movil" : ""}${masAbierto ? " abierto" : ""}`} aria-hidden={esMovil && !masAbierto}>
        <div className="logo">
          <img className="logo-app" src={logoApp} alt="" />
          <div>
            <span className="logo-titulo">Control de Preventivos</span>
            <span className="logo-sub">Dimelco · mantenimiento</span>
          </div>
        </div>
        <SelectorUnidad />
        <nav>
          {enlaces.filter((e) => puedeCapturar || !e.captura).map((e) => (
            <NavLink key={e.a} to={e.a} onClick={(ev) => alNavegar(ev, e.a)} className={({ isActive }) => (isActive ? "activo" : "")}>
              {e.icono}
              {e.texto}
            </NavLink>
          ))}
          {esAdmin && (
            <>
              <div className="menu-seccion">Administración</div>
              {enlacesAdmin.map((e) => (
                <NavLink key={e.a} to={e.a} onClick={(ev) => alNavegar(ev, e.a)} className={({ isActive }) => (isActive ? "activo" : "")}>
                  {e.icono}
                  {e.texto}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="menu-pie">
          <div className="usuario">
            <div>{perfil?.nombre ?? "…"}</div>
            <div className="usuario-rol">{perfil ? NOMBRE_ROL[perfil.rol] : ""}</div>
          </div>
          <button className="boton-plano" onClick={() => setCambiandoClave(true)}>
            Cambiar contraseña
          </button>
          <button className="boton-plano" onClick={() => supabase().auth.signOut()}>
            Cerrar sesión
          </button>
          <div className="pie-estado">
            <span className={`punto-conexion ${conexion}`} />
            {conexion === "en_linea" ? "En línea" : conexion === "reconectando" ? "Reconectando…" : "Sin conexión"}
            <span className="pie-version">v{__APP_VERSION__}</span>
          </div>
        </div>
      </aside>
      {esMovil && (
        <nav className="barra-inferior" aria-label="Navegación principal">
          {barra.map((e) => (
            <NavLink key={e.a} to={e.a} onClick={(ev) => alNavegar(ev, e.a)} className={({ isActive }) => (isActive ? "activo" : "")}>
              {e.icono}
              <span>{CORTO[e.texto] ?? e.texto}</span>
            </NavLink>
          ))}
          <button className={masAbierto ? "activo" : ""} onClick={() => setMasAbierto((x) => !x)} aria-expanded={masAbierto}>
            <IconoMas />
            <span>Más</span>
          </button>
        </nav>
      )}
      <main className="contenido">
        <AvisoActualizacion />
        {children}
      </main>
      {destino && (
        <DialogoConfirmar
          titulo="Hay lecturas sin grabar"
          texto={`Escribiste ${lecturasPendientes()} lectura(s) que todavía no se grabaron. Si sales de la pantalla se pierden.`}
          confirmar="Salir sin grabar"
          onRespuesta={(si) => {
            const a = destino;
            setDestino(null);
            if (si) {
              marcarPendientes(0);
              navegar(a);
            }
          }}
        />
      )}
    </div>
  );
}
