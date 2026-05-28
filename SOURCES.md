# Sources

For each of the three data sources: what was researched, what was learned, why the sample data looks the way it does, and what would break first in a real deployment.

---

## SAP — Fuel and Procurement

**What was researched**

SAP's MM (Materials Management) module documentation was the starting point. The goal was to understand what fields a standard fuel and procurement export actually contains — not to build a general SAP parser, but to identify the minimum set of fields needed to calculate emissions from fuel consumption.

IDoc was looked at first. SAP's documentation describes it as a proprietary batch data exchange format — XML-like in structure but requiring SAP ALE middleware or an integration platform to receive and decode. Getting access to an actual IDoc file wasn't possible without an SAP system. The format also requires knowing the message type and segment definitions specific to the sending system. For a prototype, this was too much infrastructure with too little ability to verify the output.

Flat file export was the practical alternative. SAP transactions SE16 (direct table browser) and ME2M (purchase orders by material) both produce CSV exports with SAP's internal field names. These field names are documented in SAP's own table references for EKKO (purchase order header) and EKPO (purchase order line items). The required fields for emission calculation were identified from this documentation: WERKS (plant), BUDAT (posting date), MATNR (material number), MENGE (quantity), MEINS (unit of measure). PO reference fields EBELN and EBELP were added for row-level traceability. NETPR, NETWR, and MATKL appear in real exports and are included in the sample even though they aren't used in emission calculation.

**Why the sample data looks the way it does**

The column names are the actual SAP field names from EKPO. Plant codes (1000 through 5000) follow SAP's typical four-digit format. Material codes (DIESEL-001, PETROL-002, NATGAS-004, LPG-005, COAL-006) follow SAP's alphanumeric material number convention, with a suffix to distinguish grades. Dates are in YYYYMMDD format, which is standard for SAP flat file exports.

The sample includes a mix of units — LTR, KG, M3, GAL, KGM — because SAP procurement data for fuel often has inconsistent units across plants depending on how the purchasing team configured the material master. The row with 60,000 LTR of diesel (plant 5000) deliberately exceeds the suspicious threshold to trigger the flagging logic.

**What would break first in a real deployment**

The plant and material lookup tables are hardcoded. A real client has their own plant codes and material numbers that mean nothing without their SAP master data. Before any real SAP file can be processed, the client's plant master (T001W) and material master (MARA/MAKT) exports would need to be ingested and mapped.

IDoc format is completely unsupported. If the client's IT team exports via IDoc rather than flat file, the parser won't work.

Multi-currency amounts are ignored. The NETWR column is in local currency; if the client has plants in multiple countries the financial data can't be compared without conversion, though for emission calculation this only matters if cost is being used as a proxy for consumption — which it isn't here.

---

## Utility — Electricity

**What was researched**

Four major Indian utility providers were looked at to understand what a commercial account export typically contains: BESCOM (Bangalore), Tata Power (Mumbai), MSEDCL (Maharashtra), and TNEB (Tamil Nadu). Direct access to portal downloads wasn't available, so the research was based on publicly available information about what these portals expose to enterprise customers and reference data found online.

The consistent finding across all four: portal CSV export is the universal option for commercial and industrial customers. API access exists in some cases but requires a commercial arrangement and is provider-specific. The column structure that a typical portal export contains — account number, meter ID, billing period dates, consumption figure, unit, location — was the basis for the sample data format.

PDF was not considered a viable option for this prototype. Utility bill PDFs vary significantly in layout between providers, and even between tariff categories within the same provider. Parsing them reliably requires an OCR pipeline with provider-specific post-processing, which is a separate system and not appropriate for a prototype.

The key insight from looking at real billing patterns: utility billing periods don't align with calendar months. Meters are read on a schedule set when the meter is installed. The Chennai Factory and Bangalore Office meters in the sample run 14th to 13th because that's realistic — it's not a contrived example.

**Why the sample data looks the way it does**

Five meters across five locations (Chennai, Mumbai, Delhi, Bangalore, Hyderabad) covering roughly the same client as the SAP data. Two meters use mid-month billing cycles (MTR-CH-001 and MTR-BL-001, both running 14th to 13th) to exercise the billing period split logic. Three use calendar-month billing.

The Bangalore Office rows use MWh instead of kWh to exercise the unit conversion. All other sites use kWh.

The Hyderabad Plant (MTR-HY-001) has a deliberate data quality issue: the January row runs 01-01-2024 to 31-01-2024, and the next row starts 20-01-2024 — an overlapping billing period. This isn't a parser error; it's a realistic data problem (a meter re-read or an export that includes an interim reading). Both rows would be ingested and both would appear in the dashboard for the analyst to review.

Consumption values are realistic for Indian industrial and commercial sites — the Hyderabad Plant at 148,000–162,000 kWh/month is a large manufacturing facility; the Delhi Warehouse at 11,000–13,000 kWh/month is a smaller operation.

**What would break first in a real deployment**

PDF bills for sites where portal access isn't available. This is probably the most common real-world scenario — not every site has a portal login, especially older metered locations managed by contractors.

The kVAh conversion uses a fixed 0.9 power factor. Industrial sites with heavy inductive loads (motors, compressors) can have power factors of 0.75 or lower. Using 0.9 on a site that's actually at 0.75 understates consumption by about 17%.

Different billing structures — time-of-use tariffs, demand charges, multi-rate structures — are completely ignored. The consumption field is treated as a single number. A real utility export might have separate peak and off-peak consumption columns.

---

## Corporate Travel — Flights, Hotels, Ground Transport

**What was researched**

The column structure for the travel CSV was modelled on what a corporate travel platform export typically looks like — trip ID, employee ID, date, travel type, origin, destination, class, nights, purpose. This covers the fields needed to categorise the travel and estimate emissions.

For emission factors, DEFRA's 2023 GHG Conversion Factors were used for flights (per km per passenger by class) and ground transport (per km by mode). For hotels, the Cornell Hotel Sustainability Benchmarking Index figure of 20.6 kg CO₂ per room per night was used as a global average.

Flight distances are looked up from a hardcoded table of common Indian domestic and international business routes using IATA airport codes.

In-depth research into Concur or Navan's specific export formats wasn't done — the API documentation for both requires a registered developer account to access in full, and the platform-specific column names aren't publicly documented in detail. The column structure in the sample is based on what a trip report for expense and emission calculation purposes would logically need to contain.

**Why the sample data looks the way it does**

25 rows covering a realistic mix of employee travel: domestic flights (BOM-DEL, DEL-BLR, BLR-MAA), international flights (BOM-LHR, BOM-SIN, BOM-JFK, DEL-DXB), hotel stays paired with the corresponding trip, cab transfers, and a train journey.

Business class is used for the longer international routes (London, Singapore, New York) which reflects realistic corporate travel policy. Economy is used for domestic routes.

Row TR-2024-019 uses `BOM → XYZ` — a destination that doesn't exist in the IATA distance table. This exercises the flagging path: the record is created with distance = 0 and status = FLAGGED so an analyst can review it. This is deliberate, not an error in the sample.

Hotels are paired with their corresponding trip where relevant (TR-2024-004 with the London conference, TR-2024-009 with Singapore, TR-2024-013 with Delhi overnight, TR-2024-017 with New York, TR-2024-021 with Dubai, TR-2024-025 with Singapore Tech Summit). The Nights field uses a leading space in some rows which the parser strips.

**What would break first in a real deployment**

The IATA distance table covers 35 routes. Any route outside that table produces a flagged record with distance = 0. A real corporate travel export would include hundreds of routes. In production, this would need either the full OpenFlights airport coordinate database with great-circle calculation, or an aviation distance API.

Ground transport distances are defaults (cab = 20 km, train = 500 km). These are category averages, not per-trip. For a client with a lot of ground transport in the data, the accuracy is low. You'd want actual journey distances either from the travel platform or from a geocoding API.

Hotel emission factors use a single global average. The CHSB data shows significant variation by region and hotel category. A five-star hotel in Singapore has a very different footprint from a budget property in Hyderabad.

Emission factors are hardcoded. DEFRA updates annually. If the system needs to support historical recalculation or comparison across reporting years, the factors need to go into a versioned table rather than being fixed in the parser code.
