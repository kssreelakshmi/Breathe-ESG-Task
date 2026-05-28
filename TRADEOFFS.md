# Tradeoffs

Three things deliberately not built, and why.

---

## 1. CO₂e conversion is not stored in the database

The parsers estimate CO₂ for flights, hotels, and ground transport, but only write it to the `description` field. The `quantity_normalized` column stores the activity metric — km flown, kWh consumed, nights stayed, litres of diesel. None of these are converted to kg CO₂e before being saved.

**Why:** Emission factors are not stable. DEFRA updates its GHG Conversion Factors every year. Grid electricity factors change by country and year. If CO₂e is calculated and stored at upload time, any factor update means historical records are wrong — and you'd have to decide whether to recalculate locked, auditor-reviewed records or leave known-incorrect numbers in the audit trail. Neither is a good answer.

Storing activity data defers the multiplication to reporting time. The locked records stay clean. You re-run the CO₂e calculation with updated factors whenever needed without touching the source data.

**What production would need:** A versioned `EmissionFactor` table (source type, category, reporting year, factor value, source citation), and a reporting layer that multiplies activity × factor for any given period. This carries its own data governance questions — which factors are authoritative for which client, which year, which reporting standard.

---

## 2. Role enforcement is not implemented in the API views

The `User` model has a `role` field — `staff` for uploaders, `analyst` for reviewers. The intent is clear in the model. The enforcement in the views is not there. Any authenticated user can currently call the upload endpoints and the approve/reject endpoints.

**Why:** Getting the full upload → parse → review → approve/reject workflow working end-to-end was the right priority. Adding a permission check is a small, isolated change once the underlying logic is solid. The role design is intentional and documented; it just isn't wired up yet.

**What production would need:** A role check at the top of each relevant view — two or three lines — or a custom DRF `Permission` class (`IsAnalyst`, `IsStaff`) applied as a decorator. The latter is cleaner and testable.

---

## 3. No pagination on the records API

`/api/records/` returns all matching records in one response. For the prototype with sample data, this is fine. For a real client it would not be.

A single SAP export for one plant over a year can be tens of thousands of rows. Multiple plants, multiple years, and the response size becomes a real problem — slow to load, expensive to render, unusable on a slower connection.

Filtering is implemented (by status, source_type, scope, is_flagged) which keeps the dashboard usable for review sessions. But filtering is not a substitute for pagination.

**Why:** Pagination before the core workflow was stable would have been premature. It's also not complex — DRF has `PageNumberPagination` and `CursorPagination` built in, and the frontend change to handle `next`/`previous` links is small.

**What production would need:** Cursor-based pagination rather than page numbers, because page offsets drift as new records are added mid-session. A date range filter on the dashboard would also help analysts narrow to a manageable window before loading.
