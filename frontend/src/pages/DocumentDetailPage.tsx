import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Document as PdfDocument, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import api from "../services/api";
import {
  Document,
  DocumentMetadata,
  ProcessHistory,
  ProcessDeadline,
  PdfAnnotation,
  Group,
  ProcessType,
  ProcessState,
  ProcessTransition,
} from "../types";
import { useAuthStore } from "../hooks/useAuthStore";
import toast from "react-hot-toast";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Tab = "info" | "metadata" | "process" | "deadlines" | "annotations";

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canEdit = user?.role === "admin" || user?.role === "editor";
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [_pdfLoaded, setPdfLoaded] = useState(false); // tracks when PDF.js has parsed the document
  const [annotationMode, setAnnotationMode] = useState<"highlight" | "comment" | null>(null);
  const [newAnnotColor, setNewAnnotColor] = useState("#FBBF24");
  const [newAnnotContent, setNewAnnotContent] = useState("");
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Metadata tab state
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#6B7280");

  // Info tab state
  const [expiresAt, setExpiresAt] = useState("");

  // Process tab state
  const [selectedProcessTypeId, setSelectedProcessTypeId] = useState("");
  const [transitionComment, setTransitionComment] = useState("");

  // Deadline form state
  const [dlLabel, setDlLabel] = useState("");
  const [dlDueAt, setDlDueAt] = useState("");
  const [dlAlertDays, setDlAlertDays] = useState("7,3,1");
  const [showDlForm, setShowDlForm] = useState(false);

  // Queries
  const { data: docData } = useQuery({
    queryKey: ["document", id],
    queryFn: () =>
      api.get<{ document: Document; groups: Group[] }>(`/documents/${id}`).then((r) => r.data),
  });

  const { data: metaData } = useQuery({
    queryKey: ["metadata", id],
    queryFn: () =>
      api.get<{ metadata: DocumentMetadata[] }>(`/documents/${id}/metadata`).then((r) => r.data),
  });

  const { data: historyData } = useQuery({
    queryKey: ["history", id],
    queryFn: () =>
      api.get<{ history: ProcessHistory[] }>(`/documents/${id}/history`).then((r) => r.data),
    enabled: activeTab === "process",
  });

  const { data: deadlinesData } = useQuery({
    queryKey: ["deadlines", id],
    queryFn: () =>
      api.get<{ deadlines: ProcessDeadline[] }>(`/documents/${id}/deadlines`).then((r) => r.data),
    enabled: activeTab === "deadlines",
  });

  const { data: annotationsData } = useQuery({
    queryKey: ["annotations", id],
    queryFn: () =>
      api.get<{ annotations: PdfAnnotation[] }>(`/documents/${id}/annotations`).then((r) => r.data),
  });

  const { data: processTypesData } = useQuery({
    queryKey: ["process-types"],
    queryFn: () =>
      api.get<{ process_types: ProcessType[] }>("/process-types").then((r) => r.data),
  });

  const doc = docData?.document;
  const groups = docData?.groups ?? [];

  const { data: processTypeDetail } = useQuery({
    queryKey: ["process-type", doc?.process_type_id],
    queryFn: () =>
      api
        .get<{
          process_type: ProcessType;
          states: ProcessState[];
          transitions: ProcessTransition[];
        }>(`/process-types/${doc!.process_type_id}`)
        .then((r) => r.data),
    enabled: !!doc?.process_type_id,
  });
  const metadata = metaData?.metadata ?? [];
  const history = historyData?.history ?? [];
  const deadlines = deadlinesData?.deadlines ?? [];
  const annotations = annotationsData?.annotations ?? [];
  const processTypes = processTypesData?.process_types ?? [];
  const availableTransitions = processTypeDetail?.transitions?.filter(
    (t) => t.from_state_id === doc?.current_state_id
  ) ?? [];
  const currentState = processTypeDetail?.states?.find((s) => s.id === doc?.current_state_id);

  // Tags: metadata entries with "tag:" prefix
  const tags = metadata.filter((m) => m.key.startsWith("tag:"));
  const nonTagMeta = metadata.filter((m) => !m.key.startsWith("tag:"));

  // Auto-load PDF view URL when document is ready and is a PDF
  useEffect(() => {
    if (!id || !doc || doc.mime_type !== "application/pdf") return;
    api
      .get<{ url: string }>(`/documents/${id}/view`)
      .then((r) => setPdfUrl(r.data.url))
      .catch(() => toast.error("Erro ao carregar PDF"));
  }, [id, doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mutations
  const downloadMutation = useMutation({
    mutationFn: () => api.get<{ url: string }>(`/documents/${id}/download`).then((r) => r.data),
    onSuccess: (data) => window.open(data.url, "_blank"),
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

  const assignProcessTypeMutation = useMutation({
    mutationFn: (process_type_id: string) =>
      api.patch(`/documents/${id}/process-type`, { process_type_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      queryClient.invalidateQueries({ queryKey: ["history", id] });
      toast.success("Tipo de processo atribuído");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error ?? "Erro ao atribuir tipo de processo"),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ to_state_id, comment }: { to_state_id: string; comment?: string }) =>
      api.patch(`/documents/${id}/transition`, { to_state_id, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      queryClient.invalidateQueries({ queryKey: ["history", id] });
      setTransitionComment("");
      toast.success("Estado atualizado");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.error ?? "Transição não permitida"),
  });

  const createDeadlineMutation = useMutation({
    mutationFn: (data: object) => api.post(`/documents/${id}/deadlines`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadlines", id] });
      setShowDlForm(false);
      setDlLabel("");
      setDlDueAt("");
      setDlAlertDays("7,3,1");
      toast.success("Prazo criado");
    },
    onError: () => toast.error("Erro ao criar prazo"),
  });

  const deleteDeadlineMutation = useMutation({
    mutationFn: (dlId: string) => api.delete(`/documents/${id}/deadlines/${dlId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deadlines", id] }),
    onError: () => toast.error("Erro ao remover prazo"),
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: (annotId: string) => api.delete(`/documents/${id}/annotations/${annotId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["annotations", id] }),
    onError: () => toast.error("Erro ao remover anotação"),
  });

  const addTagMutation = useMutation({
    mutationFn: (name: string) =>
      api.put(`/documents/${id}/metadata`, {
        entries: [{ key: `tag:${name}`, value: tagColor }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metadata", id] });
      setTagName("");
    },
    onError: () => toast.error("Erro ao adicionar tag"),
  });

  // PDF annotation click handler
  const handlePdfClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (!annotationMode || !pdfContainerRef.current) return;
      const rect = pdfContainerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      try {
        await api.post(`/documents/${id}/annotations`, {
          page: currentPage,
          type: annotationMode,
          rect: { x, y, width: 0.02, height: 0.02 },
          content: newAnnotContent || undefined,
          color: newAnnotColor,
        });
        queryClient.invalidateQueries({ queryKey: ["annotations", id] });
        setNewAnnotContent("");
        toast.success("Anotação adicionada");
      } catch {
        toast.error("Erro ao adicionar anotação");
      }
    },
    [annotationMode, currentPage, id, newAnnotColor, newAnnotContent, queryClient]
  );

  if (!doc) return <div className="p-8 text-gray-400">Carregando...</div>;

  const TABS: { key: Tab; label: string }[] = [
    { key: "info", label: "Informações" },
    { key: "metadata", label: "Metadados" },
    { key: "process", label: "Processo" },
    { key: "deadlines", label: "Prazos" },
    { key: "annotations", label: "Anotações" },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* PDF Viewer — left panel */}
      <div className="flex-1 flex flex-col bg-gray-800 overflow-hidden">
        {/* PDF toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 text-white text-sm">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
            ← Voltar
          </button>
          <span className="flex-1 font-medium truncate">{doc.title}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
            >
              ‹
            </button>
            <span className="text-xs text-gray-300">
              {currentPage} / {numPages || "—"}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
            >
              ›
            </button>
          </div>
          <button
            onClick={() => downloadMutation.mutate()}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs"
          >
            Baixar
          </button>
        </div>

        {/* PDF canvas */}
        <div className="flex-1 overflow-auto flex justify-center p-4">
          {pdfUrl ? (
            <div ref={pdfContainerRef} className="relative">
              <PdfDocument
                file={pdfUrl}
                onLoadSuccess={({ numPages: n }) => {
                  setNumPages(n);
                  setPdfLoaded(true);
                }}
                onLoadError={() => toast.error("Erro ao carregar PDF")}
              >
                <Page
                  pageNumber={currentPage}
                  width={700}
                  renderTextLayer={!annotationMode}
                  renderAnnotationLayer={!annotationMode}
                />
              </PdfDocument>

              {/* Annotation overlays */}
              {annotations
                .filter((a) => a.page === currentPage)
                .map((a) => (
                  <div
                    key={a.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${a.rect.x * 100}%`,
                      top: `${a.rect.y * 100}%`,
                      width: `${a.rect.width * 100}%`,
                      height: `${a.rect.height * 100}%`,
                      backgroundColor: a.color,
                      opacity: 0.4,
                      borderRadius: "2px",
                    }}
                    title={`${a.user_name ?? "?"}: ${a.content ?? a.selected_text ?? ""}`}
                  />
                ))}

              {/* Transparent overlay to capture clicks in annotation mode, sits above text layer */}
              {annotationMode && (
                <div
                  className="absolute inset-0 cursor-crosshair z-10"
                  onClick={handlePdfClick}
                />
              )}
            </div>
          ) : doc && doc.mime_type !== "application/pdf" ? (
            <div className="flex flex-col items-center justify-center text-gray-400 mt-24 gap-4">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Visualização não disponível para este tipo de arquivo</p>
              <button
                onClick={() => downloadMutation.mutate()}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-500"
              >
                Baixar arquivo
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center text-gray-400 mt-24">
              <p className="text-sm">Carregando PDF…</p>
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
        {/* Doc title */}
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 text-sm truncate">{doc.title}</h2>
          <p className="text-xs text-gray-400">{doc.filename} · {formatSize(doc.size)}</p>
          {canEdit && (
            <button
              onClick={() => {
                if (confirm("Remover este documento?")) deleteMutation.mutate();
              }}
              className="mt-2 text-xs text-red-500 hover:text-red-700"
            >
              Remover documento
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* INFO TAB */}
          {activeTab === "info" && (
            <div className="space-y-3 text-sm">
              <Row label="Status OCR">
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
              </Row>
              <Row label="Pesquisável">{doc.is_searchable ? "Sim" : "Não"}</Row>
              <Row label="Enviado em">{format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</Row>
              <Row label="Vencimento">
                <span
                  className={
                    doc.expires_at && new Date(doc.expires_at) < new Date()
                      ? "text-red-600 font-medium"
                      : ""
                  }
                >
                  {doc.expires_at ? format(new Date(doc.expires_at), "dd/MM/yyyy") : "—"}
                </span>
              </Row>

              {/* Groups */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-1">Grupos</p>
                {groups.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum grupo (visível só para você e admins)</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {groups.map((g) => (
                      <span
                        key={g.id}
                        className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-gray-500 font-medium mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t.key}
                        className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ backgroundColor: t.value.startsWith("#") ? t.value : "#6B7280" }}
                      >
                        {t.key.replace("tag:", "")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {canEdit && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <p className="text-xs text-gray-500">Alterar vencimento</p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      className="input text-xs flex-1"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                    <button
                      className="btn-secondary text-xs py-1"
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
          )}

          {/* METADATA TAB */}
          {activeTab === "metadata" && (
            <div className="space-y-2">
              {nonTagMeta.length === 0 && (
                <p className="text-xs text-gray-400">Nenhum metadado</p>
              )}
              {nonTagMeta.map((m) => (
                <div key={m.key} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-700 mr-2 text-xs">{m.key}</span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="text-gray-500 text-xs truncate max-w-[120px]">{m.value}</span>
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
              {canEdit && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="Chave"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                  />
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="Valor"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
                  <button
                    className="btn-primary w-full text-xs"
                    disabled={!newKey || !newValue || addMetaMutation.isPending}
                    onClick={() => addMetaMutation.mutate([{ key: newKey, value: newValue }])}
                  >
                    Adicionar metadado
                  </button>

                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Adicionar tag</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input text-xs flex-1"
                        placeholder="Nome da tag"
                        value={tagName}
                        onChange={(e) => setTagName(e.target.value)}
                      />
                      <input
                        type="color"
                        value={tagColor}
                        onChange={(e) => setTagColor(e.target.value)}
                        className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                      />
                      <button
                        className="btn-secondary text-xs"
                        disabled={!tagName || addTagMutation.isPending}
                        onClick={() => addTagMutation.mutate(tagName)}
                      >
                        Tag
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PROCESS TAB */}
          {activeTab === "process" && (
            <div className="space-y-4">
              {/* Current state badge */}
              {currentState ? (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: currentState.color }}
                >
                  <span className="w-2 h-2 rounded-full bg-white/60 inline-block" />
                  {currentState.label}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Nenhum tipo de processo atribuído</p>
              )}

              {/* Assign process type */}
              {canEdit && !doc.process_type_id && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Atribuir tipo de processo</p>
                  <select
                    className="input text-xs"
                    value={selectedProcessTypeId}
                    onChange={(e) => setSelectedProcessTypeId(e.target.value)}
                  >
                    <option value="">Selecionar...</option>
                    {processTypes.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!selectedProcessTypeId || assignProcessTypeMutation.isPending}
                    onClick={() => assignProcessTypeMutation.mutate(selectedProcessTypeId)}
                    className="btn-primary w-full text-xs"
                  >
                    Atribuir
                  </button>
                </div>
              )}

              {/* Available transitions */}
              {availableTransitions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Transições disponíveis</p>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="Comentário (opcional)"
                    value={transitionComment}
                    onChange={(e) => setTransitionComment(e.target.value)}
                  />
                  {availableTransitions.map((t) => {
                    const toState = processTypeDetail?.states?.find((s) => s.id === t.to_state_id);
                    return (
                      <button
                        key={t.id}
                        onClick={() =>
                          transitionMutation.mutate({
                            to_state_id: t.to_state_id,
                            comment: transitionComment || undefined,
                          })
                        }
                        className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 text-xs transition-colors"
                      >
                        <span className="font-medium">{t.label}</span>
                        {toState && (
                          <span
                            className="ml-2 px-1.5 py-0.5 rounded text-white text-xs"
                            style={{ backgroundColor: toState.color }}
                          >
                            {toState.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* History */}
              {history.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Histórico</p>
                  {history.map((h) => (
                    <div key={h.id} className="text-xs border-l-2 border-gray-200 pl-2">
                      <div className="flex items-center gap-1">
                        {h.from_state_label && (
                          <>
                            <span className="text-gray-500">{h.from_state_label}</span>
                            <span className="text-gray-400">→</span>
                          </>
                        )}
                        <span className="font-medium text-gray-700">{h.to_state_label}</span>
                      </div>
                      <div className="text-gray-400">
                        {h.changed_by_name ?? "Sistema"} ·{" "}
                        {format(new Date(h.changed_at), "dd/MM HH:mm")}
                      </div>
                      {h.comment && <div className="text-gray-500 italic">{h.comment}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DEADLINES TAB */}
          {activeTab === "deadlines" && (
            <div className="space-y-3">
              {deadlines.map((dl) => (
                <div
                  key={dl.id}
                  className={`p-3 rounded-lg border text-xs ${
                    dl.status === "met"
                      ? "border-green-200 bg-green-50"
                      : dl.status === "missed"
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium text-gray-800">{dl.label}</span>
                      <div className="text-gray-500 mt-0.5">
                        {format(new Date(dl.due_at), "dd/MM/yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          dl.status === "met"
                            ? "bg-green-100 text-green-700"
                            : dl.status === "missed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {dl.status}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => deleteDeadlineMutation.mutate(dl.id)}
                          className="text-gray-300 hover:text-red-500 text-base leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  {dl.alert_days_before.length > 0 && (
                    <div className="text-gray-400 mt-1">
                      Alertas: {dl.alert_days_before.join(", ")} dias antes
                    </div>
                  )}
                </div>
              ))}

              {deadlines.length === 0 && (
                <p className="text-xs text-gray-400">Nenhum prazo definido</p>
              )}

              {canEdit && (
                <>
                  {!showDlForm ? (
                    <button
                      onClick={() => setShowDlForm(true)}
                      className="btn-secondary w-full text-xs"
                    >
                      + Novo prazo
                    </button>
                  ) : (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <input
                        type="text"
                        className="input text-xs"
                        placeholder="Rótulo do prazo"
                        value={dlLabel}
                        onChange={(e) => setDlLabel(e.target.value)}
                      />
                      <input
                        type="datetime-local"
                        className="input text-xs"
                        value={dlDueAt}
                        onChange={(e) => setDlDueAt(e.target.value)}
                      />
                      <input
                        type="text"
                        className="input text-xs"
                        placeholder="Alertas em dias (ex: 7,3,1)"
                        value={dlAlertDays}
                        onChange={(e) => setDlAlertDays(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={!dlLabel || !dlDueAt || createDeadlineMutation.isPending}
                          onClick={() =>
                            createDeadlineMutation.mutate({
                              label: dlLabel,
                              due_at: new Date(dlDueAt).toISOString(),
                              alert_days_before: dlAlertDays
                                .split(",")
                                .map((d) => parseInt(d.trim()))
                                .filter((d) => !isNaN(d)),
                            })
                          }
                          className="btn-primary text-xs flex-1"
                        >
                          Criar
                        </button>
                        <button
                          onClick={() => setShowDlForm(false)}
                          className="btn-secondary text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ANNOTATIONS TAB */}
          {activeTab === "annotations" && (
            <div className="space-y-3">
              {/* Annotation tools */}
              <div className="flex gap-2 pb-2 border-b border-gray-100">
                <button
                  onClick={() =>
                    setAnnotationMode(annotationMode === "highlight" ? null : "highlight")
                  }
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    annotationMode === "highlight"
                      ? "border-yellow-400 bg-yellow-50 text-yellow-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Destacar
                </button>
                <button
                  onClick={() =>
                    setAnnotationMode(annotationMode === "comment" ? null : "comment")
                  }
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    annotationMode === "comment"
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Comentar
                </button>
                <input
                  type="color"
                  value={newAnnotColor}
                  onChange={(e) => setNewAnnotColor(e.target.value)}
                  className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
                  title="Cor da anotação"
                />
              </div>

              {annotationMode && (
                <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1.5 rounded">
                  {annotationMode === "comment" && (
                    <input
                      type="text"
                      className="input text-xs mb-1"
                      placeholder="Texto do comentário"
                      value={newAnnotContent}
                      onChange={(e) => setNewAnnotContent(e.target.value)}
                    />
                  )}
                  Clique no PDF para adicionar anotação na página {currentPage}
                </div>
              )}

              {/* Annotation list */}
              {annotations.length === 0 && (
                <p className="text-xs text-gray-400">Nenhuma anotação</p>
              )}
              {annotations.map((a) => (
                <div
                  key={a.id}
                  className={`p-2 rounded border text-xs ${
                    a.page === currentPage ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3 h-3 rounded-sm inline-block"
                        style={{ backgroundColor: a.color }}
                      />
                      <span className="font-medium text-gray-700">{a.user_name ?? "?"}</span>
                      <span className="text-gray-400">p.{a.page}</span>
                    </div>
                    {(a.user_id === user?.id || isAdmin) && (
                      <button
                        onClick={() => deleteAnnotationMutation.mutate(a.id)}
                        className="text-gray-300 hover:text-red-500 text-base leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {a.content && <p className="text-gray-600 mt-0.5">{a.content}</p>}
                  {a.selected_text && (
                    <p className="text-gray-400 italic mt-0.5 truncate">"{a.selected_text}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="text-xs">{children}</span>
    </div>
  );
}
