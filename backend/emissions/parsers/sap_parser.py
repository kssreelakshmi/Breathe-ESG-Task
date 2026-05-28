import io
import pandas as pd
from decimal import Decimal


# LOOKUP TABLES
PLANT_LOOKUP = {
    '1000': 'Chennai Factory',
    '2000': 'Mumbai Factory',
    '3000': 'Delhi Warehouse',
    '4000': 'Bangalore Office',
    '5000': 'Hyderabad Plant',
}

# Each material maps to a display label and emission category
MATERIAL_LOOKUP = {
    'DIESEL-001': {'label': 'Diesel',           'category': 'diesel'},
    'PETROL-002': {'label': 'Petrol',            'category': 'petrol'},
    'HSD-003':    {'label': 'High Speed Diesel', 'category': 'diesel'},
    'NATGAS-004': {'label': 'Natural Gas',       'category': 'natural_gas'},
    'LPG-005':    {'label': 'LPG',               'category': 'lpg'},
    'COAL-006':   {'label': 'Coal',              'category': 'coal'},
}

# All unit conversions → canonical unit
# Liquid fuels → Liters
# Gas          → M3
# Solid        → KG
UNIT_CONVERSIONS = {
    'L':   {'factor': 1.0,     'canonical': 'L'},
    'LTR': {'factor': 1.0,     'canonical': 'L'},
    'GAL': {'factor': 3.78541, 'canonical': 'L'},
    'GL':  {'factor': 3.78541, 'canonical': 'L'},
    'KL':  {'factor': 1000.0,  'canonical': 'L'},
    'BBL': {'factor': 158.987, 'canonical': 'L'},
    'M3':  {'factor': 1.0,     'canonical': 'M3'},
    'KG':  {'factor': 1.0,     'canonical': 'KG'},
    'KGM': {'factor': 1.0,     'canonical': 'KG'},
}

# Thresholds on NORMALIZED (canonical) values
SUSPICIOUS_THRESHOLDS = {
    'L':  50000.0,
    'M3': 10000.0,
    'KG': 20000.0,
}

# HELPER FUNCTIONS
def fix_sap_decimal(value_str):
    """
    SAP exports use European number formats in some configs.
    "1.500,00" → 1500.00  (thousands dot + comma decimal)
    "500,00"   → 500.00   (comma decimal only)
    "500.00"   → 500.00   (standard, no change)
    """
    if not value_str or str(value_str).strip() == '':
        return None
    value_str = str(value_str).strip()
    # European: "1.500,00" — has both dot and comma
    if ',' in value_str and '.' in value_str:
        value_str = value_str.replace('.', '').replace(',', '.')
    # German decimal only: "500,00"
    elif ',' in value_str:
        value_str = value_str.replace(',', '.')

    try:
        return Decimal(value_str)
    except Exception:
        return None

def normalize_unit(quantity, unit_str):
    """
    Convert quantity to canonical unit.
    Returns (normalized_quantity, canonical_unit, error_or_None)
    """
    unit = str(unit_str).strip().upper()

    if unit not in UNIT_CONVERSIONS:
        return quantity, unit, f"Unknown unit '{unit}' — kept as-is"

    conv      = UNIT_CONVERSIONS[unit]
    factor    = Decimal(str(conv['factor']))
    canonical = conv['canonical']

    return quantity * factor, canonical, None

def check_suspicious(normalized_qty, canonical_unit):
    """
    Check normalized value against threshold.
    Always check AFTER normalization for consistency.
    """
    threshold = SUSPICIOUS_THRESHOLDS.get(canonical_unit)
    if threshold and normalized_qty > Decimal(str(threshold)):
        return (
            f"Unusually high: {normalized_qty} {canonical_unit} "
            f"exceeds threshold of {threshold} {canonical_unit}"
        )
    return None

# MAIN PARSER
def parse_sap_csv(file_content, company, batch, uploaded_by):
    """
    Parses SAP flat file CSV export (EKPO-style).

    Expected columns:
        WERKS  - Plant code
        BUDAT  - Posting date (YYYYMMDD or DD.MM.YYYY)
        MATNR  - Material number
        MENGE  - Quantity (may use European decimal)
        MEINS  - Unit of measure (LTR, GAL, KG, M3, BBL...)
        EBELN  - PO number        (optional, used for source_ref)
        EBELP  - PO line item     (optional, used for source_ref)
        TXZ01  - Description      (optional)

    Returns:
        {'success': int, 'failed': int, 'errors': list}
    """
    from emissions.models import EmissionRecord, AuditLog

    try:
        content = file_content.decode('utf-8')
    except UnicodeDecodeError:
        content = file_content.decode('latin-1')

    # ── Read with pandas ──────────────────────────────────────
    # dtype=str → read everything as string
    #   prevents pandas auto-converting "00010" (PO line) → 10
    # keep_default_na=False → empty strings stay as ''
    #   prevents pandas converting blank cells to NaN silently
    df = pd.read_csv(io.StringIO(content),dtype=str,keep_default_na=False,)

    # ── Clean column names ────────────────────────────────────
    # strip whitespace from column names (SAP sometimes adds spaces)
    df.columns = df.columns.str.strip()

    # ── Rename SAP German columns to readable names ───────────
    df = df.rename(columns={
        'WERKS': 'plant_code',
        'BUDAT': 'date_str',
        'MATNR': 'material',
        'MENGE': 'quantity_str',
        'MEINS': 'unit_str',
        'EBELN': 'po_number',
        'EBELP': 'po_line',
        'TXZ01': 'description',
    })

    # ── Strip whitespace from all string columns at once ──────
    df = df.apply(
        lambda col: col.str.strip() if col.dtype == 'object' else col
    )

    # ── Fix SAP European decimal in quantity column ───────────
    # vectorized replace across entire column
    df['quantity_str'] = (
        df['quantity_str'].str.replace(r'\.(?=\d{3},)', '', regex=True).str.replace(',', '.', regex=False))
        # "1.500,00" → "1500.00" ,"500,00"   → "500.00"
        

    # ── Parse dates vectorized ────────────────────────────────
    # try YYYYMMDD first (most common SAP format)
    df['parsed_date'] = pd.to_datetime(df['date_str'],format='%Y%m%d',errors='coerce', )   # unparseable → NaT, not crash
    # where that failed, try DD.MM.YYYY (German format)
    mask = df['parsed_date'].isna()
    df.loc[mask, 'parsed_date'] = pd.to_datetime(
        df.loc[mask, 'date_str'],
        format='%d.%m.%Y',
        errors='coerce',
    )

    # ── Drop completely empty rows ────────────────────────────
    df = df.dropna(how='all')

    # ── Required columns check ────────────────────────────────
    required = ['plant_code', 'date_str', 'material', 'quantity_str', 'unit_str']
    for col in required:
        if col not in df.columns:
            return {
                'success': 0,
                'failed':  len(df),
                'errors':  [{'row': 'all', 'error': f"Missing required column: {col}", 'data': {}}],
            }

    # ── Loop and create records ───────────────────────────────
    success_count = 0
    failed_count  = 0
    errors        = []

    for idx, row in df.iterrows():
        row_num = idx + 2  # +2 because header is row 1, df index starts at 0

        try:
            # Validate required fields
            missing = [
                col for col in ['plant_code', 'material', 'quantity_str', 'unit_str']
                if not row.get(col, '')
            ]
            if missing:
                raise ValueError(f"Missing required fields: {', '.join(missing)}")

            # Date 
            if pd.isna(row['parsed_date']):
                raise ValueError(f"Cannot parse date: '{row['date_str']}'")
            posting_date = row['parsed_date'].date()

            # Quantity 
            quantity_raw = fix_sap_decimal(row['quantity_str'])
            if quantity_raw is None:
                raise ValueError(f"Cannot parse quantity: '{row['quantity_str']}'")
            if quantity_raw <= 0:
                raise ValueError(f"Quantity must be positive, got: {quantity_raw}")

            # Unit 
            unit_str = str(row['unit_str']).strip().upper()

            # Lookups
            plant_code    = str(row['plant_code'])
            material      = str(row['material'])
            location      = PLANT_LOOKUP.get(plant_code, f"Plant {plant_code}")
            material_info = MATERIAL_LOOKUP.get(material)
            category      = material_info['category'] if material_info else 'unknown_fuel'
            label         = material_info['label']    if material_info else material

            # Normalize units
            quantity_normalized, unit_normalized, unit_error = normalize_unit(
                quantity_raw, unit_str
            )

            #Source ref
            po_number = str(row.get('po_number', '')).strip()
            po_line   = str(row.get('po_line', '')).strip()

            if po_number and po_line:
                source_ref = f"{po_number}-{po_line}"
            elif po_number:
                source_ref = po_number
            else:
                source_ref = f"{material}-{plant_code}-row{row_num}"

            # Suspicious check (on normalized value) 
            flag_reason = check_suspicious(quantity_normalized, unit_normalized)
            if unit_error:
                flag_reason = f"{flag_reason} | {unit_error}" if flag_reason else unit_error

            #Description 
            raw_desc = str(row.get('description', '')).strip()
            description = raw_desc or f"{label} | Plant: {plant_code}"

            # Save EmissionRecord 
            record = EmissionRecord.objects.create(
                company             = company,
                ingestion           = batch,
                source_ref          = source_ref,
                raw_data            = row.to_dict(),
                scope               = 1,            # SAP fuel = always Scope 1
                category            = category,
                period_start        = posting_date,
                period_end          = None,
                quantity_raw        = quantity_raw,
                unit_raw            = unit_str,
                quantity_normalized = quantity_normalized,
                unit_normalized     = unit_normalized,
                location            = location,
                description         = description,
                status              = 'FLAGGED' if flag_reason else 'PENDING',
                is_flagged          = bool(flag_reason),
                flag_reason         = flag_reason or '',
            )

            #  Audit log 
            AuditLog.objects.create(
                record       = record,
                action       = 'CREATED',
                performed_by = uploaded_by,
                old_value    = None,
                new_value    = {
                    'quantity_raw':        str(quantity_raw),
                    'unit_raw':            unit_str,
                    'quantity_normalized': str(quantity_normalized),
                    'unit_normalized':     unit_normalized,
                    'source_ref':          source_ref,
                },
                notes = f"Parsed from SAP CSV row {row_num}",
            )

            success_count += 1

        except Exception as e:
            failed_count += 1
            errors.append({
                'row':   row_num,
                'error': str(e),
                'data':  row.to_dict(),
            })

    return {
        'success': success_count,
        'failed':  failed_count,
        'errors':  errors,
    }