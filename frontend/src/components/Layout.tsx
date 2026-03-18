import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../hooks/useAuthStore";

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-primary-900 text-white flex flex-col">
        <div className="p-6 border-b border-primary-700">
          <h1 className="text-xl font-bold">GED</h1>
          <p className="text-xs text-primary-100 mt-1">Gerenc. Eletrônico de Docs</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                isActive ? "bg-primary-700 text-white" : "text-primary-100 hover:bg-primary-800"
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/documents"
            className={({ isActive }) =>
              `flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                isActive ? "bg-primary-700 text-white" : "text-primary-100 hover:bg-primary-800"
              }`
            }
          >
            Documentos
          </NavLink>
          {user?.role === "admin" && (
            <>
              <NavLink
                to="/users"
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                    isActive ? "bg-primary-700 text-white" : "text-primary-100 hover:bg-primary-800"
                  }`
                }
              >
                Usuários
              </NavLink>
              <NavLink
                to="/audit"
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                    isActive ? "bg-primary-700 text-white" : "text-primary-100 hover:bg-primary-800"
                  }`
                }
              >
                Auditoria
              </NavLink>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-primary-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-sm font-semibold">
              {user?.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-primary-300 capitalize">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full text-left text-xs text-primary-300 hover:text-white transition-colors">
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
