import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { usePerfiles } from "../lib/queries";
import { useAuth } from "../auth";

export default function Usuarios() {
  const qc = useQueryClient();
  const { data: perfiles } = usePerfiles();
  const { perfil } = useAuth();

  const actualizar = useMutation({
    mutationFn: async ({
      user_id,
      campo,
      valor,
    }: {
      user_id: string;
      campo: "rol" | "activo" | "nombre";
      valor: string | boolean;
    }) => {
      const { error } = await supabase()
        .from("perfiles")
        .update({ [campo]: valor })
        .eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <>
      <h1>Usuarios</h1>
      <p className="subtitulo">
        El alta de un usuario nuevo (correo y contraseña) se hace en el panel de Supabase,
        Authentication → Users; aquí se asigna su nombre y rol. Un usuario inactivo no puede usar
        la app.
      </p>
      <div className="tabla-marco" style={{ maxWidth: 820 }}>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {(perfiles ?? []).map((p) => (
              <tr key={p.user_id}>
                <td>
                  <input
                    style={{ width: 200 }}
                    defaultValue={p.nombre}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== p.nombre)
                        actualizar.mutate({ user_id: p.user_id, campo: "nombre", valor: e.target.value.trim() });
                    }}
                  />
                </td>
                <td>{p.correo}</td>
                <td>
                  <select
                    value={p.rol}
                    disabled={p.user_id === perfil?.user_id}
                    onChange={(e) =>
                      actualizar.mutate({ user_id: p.user_id, campo: "rol", valor: e.target.value })
                    }
                  >
                    <option value="admin">Administrador</option>
                    <option value="capturador">Capturador</option>
                  </select>
                </td>
                <td>
                  <button
                    className="boton-plano"
                    disabled={p.user_id === perfil?.user_id}
                    onClick={() =>
                      actualizar.mutate({ user_id: p.user_id, campo: "activo", valor: !p.activo })
                    }
                  >
                    {p.activo ? "Sí · desactivar" : "No · activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
