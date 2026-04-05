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
  process_type_id: string | null;
  current_state_id: string | null;
  assigned_to: string | null;
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

// Roles (RBAC)
export type PermissionLevel = "viewer" | "editor";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permission_level: PermissionLevel;
  created_by: string | null;
  created_at: string;
}

export interface RoleDocument {
  role_id: string;
  document_id: string;
  document_title?: string;
  document_filename?: string;
}

export interface RoleBinding {
  role_id: string;
  subject_id: string;
  subject_type: "user" | "group";
  subject_name?: string;
  subject_email?: string | null;
  assigned_at: string;
}

// Groups
export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  added_by: string | null;
  added_at: string;
  user_name?: string;
  user_email?: string;
}

// Process types / states / transitions
export interface ProcessType {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProcessState {
  id: string;
  process_type_id: string;
  name: string;
  label: string;
  is_initial: boolean;
  is_terminal: boolean;
  color: string;
  position_order: number;
}

export interface ProcessTransition {
  id: string;
  process_type_id: string;
  from_state_id: string;
  to_state_id: string;
  label: string;
  required_role: UserRole | null;
}

export interface ProcessHistory {
  id: string;
  document_id: string;
  from_state_id: string | null;
  to_state_id: string;
  changed_by: string | null;
  comment: string | null;
  changed_at: string;
  from_state_label?: string;
  to_state_label?: string;
  changed_by_name?: string;
}

// Deadlines
export type DeadlineStatus = "pending" | "met" | "missed";

export interface ProcessDeadline {
  id: string;
  document_id: string;
  label: string;
  due_at: string;
  target_state_id: string | null;
  alert_days_before: number[];
  status: DeadlineStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Metadata schemas
export interface SchemaField {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "select";
  required: boolean;
  options?: string[];
  hint?: string;
}

// PDF annotations
export type AnnotationType = "highlight" | "comment";

export interface AnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfAnnotation {
  id: string;
  document_id: string;
  user_id: string | null;
  page: number;
  type: AnnotationType;
  rect: AnnotationRect;
  selected_text: string | null;
  content: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

// Facets
export interface DocumentFacets {
  by_process_type: { process_type_id: string; name: string; count: number }[];
  by_state: { current_state_id: string; label: string; color: string; count: number }[];
  by_assigned_to: { assigned_to: string; name: string; count: number }[];
}
