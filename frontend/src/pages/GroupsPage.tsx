import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";
import { Group, GroupMember, User } from "../types";
import toast from "react-hot-toast";

export default function GroupsPage() {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [addUserId, setAddUserId] = useState("");

  const { data: groupsData } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.get<{ groups: Group[] }>("/groups").then((r) => r.data),
  });

  const { data: groupDetail } = useQuery({
    queryKey: ["group", selectedGroup?.id],
    queryFn: () =>
      api
        .get<{ group: Group; members: GroupMember[] }>(`/groups/${selectedGroup!.id}`)
        .then((r) => r.data),
    enabled: !!selectedGroup,
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ users: User[] }>("/auth/users").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      api.post<{ group: Group }>("/groups", data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      toast.success(`Grupo "${data.group.name}" criado`);
    },
    onError: () => toast.error("Erro ao criar grupo"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setSelectedGroup(null);
      toast.success("Grupo removido");
    },
    onError: () => toast.error("Erro ao remover grupo"),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      api.post(`/groups/${groupId}/members`, { user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroup?.id] });
      setAddUserId("");
      toast.success("Membro adicionado");
    },
    onError: () => toast.error("Erro ao adicionar membro"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      api.delete(`/groups/${groupId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", selectedGroup?.id] });
      toast.success("Membro removido");
    },
    onError: () => toast.error("Erro ao remover membro"),
  });

  const groups = groupsData?.groups ?? [];
  const members = groupDetail?.members ?? [];
  const users = usersData?.users ?? [];

  // Users not yet in the group
  const memberIds = new Set(members.map((m) => m.user_id));
  const availableUsers = users.filter((u) => !memberIds.has(u.id));

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Grupos</h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          Novo grupo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Group list */}
        <div className="card p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Grupos</h3>
          {groups.length === 0 && <p className="text-sm text-gray-400">Nenhum grupo</p>}
          <div className="space-y-1">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedGroup?.id === g.id
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                {g.name}
                {g.description && (
                  <span className="block text-xs text-gray-400 truncate">{g.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Group detail */}
        {selectedGroup && (
          <div className="md:col-span-2 card p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedGroup.name}</h3>
                {selectedGroup.description && (
                  <p className="text-sm text-gray-500 mt-1">{selectedGroup.description}</p>
                )}
              </div>
              <button
                onClick={() => {
                  if (confirm(`Remover grupo "${selectedGroup.name}"?`)) {
                    deleteMutation.mutate(selectedGroup.id);
                  }
                }}
                className="btn-danger text-xs"
              >
                Remover grupo
              </button>
            </div>

            <h4 className="text-sm font-medium text-gray-700 mb-2">Membros</h4>
            <div className="space-y-2 mb-4">
              {members.length === 0 && (
                <p className="text-sm text-gray-400">Nenhum membro</p>
              )}
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded"
                >
                  <div>
                    <span className="font-medium text-gray-800">{m.user_name}</span>
                    <span className="text-gray-400 ml-2">{m.user_email}</span>
                  </div>
                  <button
                    onClick={() =>
                      removeMemberMutation.mutate({ groupId: selectedGroup.id, userId: m.user_id })
                    }
                    className="text-gray-400 hover:text-red-500 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {availableUsers.length > 0 && (
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <select
                  className="input text-sm flex-1"
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                >
                  <option value="">Selecionar usuário...</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                <button
                  disabled={!addUserId || addMemberMutation.isPending}
                  onClick={() =>
                    addMemberMutation.mutate({ groupId: selectedGroup.id, userId: addUserId })
                  }
                  className="btn-primary text-sm"
                >
                  Adicionar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create group modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Novo grupo</h3>
            <div className="space-y-3">
              <input
                type="text"
                className="input"
                placeholder="Nome do grupo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                type="text"
                className="input"
                placeholder="Descrição (opcional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                disabled={!newName || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: newName, description: newDesc })}
                className="btn-primary flex-1"
              >
                Criar
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
