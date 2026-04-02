import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import api from "../services/api";
import { PaginatedResult, Document, ProcessType, ProcessState, DocumentFacets } from "../types";
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
  const [showFilters, setShowFilters] = useState(false);
  const [filterProcessType, setFilterProcessType] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const limit = 20;

  let searchTimer: ReturnType<typeof setTimeout>;
  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  }

  function resetFilters() {
    setFilterProcessType("");
    setFilterState("");
    setFilterTag("");
    setPage(1);
  }

  const queryParams: Record<string, string | number | undefined> = {
    search: debouncedSearch || undefined,
    page,
    limit,
    process_type_id: filterProcessType || undefined,
    current_state_id: filterState || undefined,
    tag: filterTag || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["documents", queryParams],
    queryFn: () =>
      api.get<PaginatedResult<Document>>("/documents", { params: queryParams }).then((r) => r.data),
  });

  const { data: facetsData } = useQuery({
    queryKey: ["document-facets"],
    queryFn: () =>
      api.get<{ facets: DocumentFacets }>("/documents/facets").then((r) => r.data),
  });

  const { data: processTypesData } = useQuery({
    queryKey: ["process-types"],
    queryFn: () =>
      api.get<{ process_types: ProcessType[] }>("/process-types").then((r) => r.data),
  });

  const { data: processTypeStatesData } = useQuery({
    queryKey: ["process-type-states", filterProcessType],
    queryFn: () =>
      api
        .get<{ states: ProcessState[] }>(`/process-types/${filterProcessType}`)
        .then((r) => r.data),
    enabled: !!filterProcessType,
  });

  const canUpload = user?.role === "admin" || user?.role === "editor";
  const facets = facetsData?.facets;
  const processTypes = processTypesData?.process_types ?? [];
  const availableStates = processTypeStatesData?.states ?? [];
  const hasActiveFilters = filterProcessType || filterState || filterTag;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Documentos</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`btn-secondary text-sm ${hasActiveFilters ? "ring-2 ring-primary-400" : ""}`}
          >
            Filtros {hasActiveFilters ? "•" : ""}
          </button>
          {canUpload && (
            <button onClick={() => setShowUpload(true)} className="btn-primary">
              Enviar documento
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Filter sidebar */}
        {showFilters && (
          <div className="w-56 flex-shrink-0">
            <div className="card p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-700">Filtros</h3>
                {hasActiveFilters && (
                  <button onClick={resetFilters} className="text-xs text-primary-600 hover:underline">
                    Limpar
                  </button>
                )}
              </div>

              {/* Process type filter */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Tipo de processo</p>
                <select
                  className="input text-xs"
                  value={filterProcessType}
                  onChange={(e) => {
                    setFilterProcessType(e.target.value);
                    setFilterState("");
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  {processTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* State filter */}
              {filterProcessType && availableStates.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Estado</p>
                  <select
                    className="input text-xs"
                    value={filterState}
                    onChange={(e) => {
                      setFilterState(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Todos</option>
                    {availableStates.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tag filter */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Tag</p>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="ex: Urgente"
                  value={filterTag}
                  onChange={(e) => {
                    setFilterTag(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              {/* Facets */}
              {facets && facets.by_process_type.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1 font-medium">Por tipo</p>
                  {facets.by_process_type.map((f) => (
                    <button
                      key={f.process_type_id}
                      onClick={() => {
                        setFilterProcessType(f.process_type_id);
                        setPage(1);
                      }}
                      className="flex justify-between w-full text-xs text-gray-600 hover:text-primary-700 py-0.5"
                    >
                      <span className="truncate">{f.name}</span>
                      <span className="text-gray-400">{f.count}</span>
                    </button>
                  ))}
                </div>
              )}

              {facets && facets.by_state.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1 font-medium">Por estado</p>
                  {facets.by_state.map((f) => (
                    <button
                      key={f.current_state_id}
                      onClick={() => {
                        setFilterState(f.current_state_id);
                        setPage(1);
                      }}
                      className="flex justify-between w-full text-xs text-gray-600 hover:text-primary-700 py-0.5"
                    >
                      <span className="flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: f.color }}
                        />
                        {f.label}
                      </span>
                      <span className="text-gray-400">{f.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
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
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Processo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tamanho</th>
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
                  <DocRow key={doc.id} doc={doc} processTypes={processTypes} />
                ))}
              </tbody>
            </table>

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
        </div>
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

function DocRow({
  doc,
  processTypes,
}: {
  doc: Document;
  processTypes: ProcessType[];
}) {
  const ptName = processTypes.find((pt) => pt.id === doc.process_type_id)?.name;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <Link to={`/documents/${doc.id}`} className="text-primary-600 hover:underline font-medium">
          {doc.title}
        </Link>
        <p className="text-xs text-gray-400">{doc.filename}</p>
      </td>
      <td className="px-4 py-3">
        {ptName ? (
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
            {ptName}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600">{formatSize(doc.size)}</td>
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
  );
}
