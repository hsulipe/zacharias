import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";
import { ProcessType, ProcessState, ProcessTransition } from "../types";
import toast from "react-hot-toast";

interface ProcessTypeDetail {
  process_type: ProcessType;
  states: ProcessState[];
  transitions: ProcessTransition[];
}

const ROLE_OPTIONS = [
  { value: "", label: "Qualquer papel" },
  { value: "admin", label: "Somente admin" },
  { value: "editor", label: "Editor ou admin" },
];

const COLOR_PRESETS = [
  "#6B7280", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899",
];

export default function ProcessTypesPage() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<ProcessType | null>(null);
  const [showCreateType, setShowCreateType] = useState(false);
  const [showCreateState, setShowCreateState] = useState(false);
  const [showCreateTransition, setShowCreateTransition] = useState(false);

  // Create type form
  const [typeName, setTypeName] = useState("");
  const [typeDesc, setTypeDesc] = useState("");

  // Create state form
  const [stateName, setStateName] = useState("");
  const [stateLabel, setStateLabel] = useState("");
  const [stateIsInitial, setStateIsInitial] = useState(false);
  const [stateIsTerminal, setStateIsTerminal] = useState(false);
  const [stateColor, setStateColor] = useState("#6B7280");
  const [stateOrder, setStateOrder] = useState(0);

  // Create transition form
  const [transFrom, setTransFrom] = useState("");
  const [transTo, setTransTo] = useState("");
  const [transLabel, setTransLabel] = useState("");
  const [transRole, setTransRole] = useState("");

  const { data: typesData } = useQuery({
    queryKey: ["process-types"],
    queryFn: () =>
      api.get<{ process_types: ProcessType[] }>("/process-types").then((r) => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ["process-type", selectedType?.id],
    queryFn: () =>
      api
        .get<ProcessTypeDetail>(`/process-types/${selectedType!.id}`)
        .then((r) => r.data),
    enabled: !!selectedType,
  });

  const createTypeMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      api.post<{ process_type: ProcessType }>("/process-types", data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["process-types"] });
      setShowCreateType(false);
      setTypeName("");
      setTypeDesc("");
      toast.success(`Tipo "${data.process_type.name}" criado`);
    },
    onError: () => toast.error("Erro ao criar tipo de processo"),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/process-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-types"] });
      setSelectedType(null);
      toast.success("Tipo removido");
    },
    onError: () => toast.error("Erro ao remover tipo"),
  });

  const createStateMutation = useMutation({
    mutationFn: (data: object) =>
      api.post(`/process-types/${selectedType!.id}/states`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-type", selectedType?.id] });
      setShowCreateState(false);
      setStateName("");
      setStateLabel("");
      setStateIsInitial(false);
      setStateIsTerminal(false);
      setStateColor("#6B7280");
      setStateOrder(0);
      toast.success("Estado criado");
    },
    onError: () => toast.error("Erro ao criar estado"),
  });

  const deleteStateMutation = useMutation({
    mutationFn: (stateId: string) =>
      api.delete(`/process-types/${selectedType!.id}/states/${stateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-type", selectedType?.id] });
      toast.success("Estado removido");
    },
    onError: () => toast.error("Erro ao remover estado"),
  });

  const createTransitionMutation = useMutation({
    mutationFn: (data: object) =>
      api.post(`/process-types/${selectedType!.id}/transitions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-type", selectedType?.id] });
      setShowCreateTransition(false);
      setTransFrom("");
      setTransTo("");
      setTransLabel("");
      setTransRole("");
      toast.success("Transição criada");
    },
    onError: () => toast.error("Erro ao criar transição"),
  });

  const deleteTransitionMutation = useMutation({
    mutationFn: (transId: string) =>
      api.delete(`/process-types/${selectedType!.id}/transitions/${transId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-type", selectedType?.id] });
      toast.success("Transição removida");
    },
    onError: () => toast.error("Erro ao remover transição"),
  });

  const types = typesData?.process_types ?? [];
  const states = detail?.states ?? [];
  const transitions = detail?.transitions ?? [];

  const stateMap = new Map(states.map((s) => [s.id, s]));

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tipos de Processo</h2>
        <button onClick={() => setShowCreateType(true)} className="btn-primary">
          Novo tipo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Type list */}
        <div className="card p-4">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">Tipos</h3>
          {types.length === 0 && <p className="text-xs text-gray-400">Nenhum tipo</p>}
          <div className="space-y-1">
            {types.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedType?.id === t.id
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        {selectedType && (
          <div className="md:col-span-3 space-y-4">
            <div className="card p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedType.name}</h3>
                  {selectedType.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{selectedType.description}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Remover tipo "${selectedType.name}"?`)) {
                      deleteTypeMutation.mutate(selectedType.id);
                    }
                  }}
                  className="btn-danger text-xs"
                >
                  Remover tipo
                </button>
              </div>
            </div>

            {/* States */}
            <div className="card p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-800 text-sm">Estados</h4>
                <button onClick={() => setShowCreateState(true)} className="btn-secondary text-xs">
                  + Estado
                </button>
              </div>
              <div className="space-y-2">
                {states.length === 0 && <p className="text-xs text-gray-400">Nenhum estado</p>}
                {states.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="font-medium">{s.label}</span>
                      <span className="text-gray-400 text-xs">({s.name})</span>
                      {s.is_initial && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          inicial
                        </span>
                      )}
                      {s.is_terminal && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          terminal
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteStateMutation.mutate(s.id)}
                      className="text-gray-300 hover:text-red-500 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Transitions */}
            <div className="card p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-800 text-sm">Transições</h4>
                <button onClick={() => setShowCreateTransition(true)} className="btn-secondary text-xs">
                  + Transição
                </button>
              </div>
              <div className="space-y-2">
                {transitions.length === 0 && <p className="text-xs text-gray-400">Nenhuma transição</p>}
                {transitions.map((t) => (
                  <div
                    key={t.id}
                    className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{stateMap.get(t.from_state_id)?.label ?? "?"}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-700 font-medium">{stateMap.get(t.to_state_id)?.label ?? "?"}</span>
                      <span className="text-gray-400 italic text-xs">"{t.label}"</span>
                      {t.required_role && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                          {t.required_role}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteTransitionMutation.mutate(t.id)}
                      className="text-gray-300 hover:text-red-500 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create type modal */}
      {showCreateType && (
        <Modal title="Novo tipo de processo" onClose={() => setShowCreateType(false)}>
          <div className="space-y-3">
            <input
              className="input"
              placeholder="Nome (ex: Licitação, Contrato)"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Descrição (opcional)"
              value={typeDesc}
              onChange={(e) => setTypeDesc(e.target.value)}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              disabled={!typeName || createTypeMutation.isPending}
              onClick={() => createTypeMutation.mutate({ name: typeName, description: typeDesc })}
              className="btn-primary flex-1"
            >
              Criar
            </button>
            <button onClick={() => setShowCreateType(false)} className="btn-secondary flex-1">
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {/* Create state modal */}
      {showCreateState && selectedType && (
        <Modal title="Novo estado" onClose={() => setShowCreateState(false)}>
          <div className="space-y-3">
            <input
              className="input"
              placeholder="Nome técnico (ex: aprovado)"
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Rótulo (ex: Aprovado)"
              value={stateLabel}
              onChange={(e) => setStateLabel(e.target.value)}
            />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={stateIsInitial}
                  onChange={(e) => setStateIsInitial(e.target.checked)}
                />
                Estado inicial
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={stateIsTerminal}
                  onChange={(e) => setStateIsTerminal(e.target.checked)}
                />
                Estado terminal
              </label>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Cor</p>
              <div className="flex gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStateColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      stateColor === c ? "border-gray-900 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <input
              type="number"
              className="input"
              placeholder="Ordem (0, 1, 2...)"
              value={stateOrder}
              onChange={(e) => setStateOrder(Number(e.target.value))}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              disabled={!stateName || !stateLabel || createStateMutation.isPending}
              onClick={() =>
                createStateMutation.mutate({
                  name: stateName,
                  label: stateLabel,
                  is_initial: stateIsInitial,
                  is_terminal: stateIsTerminal,
                  color: stateColor,
                  position_order: stateOrder,
                })
              }
              className="btn-primary flex-1"
            >
              Criar
            </button>
            <button onClick={() => setShowCreateState(false)} className="btn-secondary flex-1">
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {/* Create transition modal */}
      {showCreateTransition && selectedType && (
        <Modal title="Nova transição" onClose={() => setShowCreateTransition(false)}>
          <div className="space-y-3">
            <select
              className="input"
              value={transFrom}
              onChange={(e) => setTransFrom(e.target.value)}
            >
              <option value="">De (estado origem)...</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <select
              className="input"
              value={transTo}
              onChange={(e) => setTransTo(e.target.value)}
            >
              <option value="">Para (estado destino)...</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Rótulo (ex: Aprovar)"
              value={transLabel}
              onChange={(e) => setTransLabel(e.target.value)}
            />
            <select
              className="input"
              value={transRole}
              onChange={(e) => setTransRole(e.target.value)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              disabled={!transFrom || !transTo || !transLabel || createTransitionMutation.isPending}
              onClick={() =>
                createTransitionMutation.mutate({
                  from_state_id: transFrom,
                  to_state_id: transTo,
                  label: transLabel,
                  required_role: transRole || undefined,
                })
              }
              className="btn-primary flex-1"
            >
              Criar
            </button>
            <button onClick={() => setShowCreateTransition(false)} className="btn-secondary flex-1">
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose: _onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
