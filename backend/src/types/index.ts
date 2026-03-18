export type UserRole = "admin" | "editor" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: "access" | "refresh";
}

export interface Document {
  id: string;
  title: string;
  filename: string;
  storage_key: string;
  mime_type: string;
  size: number;
  uploader_id: string;
  expires_at: Date | null;
  is_searchable: boolean;
  ocr_status: "pending" | "processing" | "done" | "failed";
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface DocumentMetadata {
  id: string;
  document_id: string;
  key: string;
  value: string;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  document_id: string | null;
  user_id: string | null;
  action: AuditAction;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export type AuditAction =
  | "user.register"
  | "user.login"
  | "user.logout"
  | "document.upload"
  | "document.view"
  | "document.download"
  | "document.delete"
  | "document.restore"
  | "document.metadata.update"
  | "document.expiry.update"
  | "ocr.started"
  | "ocr.completed"
  | "ocr.failed";

export interface Plan {
  id: string;
  name: string;
  max_docs: number | null;
  max_storage_gb: number | null;
  price: number;
  created_at: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
