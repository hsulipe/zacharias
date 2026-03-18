import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import api from "../services/api";
import { AuditLog, PaginatedResult } from "../types";

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const limit = 30;

  const { data, isLoading } = useQuery({
    queryKey: ["audit", { page, limit }],
    queryFn: () =>
      api.get<PaginatedResult<AuditLog>>("/audit", { params: { page, limit } }).then((r) => r.data),
  });

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Log de Auditoria</h2>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Data/Hora</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ação</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Usuário</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Documento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">IP</th>
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
            {data?.data.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss")}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                  {log.user_id?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                  {log.document_id?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{log.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.pages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              {data.total} registro(s) — Página {page} de {data.pages}
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
  );
}
