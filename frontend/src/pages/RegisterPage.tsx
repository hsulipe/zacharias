import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register", { name, email, password });
      toast.success("Conta criada! Faça login.");
      navigate("/login");
    } catch (err: any) {
      const msg = err.response?.data?.error ?? "Erro ao criar conta";
      toast.error(msg === "Email already in use" ? "E-mail já cadastrado" : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Criar conta</h1>
          <p className="text-gray-500 text-sm mt-1">GED — Gerenciamento Eletrônico de Documentos</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">Nome completo</label>
            <input
              id="name"
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-gray-400 mt-1">Mínimo de 8 caracteres</p>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary-600 hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
