# Decisions

Every ambiguity resolved while building this, what was chosen, and why.

---

## SAP — Flat file CSV over IDoc

SAP can export data in several ways: IDoc (SAP's proprietary batch exchange format), OData REST services, BAPI function modules, and flat file exports via transactions like SE16 or ME2M.

IDoc was the first thing looked at. The documentation is available but the format itself requires SAP middleware — ALE, an integration platform, or a custom adapter — to receive and decode. Getting hands-on with an actual IDoc file to understand its structure wasn't possible without access to an SAP system. The documentation describes it as an XML-like segment/field format, but the practical parsing difficulty and the infrastructure it requires made it a poor choice for a prototype.

Flat file CSV was the realistic alternative. It's what operations and procurement teams actually export when someone asks for fuel and procurement data — a SE16 or ME2M report download. No middleware needed, no RFC access required, just a CSV with SAP's internal column names.

The columns in the sample data — WERKS, BUDAT, MATNR, MENGE, MEINS, EBELN, EBELP, TXZ01, NETPR, NETWR, MATKL — were identified by going through SAP MM module documentation and understanding what a standard purchase order line item export looks like. These are the actual field names from the EKPO table. The choice of which fields to include was based on what's needed for emission calculation: plant (WERKS), date (BUDAT), material (MATNR), quantity (MENGE), and unit (MEINS) are the minimum. PO number and line (EBELN/EBELP) are included for source traceability. Price fields (NETPR, NETWR) and material class (MATKL) are in the sample because they appear in real exports, even if they're not used in emission calculation.

**What was ignored:** IDoc format entirely. OData service (requires SAP Gateway configuration). Multi-currency amount normalisation. Cost centre and profit centre attribution. Vendor master data.

*If I could ask the PM:* Do clients export this themselves via SE16/ME2M, or does their IT team pull it programmatically? If it's programmatic, OData or BAPI would be the better long-term integration. Also — what does the client's material master look like? The plant code and material code lookup tables in the parser are hardcoded for the prototype; a real onboarding needs those from the client's SAP configuration.

---

## SAP — Handling European number formats

SAP deployments configured in European locales use comma as the decimal separator and dot as thousands separator. `1.500,00` means 1,500.00, not 1.5. The sample data includes a row with a decimal quantity (`1100.50 LTR`) and a row using `GAL` (gallons) to exercise the unit conversion logic.

The parser handles both European and standard formats before any numeric parsing. This came from reading about SAP locale configuration — an Indian client's SAP instance might be configured in English, but it might also have been set up by a European implementation partner and never changed.

---

## SAP — Plant and material lookup tables

Plant codes like `1000`, `2000` are internal SAP identifiers that mean nothing without the plant master. A lookup table maps these to readable names (Chennai Factory, Mumbai Factory, etc.).

Same for material codes: `DIESEL-001`, `NATGAS-004` follow SAP's alphanumeric material number format. Each maps to a display label and an emission category used for GHG Protocol classification.

In production, these tables would come from the client's own SAP master data exports. For this prototype, they're hardcoded and documented as such.

---

## Utility — Portal CSV over PDF or API

Three options were considered: PDF bill, portal CSV export, and utility API.

PDF was set aside early. Parsing a utility bill PDF would require an OCR system, and utility bill layouts vary significantly between providers. A misread on the consumption figure is a compliance issue. It's not a safe approach for a prototype that needs to be demonstrably correct.

Utility APIs exist for some providers — BESCOM, Tata Power, MSEDCL, TNEB all have portal systems for commercial accounts — but API access typically requires a commercial arrangement and provider-specific OAuth. None of them have a public sandbox or consistent API structure. Portal CSV download is the one thing every utility portal offers regardless of provider.

The column structure in the sample data — Account_No, Meter_ID, Billing_From, Billing_To, Consumption, Unit, Location — reflects what a utility portal CSV export typically looks like. This was put together by looking at what information a utility bill actually contains and what a facilities team would need to export: the account identifier, the meter being read, the billing window, the consumption figure, and the unit. The data for the four providers mentioned (BESCOM, Tata Power, MSEDCL, TNEB) informed the general column shape, even though a direct download from each portal wasn't available.

**What was ignored:** PDF bills, API-based pulls, interval data (15-minute meter readings instead of billing period totals), kVAh-specific handling beyond the 0.9 approximation.

*If I could ask the PM:* Do any of the client's sites only have PDF bills? Are there sites where portal access isn't available? If yes, we need a separate ingestion path for those.

---

## Utility — Billing period split across calendar months

Utility meters are read on a schedule set at installation, not at month-end. The Chennai Factory meter in the sample (MTR-CH-001) runs from the 14th of one month to the 13th of the next. The Bangalore Office meter does the same. For GHG accounting, emissions need to be reportable by calendar month.

The parser splits every billing row into per-month slices proportional to days:

```
MTR-CH-001: 14 Dec 2023 → 13 Jan 2024 = 30 days, 84,500 kWh
December share: 17/30 × 84,500 = 47,883 kWh  (one EmissionRecord)
January share:  13/30 × 84,500 = 36,617 kWh  (one EmissionRecord)
```

This produces multiple `EmissionRecord` rows from a single CSV row. The original `raw_data` on each record holds the full original bill row so the split can always be verified.

The suspicious threshold check runs on the monthly slice, not the raw bill total — a large cross-month bill might not be suspicious per month.

Note that the Hyderabad Plant (MTR-HY-001) has overlapping billing periods in the sample (Jan 1–31 and Jan 20–Feb 19). This is a real data quality problem — a meter being read twice or an export error. The parser processes both rows and the analyst would see both in the dashboard.

---

## Travel — CSV export over live API

Concur and Navan both have APIs but they require OAuth 2.0 company-level authorisation — a client ID and secret from the platform, plus IT involvement to set up the integration. Neither has a publicly accessible sandbox.

CSV export from the travel platform's reporting interface is what's available to a travel manager without API access. The column structure in the sample — Trip_ID, Employee_ID, Travel_Date, Type, From, To, Class, Nights, Purpose — matches the kind of trip report export these platforms produce.

**What was ignored:** Live API integration, per-trip actual distances from the travel platform, cost centre attribution, multi-passenger trips.

*If I could ask the PM:* Is the client on Concur or Navan? Do they have a travel manager who can pull the trip export monthly, or should this be automated? The API route is better long-term but needs IT involvement.

---

## Travel — IATA codes for flights

Airport origins and destinations are stored as IATA 3-letter codes, not city names. City names are ambiguous — London has three commercial airports. IATA codes are unambiguous.

Distance is looked up from a table of common Indian domestic and international business routes. If a route isn't in the table, the record is created with distance = 0 and flagged for analyst review rather than failing the row. The sample includes a row with `BOM → XYZ` deliberately to exercise this path.

---

## Travel — Activity data stored, not CO₂e

For flights, `quantity_normalized` is distance in km. For hotels, it's nights. The estimated CO₂ is calculated and shown in the description field, but the normalized quantity column stores the activity metric.

Emission factors change — DEFRA updates annually. If CO₂e were stored at upload time and factors changed, historical records would be wrong with no clean way to recalculate. Storing the activity metric (km, nights) means the CO₂e can always be recalculated at reporting time with whatever factors are current. The locked records don't need to change.

---

## Review workflow — rejection requires notes, approval does not

When an analyst approves a record, the approval itself — their identity and timestamp in the AuditLog — is the justification. When they reject one, they must provide a reason. The API returns 400 if notes are missing on a rejection.

Auditors reviewing a submission may ask why a row was excluded. That needs a documented answer. Why a row was included is answered by the approved status and the analyst's identity.

---

## One company per user

`User.company` is a ForeignKey, not ManyToMany. One user, one company. This makes tenant isolation simple — every query is `filter(company=request.user.company)` with no risk of a misconfigured filter including another client's data.

A ManyToMany relationship would be needed for consultants working across multiple clients. That's out of scope for this prototype.
