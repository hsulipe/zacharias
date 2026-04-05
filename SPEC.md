# GED — Spec-Driven Development Specification

> **Methodology:** Spec-Anchored SDD (Piskala, 2026).
> This document is the authoritative source of truth. Code is derived from and verified against it.
> When code and spec conflict, the spec governs. Update this file before changing behavior.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Actors & System Roles](#2-actors--system-roles)
3. [Data Model](#3-data-model)
4. [API Contract](#4-api-contract)
5. [Feature Specifications](#5-feature-specifications)
   - [F-01 Authentication](#f-01-authentication)
   - [F-02 Document Lifecycle](#f-02-document-lifecycle)
   - [F-03 OCR Processing](#f-03-ocr-processing)
   - [F-04 Metadata & Schemas](#f-04-metadata--schemas)
   - [F-05 Tags](#f-05-tags)
   - [F-06 Search & Facets](#f-06-search--facets)
   - [F-07 Audit Log](#f-07-audit-log)
   - [F-08 Expiry Management](#f-08-expiry-management)
   - [F-09 Process Types & States](#f-09-process-types--states)
   - [F-10 Deadline Management](#f-10-deadline-management)
   - [F-11 Group RBAC](#f-11-group-rbac)
   - [F-12 PDF Viewer & Annotations](#f-12-pdf-viewer--annotations)
   - [F-13 Roles (Fine-Grained RBAC)](#f-13-roles-fine-grained-rbac)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Acceptance Criteria Index](#7-acceptance-criteria-index)

---

## 1. Product Overview

**GED** (Gerenciamento Eletrônico de Documentos) is an open-source, self-hostable Electronic Document Management System targeting Brazilian government and enterprise clients.

**Goals:**
- Digitize, store, and serve searchable PDFs with full audit trails
- Enforce configurable document lifecycle workflows (process types + state machines)
- Provide fine-grained access control (groups + roles)
- Run entirely on-premises via Docker Compose

**License:** AGPL-3.0
**MVP Deadline:** 2027-01-04
**Rigor Level:** Spec-Anchored — specs maintained alongside code; tests enforce alignment

---

## 2. Actors & System Roles

| Actor | Description | System `role` value |
|-------|-------------|---------------------|
| **Guest** | Unauthenticated request | — |
| **Viewer** | Authenticated user; read/download access | `viewer` |
| **Editor** | Authenticated user; metadata & annotation writes | `editor` |
| **Admin** | Full access including user, group, role, and config management | `admin` |
| **System** | Automated process (cron, OCR worker); no HTTP session | — |

**Visibility rules (document access):**
- A document with no group assigned is visible only to its uploader and admins.
- A document assigned to one or more groups is visible to all members of those groups and admins.
- Admins always see all documents regardless of group assignment.

---

## 3. Data Model

### Core tables

```
users           id, name, email, password_hash, role, plan_id, created_at, updated_at
documents       id, title, filename, storage_key, mime_type, size, uploader_id,
                expires_at, is_searchable, ocr_status, process_type_id,
                current_state_id, assigned_to, created_at, updated_at, deleted_at
document_metadata  id, document_id, key, value, created_at
audit_logs      id, document_id, user_id, action, ip, metadata, created_at
```

### Groups

```
groups              id, name, description, created_by, created_at
group_members       group_id, user_id, added_by, added_at
document_groups     document_id, group_id, added_by, added_at
```

### Roles (Fine-Grained RBAC)

```
roles               id, name, description, permission_level (viewer|editor),
                    created_by, created_at
role_documents      role_id, document_id
user_role_bindings  user_id, role_id, assigned_by, assigned_at
group_role_bindings group_id, role_id, assigned_by, assigned_at
```

### Process workflow

```
process_types       id, name, description, created_by, created_at
process_states      id, process_type_id, name, label, is_initial, is_terminal,
                    color, position_order
process_transitions id, process_type_id, from_state_id, to_state_id, label, required_role
process_history     id, document_id, from_state_id, to_state_id, changed_by,
                    comment, changed_at
metadata_schemas    id, process_type_id, fields (JSONB), created_at, updated_at
```

### Deadlines & Annotations

```
process_deadlines   id, document_id, label, due_at, target_state_id,
                    alert_days_before (int[]), status (pending|met|missed),
                    created_by, created_at, updated_at
pdf_annotations     id, document_id, user_id, page, type (highlight|comment),
                    rect (JSONB), selected_text, content, color,
                    created_at, updated_at
```

### Plans

```
plans               id, name, max_docs, max_storage_gb, price, created_at
```

---

## 4. API Contract

Base path: `/api` (all routes below are relative to this prefix).
All authenticated routes require `Authorization: Bearer <access_token>`.
All responses are `application/json`. Errors return `{ "error": "<message>" }`.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | None | Register new user |
| POST | `/auth/login` | None | Obtain access + refresh tokens |
| POST | `/auth/refresh` | None | Rotate tokens using refresh token |
| POST | `/auth/logout` | Bearer | Invalidate session |
| GET | `/auth/me` | Bearer | Current user profile |
| GET | `/auth/users` | Admin | List all users |
| PATCH | `/auth/users/:id/role` | Admin | Update user role |

### Documents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/documents` | Bearer (multipart) | Upload document |
| GET | `/documents` | Bearer | List/search documents (paginated) |
| GET | `/documents/:id` | Bearer | Get document detail |
| PATCH | `/documents/:id` | Bearer | Update title, assigned_to |
| DELETE | `/documents/:id` | Bearer | Soft-delete document |
| POST | `/documents/:id/restore` | Admin | Restore soft-deleted document |
| GET | `/documents/:id/download` | Bearer | Signed download URL or redirect |
| GET | `/documents/facets` | Bearer | Aggregated facets for filters |
| PATCH | `/documents/:id/expiry` | Bearer | Set or clear expires_at |
| PUT | `/documents/:id/metadata` | Bearer | Replace all metadata key-value pairs |
| GET | `/documents/:id/metadata` | Bearer | Get all metadata key-value pairs |
| POST | `/documents/:id/groups` | Admin | Assign document to group |
| DELETE | `/documents/:id/groups/:groupId` | Admin | Remove document from group |
| POST | `/documents/:id/process-type` | Bearer | Assign process type (sets initial state) |
| POST | `/documents/:id/transitions` | Bearer | Execute a state transition |
| GET | `/documents/:id/history` | Bearer | Get process state history |
| GET | `/documents/:id/schema-validation` | Bearer | Validate metadata against process schema |

### Groups

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/groups` | Admin | List all groups |
| POST | `/groups` | Admin | Create group |
| GET | `/groups/:id` | Admin | Get group detail (with members) |
| PATCH | `/groups/:id` | Admin | Update group name/description |
| DELETE | `/groups/:id` | Admin | Delete group |
| POST | `/groups/:id/members` | Admin | Add user to group |
| DELETE | `/groups/:id/members/:userId` | Admin | Remove user from group |

### Roles

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/roles` | Admin | List all roles |
| POST | `/roles` | Admin | Create role |
| GET | `/roles/:id` | Admin | Get role with documents, user bindings, group bindings |
| PATCH | `/roles/:id` | Admin | Update role |
| DELETE | `/roles/:id` | Admin | Delete role (cascades bindings) |
| POST | `/roles/:id/documents` | Admin | Add document to role |
| DELETE | `/roles/:id/documents/:documentId` | Admin | Remove document from role |
| POST | `/roles/:id/users` | Admin | Bind user to role |
| DELETE | `/roles/:id/users/:userId` | Admin | Unbind user from role |
| POST | `/roles/:id/groups` | Admin | Bind group to role |
| DELETE | `/roles/:id/groups/:groupId` | Admin | Unbind group from role |

### Process Types

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/process-types` | Bearer | List all process types |
| POST | `/process-types` | Admin | Create process type |
| GET | `/process-types/:id` | Bearer | Get process type with states and transitions |
| DELETE | `/process-types/:id` | Admin | Delete process type |
| POST | `/process-types/:id/states` | Admin | Create state |
| PATCH | `/process-types/:id/states/:stateId` | Admin | Update state |
| DELETE | `/process-types/:id/states/:stateId` | Admin | Delete state |
| POST | `/process-types/:id/transitions` | Admin | Create transition |
| DELETE | `/process-types/:id/transitions/:transId` | Admin | Delete transition |
| PUT | `/process-types/:id/schema` | Admin | Upsert metadata schema |
| GET | `/process-types/:id/schema` | Bearer | Get metadata schema |

### Deadlines

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/documents/:id/deadlines` | Bearer | List document deadlines |
| POST | `/documents/:id/deadlines` | Bearer | Create deadline |
| PATCH | `/documents/:id/deadlines/:deadlineId` | Bearer | Update deadline |
| DELETE | `/documents/:id/deadlines/:deadlineId` | Bearer | Delete deadline |

### Annotations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/documents/:id/annotations` | Bearer | List annotations for document |
| POST | `/documents/:id/annotations` | Bearer | Create annotation |
| PATCH | `/documents/:id/annotations/:annotId` | Bearer | Update annotation |
| DELETE | `/documents/:id/annotations/:annotId` | Bearer | Delete annotation |

### Audit

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/audit` | Admin | List audit log entries (paginated, filterable) |

---

## 5. Feature Specifications

---

### F-01 Authentication

**User story:** As a user, I want to authenticate with email and password so that my actions are tracked and I can access documents I am permitted to see.

**Acceptance criteria:**

- AC-01-1: A guest who provides a valid email and password receives an access token (15 min TTL) and a refresh token (7 day TTL).
- AC-01-2: A guest who provides an unknown email or wrong password receives HTTP 401 with no token.
- AC-01-3: An authenticated user can exchange a valid refresh token for a new access token pair.
- AC-01-4: An expired or revoked refresh token is rejected with HTTP 401.
- AC-01-5: Registering with an email already in use returns HTTP 409.
- AC-01-6: Passwords are stored as bcrypt hashes; plaintext passwords never appear in logs or responses.
- AC-01-7: Every login, logout, and registration is recorded in `audit_logs`.
- AC-01-8: Admin can list all users and change any user's role.

**BDD scenarios:**

```gherkin
Feature: Authentication

  Scenario: Successful login
    Given a registered user with email "ana@example.com" and password "Str0ng!"
    When she sends POST /auth/login with those credentials
    Then the response is HTTP 200
    And the body contains "access_token" and "refresh_token"
    And an audit_log entry with action "user.login" is created

  Scenario: Wrong password
    Given a registered user with email "ana@example.com"
    When she sends POST /auth/login with password "wrong"
    Then the response is HTTP 401
    And no tokens are issued

  Scenario: Token refresh
    Given an authenticated user with a valid refresh token
    When she sends POST /auth/refresh with that token
    Then the response is HTTP 200
    And new "access_token" and "refresh_token" are returned
    And the old refresh token is no longer valid

  Scenario: Duplicate registration
    Given a user already registered with email "ana@example.com"
    When a second registration is attempted with the same email
    Then the response is HTTP 409
```

---

### F-02 Document Lifecycle

**User story:** As an authenticated user, I want to upload, view, download, and delete PDF documents so that my organization can manage its document archive digitally.

**Acceptance criteria:**

- AC-02-1: A bearer-authenticated user can upload a PDF; the system stores it in MinIO and returns the document record with `ocr_status = "pending"`.
- AC-02-2: Only the document's uploader or an admin can soft-delete it.
- AC-02-3: Soft-deleted documents have a non-null `deleted_at` and are excluded from list queries.
- AC-02-4: An admin can restore a soft-deleted document.
- AC-02-5: The download endpoint returns a presigned URL or a redirect to the file in MinIO; only users with visibility of the document may download it.
- AC-02-6: Each view and download is recorded in `audit_logs`.
- AC-02-7: Upload, delete, and restore are recorded in `audit_logs`.
- AC-02-8: A document title can be updated by its uploader or an editor/admin.
- AC-02-9: The list endpoint supports pagination (`page`, `limit`); default limit is 20, maximum is 100.

**BDD scenarios:**

```gherkin
Feature: Document Lifecycle

  Scenario: Upload document
    Given an authenticated editor "editor@example.com"
    When she sends POST /documents with a valid PDF multipart body
    Then the response is HTTP 201
    And the body contains a document with ocr_status "pending"
    And an audit_log entry with action "document.upload" is created

  Scenario: Download access control
    Given a document owned by user A assigned to group "Juridico"
    And user B who is NOT a member of "Juridico"
    When user B sends GET /documents/:id/download
    Then the response is HTTP 403

  Scenario: Soft delete and restore
    Given admin "admin@example.com" and document D
    When admin sends DELETE /documents/:id
    Then document D has a non-null deleted_at
    When admin sends POST /documents/:id/restore
    Then document D has deleted_at = null
```

---

### F-03 OCR Processing

**User story:** As a user, I want uploaded PDFs to be automatically processed for text extraction so that their content is searchable.

**Acceptance criteria:**

- AC-03-1: Upon upload, a BullMQ job is enqueued for OCR processing.
- AC-03-2: The OCR worker sets `ocr_status = "processing"` when it begins and `"done"` when complete.
- AC-03-3: If OCR fails, `ocr_status = "failed"` and the error is recorded in `audit_logs` with action `"ocr.failed"`.
- AC-03-4: Extracted text is stored and used by full-text search queries.
- AC-03-5: `is_searchable` is set to `true` when OCR succeeds and extracted text is non-empty.
- AC-03-6: OCR uses `pdftotext` for native PDF text; Tesseract is used when pdftotext yields no content.

**BDD scenarios:**

```gherkin
Feature: OCR Processing

  Scenario: Successful OCR
    Given a newly uploaded PDF with embedded text
    When the OCR worker processes the job
    Then the document has ocr_status "done" and is_searchable true
    And the extracted text is stored
    And an audit_log entry with action "ocr.completed" exists

  Scenario: OCR failure
    Given a corrupted PDF that cannot be processed
    When the OCR worker attempts processing
    Then the document has ocr_status "failed"
    And an audit_log entry with action "ocr.failed" exists
```

---

### F-04 Metadata & Schemas

**User story:** As an editor, I want to attach structured key-value metadata to documents and optionally validate them against a schema defined by the process type, so that documents carry consistent structured data.

**Acceptance criteria:**

- AC-04-1: Any authenticated user with access to a document can set its metadata via `PUT /documents/:id/metadata`; the operation replaces all existing key-value pairs.
- AC-04-2: Keys prefixed with `tag:` are reserved for the Tags feature (F-05) and must not be set via the metadata endpoint.
- AC-04-3: An admin can define a `MetadataSchema` per process type with typed fields (`text`, `date`, `number`, `select`).
- AC-04-4: `GET /documents/:id/schema-validation` returns a validation report listing missing required fields and type mismatches; it never blocks document access or transitions.
- AC-04-5: Schema validation is report-only — it never prevents state transitions or document operations.
- AC-04-6: Metadata update is recorded in `audit_logs` with action `"document.metadata.update"`.

**BDD scenarios:**

```gherkin
Feature: Metadata & Schemas

  Scenario: Set metadata
    Given an authenticated editor and document D
    When she sends PUT /documents/D/metadata with body { "numero_processo": "001/2026" }
    Then the response is HTTP 200
    And GET /documents/D/metadata returns { "numero_processo": "001/2026" }

  Scenario: Schema validation is non-blocking
    Given a process type "Licitação" with a required field "numero_processo"
    And document D assigned to "Licitação" with no metadata set
    When an editor executes a state transition on D
    Then the transition succeeds
    And GET /documents/D/schema-validation reports "numero_processo" as missing

  Scenario: tag: prefix is reserved
    Given document D
    When an editor sends PUT /documents/D/metadata with key "tag:vermelho"
    Then the response is HTTP 400 with an error about reserved prefix
```

---

### F-05 Tags

**User story:** As an editor, I want to tag documents with colored labels so that I can visually categorize and filter them at a glance.

**Acceptance criteria:**

- AC-05-1: Tags are stored as `document_metadata` rows with key `"tag:<name>"` and value as a CSS hex color string (e.g., `"#ef4444"`).
- AC-05-2: Tags appear in search facets alongside process-type and state facets.
- AC-05-3: A search filter `tag:<name>` returns only documents bearing that tag.
- AC-05-4: Tags can be added and removed via the standard metadata PUT endpoint.
- AC-05-5: The color value must be a valid 6-digit hex color code prefixed with `#`.

**BDD scenarios:**

```gherkin
Feature: Tags

  Scenario: Tag a document
    Given document D and editor E
    When E sends PUT /documents/D/metadata with key "tag:urgente" value "#ef4444"
    Then GET /documents/D/metadata returns { "tag:urgente": "#ef4444" }

  Scenario: Filter by tag
    Given documents D1 (tagged "urgente") and D2 (untagged)
    When a user sends GET /documents?q=tag:urgente
    Then only D1 appears in the results

  Scenario: Invalid tag color rejected
    Given document D
    When an editor sets key "tag:x" with value "red"
    Then the response is HTTP 400
```

---

### F-06 Search & Facets

**User story:** As a user, I want to search documents by text content and filter by process type, state, assignee, and tags so that I can quickly find relevant documents.

**Acceptance criteria:**

- AC-06-1: `GET /documents?q=<term>` performs full-text search over extracted OCR content and document title.
- AC-06-2: Filters `process_type_id`, `state_id`, `assigned_to`, `tag` can be combined with free-text search.
- AC-06-3: `GET /documents/facets` returns counts grouped by process type, current state, assigned_to, and each tag present in the caller's visible documents.
- AC-06-4: Search and facets respect document visibility rules (F-11 Group RBAC and F-13 Roles).
- AC-06-5: Results are paginated; the response includes `total`, `page`, `limit`, `pages`.
- AC-06-6: Deleted documents are never returned in search results.

**BDD scenarios:**

```gherkin
Feature: Search & Facets

  Scenario: Full-text search
    Given documents D1 (content "contrato social") and D2 (content "nota fiscal")
    When a user sends GET /documents?q=contrato
    Then D1 is in results and D2 is not

  Scenario: Facets respect visibility
    Given user U who can only see document D1 (not D2)
    When U sends GET /documents/facets
    Then facets only reflect D1's attributes

  Scenario: Combined filter
    Given documents D1 (type "Licitação", state "Em Análise") and D2 (type "Licitação", state "Concluído")
    When a user sends GET /documents?process_type_id=X&state_id=Y (En Análise)
    Then only D1 is returned
```

---

### F-07 Audit Log

**User story:** As an admin, I want a tamper-evident log of all significant actions so that I can meet compliance and traceability requirements.

**Acceptance criteria:**

- AC-07-1: Every action listed in the `AuditAction` type is recorded with `user_id`, `document_id` (if applicable), `ip`, and a `metadata` JSON payload.
- AC-07-2: Audit log entries are immutable — they cannot be updated or deleted via any API endpoint.
- AC-07-3: `GET /audit` is restricted to admins and supports filtering by `document_id`, `user_id`, `action`, and date range.
- AC-07-4: The audit list is paginated with the same `PaginatedResult<T>` shape as documents.
- AC-07-5: Audit entries are written in the same DB transaction as the operation they record where possible.

**BDD scenarios:**

```gherkin
Feature: Audit Log

  Scenario: Download is logged
    Given user U with access to document D
    When U sends GET /documents/D/download
    Then an audit_log entry with action "document.download" and user_id U exists

  Scenario: Audit is admin-only
    Given a viewer user V
    When V sends GET /audit
    Then the response is HTTP 403

  Scenario: Audit entries are immutable
    Given an audit_log entry E
    When any user attempts to DELETE or PATCH /audit/:id
    Then the response is HTTP 404 or HTTP 405
```

---

### F-08 Expiry Management

**User story:** As an admin, I want documents to automatically expire on a set date so that outdated records are flagged and optionally hidden.

**Acceptance criteria:**

- AC-08-1: Any authenticated user with write access to a document can set or clear `expires_at`.
- AC-08-2: A system cron running daily at 08:00 UTC marks documents past their `expires_at` as expired (sets a metadata flag or triggers an audit event).
- AC-08-3: Expired documents remain accessible (not deleted) but are visually flagged in the UI.
- AC-08-4: Expiry update is recorded in `audit_logs` with action `"document.expiry.update"`.
- AC-08-5: `expires_at` must be a future date when first set; updating to a past date is allowed only for admins.

**BDD scenarios:**

```gherkin
Feature: Expiry Management

  Scenario: Set expiry
    Given document D and an editor
    When the editor sends PATCH /documents/D/expiry with due date 2027-12-31
    Then document D has expires_at = "2027-12-31"
    And an audit_log entry with action "document.expiry.update" exists

  Scenario: Daily cron flags expired documents
    Given document D with expires_at = yesterday
    When the expiry cron runs
    Then document D is marked as expired in audit_logs
```

---

### F-09 Process Types & States

**User story:** As an admin, I want to define document workflow templates with states and transitions so that documents follow a controlled lifecycle.

**Acceptance criteria:**

- AC-09-1: An admin can create a process type with a name and description.
- AC-09-2: Each process type has one or more states; exactly one state must have `is_initial = true`.
- AC-09-3: States have a `color` (hex) and `position_order` for UI ordering.
- AC-09-4: Transitions define valid `from_state → to_state` moves; a `required_role` (`viewer`, `editor`, or `admin`) may be specified per transition. `null` means any role may execute it.
- AC-09-5: Assigning a process type to a document sets `current_state_id` to the initial state and records the event in `process_history`.
- AC-09-6: Executing a transition is rejected if: (a) it does not exist for the current state, or (b) the caller's role does not satisfy `required_role`.
- AC-09-7: Each successful transition is appended to `process_history` with `from_state_id`, `to_state_id`, `changed_by`, and optional `comment`.
- AC-09-8: Process type assignment is recorded in `audit_logs` with action `"document.process_type.assign"`.
- AC-09-9: State transitions are recorded in `audit_logs` with action `"document.state.transition"`.

**BDD scenarios:**

```gherkin
Feature: Process Types & States

  Scenario: Assign process type
    Given process type "Contrato" with initial state "Rascunho"
    And document D with no process type
    When an editor assigns "Contrato" to D
    Then D has current_state_id = "Rascunho"
    And a process_history entry is created
    And audit_log records "document.process_type.assign"

  Scenario: Execute valid transition
    Given document D in state "Rascunho"
    And transition "Rascunho → Revisão" with required_role = null
    When an editor executes the transition with comment "Pronto para revisão"
    Then D has current_state_id = "Revisão"
    And process_history records the transition with the comment

  Scenario: Unauthorized transition
    Given transition "Revisão → Aprovado" with required_role = "admin"
    And current user is a viewer
    When the viewer attempts to execute the transition
    Then the response is HTTP 403

  Scenario: Invalid transition
    Given document D in state "Aprovado"
    When a user attempts transition "Rascunho → Revisão" (not valid from Aprovado)
    Then the response is HTTP 422
```

---

### F-10 Deadline Management

**User story:** As an editor, I want to set deadlines on documents and receive automated alerts so that important dates are not missed.

**Acceptance criteria:**

- AC-10-1: Any authenticated user with access to a document can create, update, and delete deadlines.
- AC-10-2: A deadline has: `label`, `due_at` (timestamp), optional `target_state_id`, `alert_days_before` (array of integers), and `status` (default `"pending"`).
- AC-10-3: The system cron runs daily at 08:00 UTC and evaluates deadlines: if `due_at` has passed and the document has not reached `target_state_id`, the deadline status is set to `"missed"`; if the document is in `target_state_id`, it is set to `"met"`.
- AC-10-4: `alert_days_before` defines how many days in advance the system should log an alert audit entry (action `"document.deadline.alert"`).
- AC-10-5: Deadlines with `status = "met"` or `"missed"` are immutable (cannot be updated).

**BDD scenarios:**

```gherkin
Feature: Deadline Management

  Scenario: Create deadline
    Given document D and an editor
    When she creates a deadline with due_at 30 days from now and alert_days_before [7, 1]
    Then the deadline is stored with status "pending"

  Scenario: Deadline missed by cron
    Given document D with deadline due_at yesterday and target_state_id "Aprovado"
    And D is currently in state "Em Revisão" (not "Aprovado")
    When the deadline cron runs
    Then the deadline status becomes "missed"

  Scenario: Deadline met by cron
    Given document D with deadline due_at yesterday and target_state_id "Aprovado"
    And D is currently in state "Aprovado"
    When the deadline cron runs
    Then the deadline status becomes "met"

  Scenario: Cannot update met deadline
    Given deadline L with status "met"
    When an editor attempts PATCH on L
    Then the response is HTTP 422
```

---

### F-11 Group RBAC

**User story:** As an admin, I want to organize users into groups and control which groups can see which documents so that access is scoped to organizational units.

**Acceptance criteria:**

- AC-11-1: Only admins can create, update, and delete groups.
- AC-11-2: Only admins can add or remove members from a group.
- AC-11-3: Assigning a document to a group makes it visible to all current and future members of that group.
- AC-11-4: A document can be assigned to multiple groups.
- AC-11-5: Removing a document from all groups makes it visible only to its uploader and admins.
- AC-11-6: Group assignment changes are recorded in `audit_logs` with actions `"document.group.assign"` and `"document.group.remove"`.
- AC-11-7: Group membership and document-group assignments survive group-member removal (removing a user from a group removes their access to that group's documents).

**BDD scenarios:**

```gherkin
Feature: Group RBAC

  Scenario: Member accesses group document
    Given group "Jurídico" with member user U
    And document D assigned to group "Jurídico"
    When U sends GET /documents/:id
    Then the response is HTTP 200

  Scenario: Non-member denied
    Given document D assigned to group "Jurídico"
    And user U who is NOT a member of "Jurídico" and NOT the uploader
    When U sends GET /documents/:id
    Then the response is HTTP 403 or the document is absent from list

  Scenario: Remove user from group removes access
    Given user U is a member of "Jurídico" and can see document D
    When admin removes U from "Jurídico"
    Then U can no longer access D

  Scenario: Admin always has access
    Given document D assigned only to group "Jurídico"
    And admin A who is not a member of "Jurídico"
    When A sends GET /documents/:id
    Then the response is HTTP 200
```

---

### F-12 PDF Viewer & Annotations

**User story:** As a user with document access, I want to view PDFs inline with page navigation and add collaborative annotations so that review and markup happen within the system.

**Acceptance criteria:**

- AC-12-1: The frontend renders PDFs using `react-pdf`; multi-page navigation is supported.
- AC-12-2: Any user with access to a document can create annotations of type `highlight` or `comment`.
- AC-12-3: An annotation stores: `page`, `type`, `rect` (x, y, width, height in PDF coordinate space), optional `selected_text`, optional `content`, and `color` (hex).
- AC-12-4: Annotations are shared among all users with access to the document (collaborative model).
- AC-12-5: Only the annotation's author or an admin can delete or update an annotation.
- AC-12-6: The detail page shows 5 tabs: Info, Metadados, Processo, Prazos, Anotações.
- AC-12-7: Annotations overlay the PDF canvas in real time without a page reload.

**BDD scenarios:**

```gherkin
Feature: PDF Annotations

  Scenario: Create annotation
    Given user U with access to document D
    When U sends POST /documents/D/annotations with type "highlight", page 1, rect and color
    Then the annotation is stored and returned with HTTP 201
    And GET /documents/D/annotations includes the new annotation

  Scenario: Annotation visible to all authorized users
    Given annotation A on document D created by user U1
    And user U2 who also has access to D
    When U2 sends GET /documents/D/annotations
    Then annotation A is in the response

  Scenario: Only author can delete annotation
    Given annotation A created by user U1
    And user U2 (not admin, not U1) with access to D
    When U2 sends DELETE /documents/D/annotations/A
    Then the response is HTTP 403
```

---

### F-13 Roles (Fine-Grained RBAC)

**User story:** As an admin, I want to define named roles that bundle a permission level with a set of documents, and assign those roles to users or groups, so that access can be managed at a finer granularity than groups alone.

**Acceptance criteria:**

- AC-13-1: Only admins can create, update, and delete roles.
- AC-13-2: A role has a `name` (unique, max 200 chars), optional `description`, and `permission_level` of either `"viewer"` or `"editor"`.
- AC-13-3: Documents, users, and groups can be bound to a role independently.
- AC-13-4: A user bound to a role with `permission_level = "viewer"` on document D can read and download D even if D is not in any of their groups.
- AC-13-5: A user bound to a role with `permission_level = "editor"` on document D gains editor-level write access (metadata, annotations) on D in addition to read access.
- AC-13-6: A group bound to a role inherits that role for all current and future group members.
- AC-13-7: Deleting a role cascades and removes all document, user, and group bindings.
- AC-13-8: Role-based document visibility is additive with group-based visibility — a user can see a document if they have access via ANY route (group, role, or being the uploader).
- AC-13-9: `GET /roles/:id` returns the role object together with its `documents`, `userBindings`, and `groupBindings`.

**BDD scenarios:**

```gherkin
Feature: Roles (Fine-Grained RBAC)

  Scenario: Viewer role grants read access
    Given role "Auditores" with permission_level "viewer"
    And document D bound to role "Auditores"
    And user U (viewer system role) bound to role "Auditores"
    And D is NOT in any group U belongs to
    When U sends GET /documents/:id
    Then the response is HTTP 200

  Scenario: Editor role grants write access
    Given role "Revisores" with permission_level "editor" bound to document D and user U
    When U sends PUT /documents/D/metadata with new key-value pairs
    Then the response is HTTP 200

  Scenario: Group-bound role applies to all members
    Given role "Financeiro Read" with permission_level "viewer" bound to group "Contabilidade"
    And document D bound to role "Financeiro Read"
    And user U who is a member of "Contabilidade"
    When U sends GET /documents/D/download
    Then the response is HTTP 200 (or a redirect)

  Scenario: Deleting a role removes all bindings
    Given role R with user and group bindings and document bindings
    When admin sends DELETE /roles/R
    Then the response is HTTP 204
    And no user_role_bindings, group_role_bindings, or role_documents rows reference R

  Scenario: Duplicate role name rejected
    Given a role named "Auditores" already exists
    When admin sends POST /roles with name "Auditores"
    Then the response is HTTP 409
```

---

## 6. Non-Functional Requirements

| ID | Requirement | Acceptance threshold |
|----|-------------|----------------------|
| NFR-01 | **Availability** | System uptime ≥ 99.5% measured monthly in production |
| NFR-02 | **Response time** | p95 latency < 500 ms for document list and search endpoints under 100 concurrent users |
| NFR-03 | **Storage** | Files stored in MinIO (S3-compatible); no local disk dependency except for ephemeral OCR temp files |
| NFR-04 | **Security — Auth** | JWT access tokens expire in 15 min; refresh tokens in 7 days; tokens are rotated on each refresh |
| NFR-05 | **Security — OWASP** | No critical or high findings from OWASP ZAP scan (Phase 5 hardening gate) |
| NFR-06 | **Security — Passwords** | bcrypt with cost factor ≥ 12 |
| NFR-07 | **Data integrity** | All state-changing operations run inside DB transactions; partial failures leave no orphan records |
| NFR-08 | **Auditability** | Every authenticated action that mutates data or accesses a protected resource is recorded in `audit_logs` |
| NFR-09 | **Self-hosting** | Full stack deployable via `docker compose up` with no external cloud dependencies |
| NFR-10 | **Internationalisation** | UI language is Brazilian Portuguese (pt-BR); server responses are in English |
| NFR-11 | **Test coverage** | Phase 5 gate: e2e Playwright suite covering the 12 critical user journeys listed in §7 |

---

## 7. Acceptance Criteria Index

Each row below maps a critical user journey to its governing AC(s) and is a required Playwright e2e scenario for Phase 5.

| # | User Journey | Governing ACs |
|---|--------------|---------------|
| E2E-01 | Register → login → view dashboard | AC-01-1, AC-01-7 |
| E2E-02 | Upload PDF → OCR completes → text is searchable | AC-02-1, AC-03-1, AC-03-2, AC-06-1 |
| E2E-03 | Set metadata → schema validation report | AC-04-1, AC-04-4 |
| E2E-04 | Tag a document → filter by tag | AC-05-1, AC-05-3 |
| E2E-05 | Assign process type → execute transitions → view history | AC-09-5, AC-09-7 |
| E2E-06 | Create deadline → cron marks it missed | AC-10-2, AC-10-3 |
| E2E-07 | Create group → add member → assign document → member accesses document | AC-11-3, AC-11-1 |
| E2E-08 | Remove user from group → access denied | AC-11-7 |
| E2E-09 | Create role → bind document + user → user accesses document via role | AC-13-1, AC-13-4 |
| E2E-10 | Add PDF annotation → second user sees it | AC-12-2, AC-12-4 |
| E2E-11 | Admin views audit log filtered by action | AC-07-3 |
| E2E-12 | Soft-delete document → restore → document reappears | AC-02-2, AC-02-4 |

---

*Last updated: 2026-04-05*
*Rigor level: Spec-Anchored*
*Authoritative source: this file (`SPEC.md`)*
