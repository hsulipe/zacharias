import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { PaginatedResult, Document } from "../types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { data: docsData } = useQuery({
    queryKey: ["documents", { page: 1, limit: 5 }],
    queryFn: () =>
      api.get<PaginatedResult<Document>>("/documents", { params: { page: 1, limit: 5 } }).then((r) => r.data),
  });

  const docs = docsData?.data ?? [];

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-6">
          <p className="text-sm text-gray-500">Total de documentos</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{docsData?.total ?? "—"}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500">Documentos pesquisáveis</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {docs.filter((d) => d.is_searchable).length}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500">Com OCR pendente</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {docs.filter((d) => d.ocr_status === "pending" || d.ocr_status === "processing").length}
          </p>
        </div>
      </div>

      {/* Recent documents */}
      <div className="card">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Documentos recentes</h3>
          <Link to="/documents" className="text-sm text-primary-600 hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {docs.length === 0 && (
            <p className="p-6 text-sm text-gray-400 text-center">Nenhum documento encontrado</p>
          )}
          {docs.map((doc) => (
            <Link
              key={doc.id}
              to={`/documents/${doc.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDistanceToNow(new Date(doc.created_at), { locale: ptBR, addSuffix: true })}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  doc.ocr_status === "done"
                    ? "bg-green-100 text-green-700"
                    : doc.ocr_status === "failed"
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {doc.ocr_status === "done"
                  ? "Pesquisável"
                  : doc.ocr_status === "failed"
                  ? "OCR falhou"
                  : "Processando OCR"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
