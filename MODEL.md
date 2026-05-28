# Data Model

## Overview

Four tables: `Company`, `User`, `IngestionBatch`, `EmissionRecord`, and `AuditLog`. Every emission record can be traced back to the file that produced it, the person who uploaded it, and every action taken on it since.

---

## Tables

### Company
Represents an enterprise client. Every piece of data in the system belongs to a company.

```
company_name  — display name
slug          — URL-safe unique identifier
country       — defaults to India
created_at    — auto-set on creation
```

Multi-tenancy is enforced at the query level. Every view filters by `request.user.company` before returning anything. A user from Company A cannot see Company B's records — not through middleware, but because every queryset starts with `filter(company=request.user.company)`.

---

### User (extends Django AbstractUser)
Two roles: `staff` and `analyst`.

- **Staff** — the operations or finance person who uploads the CSV files (SAP exports, utility downloads, travel reports).
- **Analyst** — the ESG/sustainability analyst who reviews what came in, checks for anomalies, and approves or rejects each record before it's locked for audit.

Each user belongs to exactly one company (ForeignKey). This was deliberate — one-user-one-company makes tenant isolation simple and unambiguous. Every queryset is a single `filter(company=request.user.company)` with no risk of cross-client leakage.

---

### IngestionBatch
Every upload event creates one batch. It's the envelope for a file.

```
company           — which client's data
source_type       — SAP | UTILITY | TRAVEL
filename          — original filename, for display and traceability
uploaded_by       — FK to User
uploaded_at       — auto-set timestamp
status            — PROCESSING → COMPLETED or FAILED
total_rows        — rows in the file
failed_rows       — rows that couldn't be parsed
notes             — parser error details if any
```

This answers "where did this batch come from?" — which file, when, by whom. The `source_ref` on each `EmissionRecord` answers it at the individual row level.

---

### EmissionRecord
The central table. One row per unit of emission activity.

**Source tracing**
- `ingestion` FK ties back to the batch and therefore to the file and upload event
- `source_ref` stores the row's original identifier — SAP PO number (`4500012301-00010`), utility meter ID (`MTR-CH-001`), travel trip ID (`TR-2024-001`)
- `raw_data` (JSONField) stores the entire original CSV row as-received, before any parsing. If a parser bug causes a wrong value, the original data is always there.

**Scope 1 / 2 / 3**
Set by the parser, not by the analyst:
- SAP fuel/procurement → `scope = 1` (direct combustion, on-site)
- Utility electricity → `scope = 2` (purchased electricity)
- Corporate travel → `scope = 3` (business travel, value chain)

The `category` field captures detail within a scope: `diesel`, `petrol`, `natural_gas`, `lpg`, `coal` under Scope 1; `electricity` under Scope 2; `flight`, `hotel`, `cab`, `train` under Scope 3.

**Unit normalization**
Raw values are preserved in `quantity_raw` + `unit_raw`. Normalized values go in `quantity_normalized` + `unit_normalized`.

Canonical units per source:
- SAP fuels: Litres (L) for liquids, M3 for gas, KG for solid
- Utility: kWh (MWh rows converted to kWh; kVAh converted using 0.9 power factor)
- Travel: km for flights and ground transport, nights for hotels

Both fields are stored because auditors often want to verify the original figure from the source file.

**Review workflow**
```
status       — PENDING → APPROVED or REJECTED (or FLAGGED on ingest)
is_locked    — false until approved, then permanently true
reviewed_by  — FK to analyst who acted
reviewed_at  — timestamp of action
review_notes — required on rejection, optional on approval
is_flagged   — set by parser when a value looks suspicious
flag_reason  — explains why (e.g. "Unusually high: 60000 L exceeds threshold of 50000 L")
```

Approved records are locked. An analyst cannot un-approve — they'd have to reject a fresh upload. This is intentional: once something is signed off for audit it should not be quietly editable.

---

### AuditLog
Every state change on a record gets a log entry. Actions: `CREATED`, `EDITED`, `APPROVED`, `REJECTED`, `FLAGGED`.

```
record       — FK to EmissionRecord
action       — one of the five above
performed_by — FK to User
performed_at — auto-set timestamp
old_value    — JSONField, state before the action
new_value    — JSONField, state after the action
notes        — parser row reference or analyst comment
```

`old_value` / `new_value` as JSONFields give a complete diff history. For a record that was uploaded, flagged, rejected, re-uploaded, and approved, you can reconstruct the full sequence from the audit log alone.

---

## Design decisions in brief

| Decision | Reasoning |
|---|---|
| ForeignKey for User → Company | One company per user. Simpler, safer tenant isolation for this prototype. |
| raw_data JSONField | Preserves the original CSV row verbatim. Audit and debugging baseline. |
| Scope set by parser, not user | Scope 1/2/3 follows from source type. Prevents analyst miscategorisation. |
| is_locked on approval | Approved records can't be silently edited after sign-off. |
| quantity_raw + quantity_normalized both stored | Auditors can verify the original figure from the source file. |
| AuditLog with JSONField diffs | Full before/after history on every action, not just a timestamp. |
