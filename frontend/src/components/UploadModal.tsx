import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import api from "../services/api";
import toast from "react-hot-toast";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Selecione um arquivo PDF");

    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);
    if (expiresAt) formData.append("expires_at", new Date(expiresAt).toISOString());

    setUploading(true);
    try {
      await api.post("/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Documento enviado com sucesso!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Erro ao enviar documento");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="card w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Enviar documento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary-500 bg-primary-50" : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">Arraste um PDF ou clique para selecionar</p>
                <p className="text-xs text-gray-400 mt-1">Somente arquivos PDF, máx. 50 MB</p>
              </div>
            )}
          </div>

          <div>
            <label className="label" htmlFor="title">Título</label>
            <input
              id="title"
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do documento"
            />
          </div>

          <div>
            <label className="label" htmlFor="expires">Data de vencimento (opcional)</label>
            <input
              id="expires"
              type="date"
              className="input"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={uploading || !file}>
              {uploading ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
