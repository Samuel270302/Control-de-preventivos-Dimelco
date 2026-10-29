import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { leerConexion } from "./lib/config";
import { supabase } from "./lib/supabase";
import { AuthProvider, useAuth } from "./auth";
import { useTiempoReal } from "./lib/queries";
import Layout from "./components/Layout";
import { AvisosProvider } from "./components/Avisos";
import Setup from "./pages/Setup";
import Login from "./pages/Login";
import ControlPm from "./pages/ControlPm";
import Control40 from "./pages/Control40";
import FichaEquipo from "./pages/FichaEquipo";
import Graficas from "./pages/Graficas";
import Lecturas from "./pages/Lecturas";
import RegistroPmPage from "./pages/RegistroPm";
import Cambios from "./pages/Cambios";
import Historial from "./pages/Historial";
import Equipos from "./pages/Equipos";
import PlanMpPage from "./pages/PlanMp";
import Usuarios from "./pages/Usuarios";

function Interior() {
  const { session, perfil, cargando, esAdmin, puedeCapturar } = useAuth();
  if (cargando) return <div className="pantalla-centro">Cargando…</div>;
  if (!session) return <Login />;
  if (!perfil?.activo) return <AccesoPendiente correo={session.user.email ?? ""} />;
  return <ConRealtime esAdmin={esAdmin} puedeCapturar={puedeCapturar} />;
}

function AccesoPendiente({ correo }: { correo: string }) {
  return (
    <div className="pantalla-centro">
      <div className="tarjeta">
        <h1>Acceso pendiente de activación</h1>
        <p className="nota" style={{ marginBottom: 14 }}>
          La cuenta {correo} existe, pero un administrador todavía no la activa ni le asigna rol.
          Pídele al administrador que la active en la pantalla Usuarios.
        </p>
        <button className="boton-plano" style={{ width: "100%" }} onClick={() => supabase().auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function ConRealtime({ esAdmin, puedeCapturar }: { esAdmin: boolean; puedeCapturar: boolean }) {
  useTiempoReal();
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/control" replace />} />
        <Route path="/control" element={<ControlPm />} />
        <Route path="/rutina40" element={<Control40 />} />
        <Route path="/graficas" element={<Graficas />} />
        <Route path="/equipo/:id" element={<FichaEquipo />} />
        {puedeCapturar && <Route path="/lecturas" element={<Lecturas />} />}
        {puedeCapturar && <Route path="/registro-pm" element={<RegistroPmPage />} />}
        {puedeCapturar && <Route path="/cambios" element={<Cambios />} />}
        <Route path="/historial" element={<Historial />} />
        {esAdmin && <Route path="/equipos" element={<Equipos />} />}
        {esAdmin && <Route path="/plan" element={<PlanMpPage />} />}
        {esAdmin && <Route path="/usuarios" element={<Usuarios />} />}
        <Route path="*" element={<Navigate to="/control" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const [configurado, setConfigurado] = useState(() => leerConexion() !== null);
  if (!configurado) return <Setup alGuardar={() => setConfigurado(true)} />;
  return (
    <AuthProvider>
      <AvisosProvider>
        <Interior />
      </AvisosProvider>
    </AuthProvider>
  );
}
