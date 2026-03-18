import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import api from "../services/api";
import { User, UserRole } from "../types";
import toast from "react-hot-toast";

export default function UsersPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ users: User[] }>("/auth/users").then((r) => r.data),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      api.patch(`/auth/users/${id}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Perfil atualizado");
    },
    onError: () => toast.error("Erro ao atualizar perfil"),
  });

  const roleLabels: Record<UserRole, string> = {
    admin: "Administrador",
    editor: "Editor",
    viewer: "Leitor",
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Usuários</h2>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">E-mail</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Perfil</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Criado em</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  Carregando...
                </td>
              </tr>
            )}
            {data?.users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      user.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : user.role === "editor"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {roleLabels[user.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {format(new Date(user.created_at), "dd/MM/yyyy")}
                </td>
                <td className="px-4 py-3">
                  <select
                    className="text-xs border border-gray-200 rounded px-2 py-1"
                    value={user.role}
                    onChange={(e) =>
                      roleMutation.mutate({ id: user.id, role: e.target.value as UserRole })
                    }
                  >
                    <option value="viewer">Leitor</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
