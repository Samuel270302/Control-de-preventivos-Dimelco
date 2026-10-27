import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";

const enlaces = [
  { a: "/control", texto: "Control PM" },
  { a: "/rutina40", texto: "Rutina 40 h" },
  { a: "/lecturas", texto: "Lecturas" },
  { a: "/registro-pm", texto: "Registro PM" },
  { a: "/cambios", texto: "Cambios horómetro" },
  { a: "/historial", texto: "Historial" },
];

const enlacesAdmin = [
  { a: "/equipos", texto: "Equipos" },
  { a: "/plan", texto: "Plan MP" },
  { a: "/usuarios", texto: "Usuarios" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { perfil, esAdmin } = useAuth();
  return (
    <div className="app">
      <aside className="menu">
        <div className="logo">
          <span className="logo-titulo">Preventivos</span>
          <span className="logo-sub">HEMCO · mantenimiento</span>
        </div>
        <nav>
          {enlaces.map((e) => (
            <NavLink key={e.a} to={e.a} className={({ isActive }) => (isActive ? "activo" : "")}>
              {e.texto}
            </NavLink>
          ))}
          {esAdmin && (
            <>
              <div className="menu-seccion">Administración</div>
              {enlacesAdmin.map((e) => (
                <NavLink key={e.a} to={e.a} className={({ isActive }) => (isActive ? "activo" : "")}>
                  {e.texto}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="menu-pie">
          <div className="usuario">
            <div>{perfil?.nombre ?? "…"}</div>
            <div className="usuario-rol">{perfil?.rol === "admin" ? "Administrador" : "Capturador"}</div>
          </div>
          <button className="boton-plano" onClick={() => supabase().auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="contenido">{children}</main>
    </div>
  );
}
