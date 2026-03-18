import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import api from "../services/api";
import { PaginatedResult, Document } from "../types";
import { useAuthStore } from "../hooks/useAuthStore";
import UploadModal from "../components/UploadModal";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const limit = 20;

  // Debounce search
  let searchTimer: ReturnType<typeof setTimeout>;
  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["documents", { search: debouncedSearch, page, limit }],
    queryFn: () =>
      api
        .get<PaginatedResult<Document>>("/documents", {
          params: { search: debouncedSearch || undefined, page, limit },
        })
        .then((r) => r.data),
  });

  const canUpload = user?.role === "admin" || user?.role === "editor";

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Documentos</h2>
        {canUpload && (
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            Enviar documento
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          className="input max-w-md"
          placeholder="Pesquisar documentos..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Título</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Tamanho</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status OCR</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Vencimento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Upload</th>
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
            {!isLoading && data?.data.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  Nenhum documento encontrado
                </td>
              </tr>
            )}
            {data?.data.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link to={`/documents/${doc.id}`} className="text-primary-600 hover:underline font-medium">
                    {doc.title}
                  </Link>
                  <p className="text-xs text-gray-400">{doc.filename}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{formatSize(doc.size)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      doc.ocr_status === "done"
                        ? "bg-green-100 text-green-700"
                        : doc.ocr_status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {doc.ocr_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {doc.expires_at ? (
                    <span className={new Date(doc.expires_at) < new Date() ? "text-red-600 font-medium" : ""}>
                      {format(new Date(doc.expires_at), "dd/MM/yyyy")}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {formatDistanceToNow(new Date(doc.created_at), { locale: ptBR, addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              {data.total} documento(s) — Página {page} de {data.pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs py-1 px-3"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="btn-secondary text-xs py-1 px-3"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            queryClient.invalidateQueries({ queryKey: ["documents"] });
          }}
        />
      )}
    </div>
  );
}
