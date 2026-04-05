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
  process_type_id: string | null;
  current_state_id: string | null;
  assigned_to: string | null;
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
  | "document.process_type.assign"
  | "document.state.transition"
  | "document.group.assign"
  | "document.group.remove"
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

// Roles (RBAC)
export type PermissionLevel = "viewer" | "editor";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permission_level: PermissionLevel;
  created_by: string | null;
  created_at: Date;
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
  assigned_at: Date;
}

// Groups
export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  added_by: string | null;
  added_at: Date;
  user_name?: string;
  user_email?: string;
}

// Process types / states / transitions
export interface ProcessType {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
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
  changed_at: Date;
  // joined fields
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
  due_at: Date;
  target_state_id: string | null;
  alert_days_before: number[];
  status: DeadlineStatus;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
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

export interface MetadataSchema {
  id: string;
  process_type_id: string;
  fields: SchemaField[];
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
  updated_at: Date;
  // joined
  user_name?: string;
}
