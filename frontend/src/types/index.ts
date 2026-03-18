export type UserRole = "admin" | "editor" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  filename: string;
  storage_key: string;
  mime_type: string;
  size: number;
  uploader_id: string;
  expires_at: string | null;
  is_searchable: boolean;
  ocr_status: "pending" | "processing" | "done" | "failed";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentMetadata {
  id: string;
  document_id: string;
  key: string;
  value: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  document_id: string | null;
  user_id: string | null;
  action: string;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AuthState {
  user: User | null;
  access_token: string | null;
  isAuthenticated: boolean;
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
}
