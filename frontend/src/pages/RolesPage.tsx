import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";
import { Role, RoleDocument, RoleBinding, User, Group, Document, PermissionLevel } from "../types";
import toast from "react-hot-toast";

type Tab = "documents" | "users" | "groups";

const PERMISSION_LABEL: Record<PermissionLevel, string> = {
  viewer: "Visualizador",
  editor: "Editor",
};

const PERMISSION_COLOR: Record<PermissionLevel, string> = {
  viewer: "bg-blue-100 text-blue-700",
  editor: "bg-amber-100 text-amber-700",
};

interface RoleDetail {
  role: Role;
  documents: RoleDocument[];
  userBindings: RoleBinding[];
  groupBindings: RoleBinding[];
}

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("documents");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", permission_level: "viewer" as PermissionLevel });
  const [addDocId, setAddDocId] = useState("");
  const [addUserId, setAddUserId] = useState("");
  const [addGroupId, setAddGroupId] = useState("");

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<{ roles: Role[] }>("/roles").then((r) => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ["role", selectedRole?.id],
    queryFn: () =>
      api.get<RoleDetail>(`/roles/${selectedRole!.id}`).then((r) => r.data),
    enabled: !!selectedRole,
  });

  const { data: docsData } = useQuery({
    queryKey: ["documents-all"],
    queryFn: () =>
      api.get<{ data: Document[] }>("/documents?limit=500").then((r) => r.data),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ users: User[] }>("/auth/users").then((r) => r.data),
  });

  const { data: groupsData } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.get<{ groups: Group[] }>("/groups").then((r) => r.data),
  });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post<{ role: Role }>("/roles", data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setShowCreate(false);
      setForm({ name: "", description: "", permission_level: "viewer" });
      toast.success(`Função "${data.role.name}" criada`);
    },
    onError: () => toast.error("Erro ao criar função"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setSelectedRole(null);
      toast.success("Função removida");
    },
    onError: () => toast.error("Erro ao remover função"),
  });

  const addDocMutation = useMutation({
    mutationFn: ({ roleId, documentId }: { roleId: string; documentId: string }) =>
      api.post(`/roles/${roleId}/documents`, { document_id: documentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role", selectedRole?.id] });
      setAddDocId("");
      toast.success("Documento adicionado");
    },
    onError: () => toast.error("Erro ao adicionar documento"),
  });

  const removeDocMutation = useMutation({
    mutationFn: ({ roleId, documentId }: { roleId: string; documentId: string }) =>
      api.delete(`/roles/${roleId}/documents/${documentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role", selectedRole?.id] });
      toast.success("Documento removido");
    },
    onError: () => toast.error("Erro ao remover documento"),
  });

  const addUserMutation = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      api.post(`/roles/${roleId}/users`, { user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role", selectedRole?.id] });
      setAddUserId("");
      toast.success("Usuário vinculado");
    },
    onError: () => toast.error("Erro ao vincular usuário"),
  });

  const removeUserMutation = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      api.delete(`/roles/${roleId}/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role", selectedRole?.id] });
      toast.success("Usuário desvinculado");
    },
    onError: () => toast.error("Erro ao desvincular usuário"),
  });

  const addGroupMutation = useMutation({
    mutationFn: ({ roleId, groupId }: { roleId: string; groupId: string }) =>
      api.post(`/roles/${roleId}/groups`, { group_id: groupId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role", selectedRole?.id] });
      setAddGroupId("");
      toast.success("Grupo vinculado");
    },
    onError: () => toast.error("Erro ao vincular grupo"),
  });

  const removeGroupMutation = useMutation({
    mutationFn: ({ roleId, groupId }: { roleId: string; groupId: string }) =>
      api.delete(`/roles/${roleId}/groups/${groupId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role", selectedRole?.id] });
      toast.success("Grupo desvinculado");
    },
    onError: () => toast.error("Erro ao desvincular grupo"),
  });

  // ── Derived data ────────────────────────────────────────────────────────────
  const roles = rolesData?.roles ?? [];
  const allDocs = docsData?.data ?? [];
  const allUsers = usersData?.users ?? [];
  const allGroups = groupsData?.groups ?? [];

  const assignedDocIds = new Set(detail?.documents.map((d) => d.document_id) ?? []);
  const boundUserIds = new Set(detail?.userBindings.map((b) => b.subject_id) ?? []);
  const boundGroupIds = new Set(detail?.groupBindings.map((b) => b.subject_id) ?? []);

  const availableDocs = allDocs.filter((d) => !assignedDocIds.has(d.id));
  const availableUsers = allUsers.filter((u) => !boundUserIds.has(u.id));
  const availableGroups = allGroups.filter((g) => !boundGroupIds.has(g.id));

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Funções (Roles)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Defina funções com nível de permissão e vincule documentos, usuários ou grupos.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          Nova função
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Role list */}
        <div className="card p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Funções</h3>
          {roles.length === 0 && <p className="text-sm text-gray-400">Nenhuma função</p>}
          <div className="space-y-1">
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelectedRole(r); setActiveTab("documents"); }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedRole?.id === r.id
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <span className="block font-medium">{r.name}</span>
                <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-0.5 ${PERMISSION_COLOR[r.permission_level]}`}>
                  {PERMISSION_LABEL[r.permission_level]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Role detail */}
        {selectedRole && detail && (
          <div className="md:col-span-2 card p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{detail.role.name}</h3>
                {detail.role.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{detail.role.description}</p>
                )}
                <span className={`inline-block text-xs px-2 py-0.5 rounded mt-1 font-medium ${PERMISSION_COLOR[detail.role.permission_level]}`}>
                  {PERMISSION_LABEL[detail.role.permission_level]}
                </span>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Remover função "${selectedRole.name}"?`)) {
                    deleteMutation.mutate(selectedRole.id);
                  }
                }}
                className="btn-danger text-xs"
              >
                Remover
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4 gap-1">
              {(["documents", "users", "groups"] as Tab[]).map((tab) => {
                const labels = { documents: "Documentos", users: "Usuários", groups: "Grupos" };
                const counts = {
                  documents: detail.documents.length,
                  users: detail.userBindings.length,
                  groups: detail.groupBindings.length,
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                      activeTab === tab
                        ? "border-primary-600 text-primary-700"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {labels[tab]}
                    <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                      {counts[tab]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Documents tab */}
            {activeTab === "documents" && (
              <div>
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {detail.documents.length === 0 && (
                    <p className="text-sm text-gray-400">Nenhum documento nesta função</p>
                  )}
                  {detail.documents.map((d) => (
                    <div
                      key={d.document_id}
                      className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded"
                    >
                      <div>
                        <span className="font-medium text-gray-800">{d.document_title ?? d.document_filename}</span>
                        {d.document_title && (
                          <span className="text-gray-400 ml-2 text-xs">{d.document_filename}</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeDocMutation.mutate({ roleId: selectedRole.id, documentId: d.document_id })}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none ml-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {availableDocs.length > 0 && (
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <select
                      className="input text-sm flex-1"
                      value={addDocId}
                      onChange={(e) => setAddDocId(e.target.value)}
                    >
                      <option value="">Selecionar documento...</option>
                      {availableDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!addDocId || addDocMutation.isPending}
                      onClick={() => addDocMutation.mutate({ roleId: selectedRole.id, documentId: addDocId })}
                      className="btn-primary text-sm"
                    >
                      Adicionar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Users tab */}
            {activeTab === "users" && (
              <div>
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {detail.userBindings.length === 0 && (
                    <p className="text-sm text-gray-400">Nenhum usuário vinculado</p>
                  )}
                  {detail.userBindings.map((b) => (
                    <div
                      key={b.subject_id}
                      className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded"
                    >
                      <div>
                        <span className="font-medium text-gray-800">{b.subject_name}</span>
                        {b.subject_email && (
                          <span className="text-gray-400 ml-2">{b.subject_email}</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeUserMutation.mutate({ roleId: selectedRole.id, userId: b.subject_id })}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none ml-2"
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
                      disabled={!addUserId || addUserMutation.isPending}
                      onClick={() => addUserMutation.mutate({ roleId: selectedRole.id, userId: addUserId })}
                      className="btn-primary text-sm"
                    >
                      Vincular
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Groups tab */}
            {activeTab === "groups" && (
              <div>
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {detail.groupBindings.length === 0 && (
                    <p className="text-sm text-gray-400">Nenhum grupo vinculado</p>
                  )}
                  {detail.groupBindings.map((b) => (
                    <div
                      key={b.subject_id}
                      className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded"
                    >
                      <span className="font-medium text-gray-800">{b.subject_name}</span>
                      <button
                        onClick={() => removeGroupMutation.mutate({ roleId: selectedRole.id, groupId: b.subject_id })}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none ml-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {availableGroups.length > 0 && (
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <select
                      className="input text-sm flex-1"
                      value={addGroupId}
                      onChange={(e) => setAddGroupId(e.target.value)}
                    >
                      <option value="">Selecionar grupo...</option>
                      {availableGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!addGroupId || addGroupMutation.isPending}
                      onClick={() => addGroupMutation.mutate({ roleId: selectedRole.id, groupId: addGroupId })}
                      className="btn-primary text-sm"
                    >
                      Vincular
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create role modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Nova função</h3>
            <div className="space-y-3">
              <input
                type="text"
                className="input"
                placeholder="Nome da função"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                type="text"
                className="input"
                placeholder="Descrição (opcional)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nível de permissão
                </label>
                <select
                  className="input"
                  value={form.permission_level}
                  onChange={(e) => setForm((f) => ({ ...f, permission_level: e.target.value as PermissionLevel }))}
                >
                  <option value="viewer">Visualizador — leitura e download</option>
                  <option value="editor">Editor — edição de metadados e anotações</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                disabled={!form.name || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}
                className="btn-primary flex-1"
              >
                Criar
              </button>
              <button
                onClick={() => { setShowCreate(false); setForm({ name: "", description: "", permission_level: "viewer" }); }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
