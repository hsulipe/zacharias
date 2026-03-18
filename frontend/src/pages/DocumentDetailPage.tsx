import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import api from "../services/api";
import { Document, DocumentMetadata } from "../types";
import { useAuthStore } from "../hooks/useAuthStore";
import toast from "react-hot-toast";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canEdit = user?.role === "admin" || user?.role === "editor";

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: docData } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.get<{ document: Document }>(`/documents/${id}`).then((r) => r.data),
  });

  const { data: metaData } = useQuery({
    queryKey: ["metadata", id],
    queryFn: () =>
      api.get<{ metadata: DocumentMetadata[] }>(`/documents/${id}/metadata`).then((r) => r.data),
  });

  const downloadMutation = useMutation({
    mutationFn: () => api.get<{ url: string }>(`/documents/${id}/download`).then((r) => r.data),
    onSuccess: (data) => {
      window.open(data.url, "_blank");
    },
    onError: () => toast.error("Erro ao gerar link de download"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/documents/${id}`),
    onSuccess: () => {
      toast.success("Documento removido");
      navigate("/documents");
    },
    onError: () => toast.error("Erro ao remover documento"),
  });

  const addMetaMutation = useMutation({
    mutationFn: (entries: { key: string; value: string }[]) =>
      api.put(`/documents/${id}/metadata`, { entries }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metadata", id] });
      setNewKey("");
      setNewValue("");
      toast.success("Metadado salvo");
    },
    onError: () => toast.error("Erro ao salvar metadado"),
  });

  const deleteMetaMutation = useMutation({
    mutationFn: (key: string) => api.delete(`/documents/${id}/metadata/${encodeURIComponent(key)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["metadata", id] }),
    onError: () => toast.error("Erro ao remover metadado"),
  });

  const expiryMutation = useMutation({
    mutationFn: (expires_at: string | null) =>
      api.patch(`/documents/${id}/expiry`, { expires_at }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      toast.success("Vencimento atualizado");
    },
    onError: () => toast.error("Erro ao atualizar vencimento"),
  });

  const doc = docData?.document;
  const metadata = metaData?.metadata ?? [];

  if (!doc) return <div className="p-8 text-gray-400">Carregando...</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray-400 hover:text-gray-600 mb-2"
          >
            ← Voltar
          </button>
          <h2 className="text-2xl font-bold text-gray-900">{doc.title}</h2>
          <p className="text-sm text-gray-400 mt-1">{doc.filename} · {formatSize(doc.size)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadMutation.mutate()}
            disabled={downloadMutation.isPending}
            className="btn-secondary"
          >
            Baixar PDF
          </button>
          {canEdit && (
            <button
              onClick={() => {
                if (confirm("Tem certeza que deseja remover este documento?")) {
                  deleteMutation.mutate();
                }
              }}
              className="btn-danger"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info */}
        <div className="card p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 pb-2 border-b border-gray-100">Informações</h3>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Status OCR</span>
            <span
              className={`font-medium ${
                doc.ocr_status === "done"
                  ? "text-green-600"
                  : doc.ocr_status === "failed"
                  ? "text-red-600"
                  : "text-yellow-600"
              }`}
            >
              {doc.ocr_status}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Pesquisável</span>
            <span>{doc.is_searchable ? "Sim" : "Não"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Enviado em</span>
            <span>{format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Vencimento</span>
            <span className={doc.expires_at && new Date(doc.expires_at) < new Date() ? "text-red-600 font-medium" : ""}>
              {doc.expires_at ? format(new Date(doc.expires_at), "dd/MM/yyyy") : "—"}
            </span>
          </div>
          {canEdit && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Alterar vencimento</p>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="input text-sm flex-1"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <button
                  className="btn-secondary text-xs"
                  onClick={() =>
                    expiryMutation.mutate(
                      expiresAt ? new Date(expiresAt).toISOString() : null
                    )
                  }
                >
                  Salvar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 pb-2 border-b border-gray-100 mb-3">Metadados</h3>
          <div className="space-y-2 mb-4">
            {metadata.length === 0 && (
              <p className="text-sm text-gray-400">Nenhum metadado</p>
            )}
            {metadata.map((m) => (
              <div key={m.key} className="flex justify-between items-center text-sm">
                <span className="font-medium text-gray-700 mr-2">{m.key}</span>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="text-gray-500 truncate max-w-[150px]">{m.value}</span>
                  {canEdit && (
                    <button
                      onClick={() => deleteMetaMutation.mutate(m.key)}
                      className="text-gray-300 hover:text-red-500 text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <input
                type="text"
                className="input text-sm"
                placeholder="Chave (ex: contrato, setor)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <input
                type="text"
                className="input text-sm"
                placeholder="Valor"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
              <button
                className="btn-primary w-full text-sm"
                disabled={!newKey || !newValue || addMetaMutation.isPending}
                onClick={() => addMetaMutation.mutate([{ key: newKey, value: newValue }])}
              >
                Adicionar metadado
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
