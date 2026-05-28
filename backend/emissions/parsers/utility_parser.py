import io
import pandas as pd
from decimal import Decimal
from emissions.utils import safe_dict
from emissions.models import EmissionRecord, AuditLog


# UNIT CONVERSIONS → kWh
# kWh is the canonical unit for electricity
UNIT_CONVERSIONS = {
    'KWH':  Decimal('1.0'),
    'MWH':  Decimal('1000.0'),
    'GWH':  Decimal('1000000.0'),
    'KVAH': Decimal('0.9'),      # approximate power factor conversion
}

# Flag if a single monthly slice exceeds this
SUSPICIOUS_KWH = Decimal('50000')

# HELPERS Functions
def normalize_unit(consumption, unit_str):
    """
    Convert consumption to canonical unit (kWh).
    Returns (normalized_value, 'kWh', error_or_None)
    """
    unit = str(unit_str).strip().upper()

    if unit not in UNIT_CONVERSIONS:
        return consumption, unit_str, f"Unknown unit: '{unit_str}'"

    return consumption * UNIT_CONVERSIONS[unit], 'kWh', None


def split_billing_period(consumption, from_date, to_date):
    """
    Split a cross-month billing period proportionally.

    Why this exists:
        Utility bills run meter-to-meter, e.g. Jan 14 → Feb 13.
        For carbon accounting we need monthly figures.
        We split by days: each month gets (days_in_slice / total_days) × consumption.

    Example:
        Dec 1 → Jan 3  = 34 days,  12500 kWh
        December share = 31/34 × 12500 = 11,397 kWh
        January share  =  3/34 × 12500 =  1,103 kWh

    Returns:
        List of (month_start, month_end, month_consumption) tuples
        One tuple per calendar month covered
    """
    results    = []
    total_days = (to_date - from_date).days

    if total_days <= 0:
        return [(from_date, to_date, consumption)]

    current = from_date

    while current < to_date:
        # start of next calendar month
        if current.month == 12:
            next_month = current.replace(year=current.year + 1, month=1, day=1)
        else:
            next_month = current.replace(month=current.month + 1, day=1)

        month_end     = min(next_month, to_date)
        days_in_slice = (month_end - current).days
        month_kwh     = consumption * Decimal(days_in_slice) / Decimal(total_days)

        results.append((current, month_end, round(month_kwh, 4)))
        current = next_month

    return results


# MAIN PARSER
def parse_utility_csv(file_content, company, batch, uploaded_by):
    """
    Parses utility electricity CSV export (portal download style).

    Expected columns:
        Account_No     - utility account number
        Meter_ID       - meter identifier  (optional but recommended)
        Billing_From   - billing period start date
        Billing_To     - billing period end date
        Consumption    - amount consumed (numeric)
        Unit           - kWh / MWh / GWh / kVAh
        Location       - site name        (optional)

    One CSV row may produce multiple EmissionRecords
    when the billing period spans more than one calendar month.

    Returns:
        {'success': int, 'failed': int, 'errors': list}
    """

    # Decode bytes 
    try:
        content = file_content.decode('utf-8')
    except UnicodeDecodeError:
        content = file_content.decode('latin-1')

    # Read with pandas 
    df = pd.read_csv(io.StringIO(content),dtype=str,keep_default_na=False,)

    # Clean column names 
    df.columns = df.columns.str.strip()

    # Strip whitespace from all string columns 
    df = df.apply(lambda col: col.str.strip() if col.dtype == 'object' else col)

    # Parse both date columns vectorized 
    # infer_datetime_format=True handles DD/MM/YYYY, YYYY-MM-DD,
    # DD-MM-YYYY, DD.MM.YYYY automatically
    df['from_date'] = pd.to_datetime(
        df['Billing_From'],
        dayfirst=True,      # prefer DD/MM/YYYY over MM/DD/YYYY
        errors='coerce',
    )
    df['to_date'] = pd.to_datetime(
        df['Billing_To'],
        dayfirst=True,
        errors='coerce',
    )

    # ── Clean consumption column vectorized 
    # remove thousands commas: "12,500" → "12500"
    df['consumption_clean'] = df['Consumption'].str.replace(',', '', regex=False)

    # ── Required columns check 
    required = ['Account_No', 'Billing_From', 'Billing_To', 'Consumption']
    for col in required:
        if col not in df.columns:
            return {
                'success': 0,
                'failed':  len(df),
                'errors':  [{'row': 'all', 'error': f"Missing column: {col}", 'data': {}}],
            }

    # Drop completely empty rows
    df = df.dropna(how='all')

    success_count = 0
    failed_count  = 0
    errors        = []

    for idx, row in df.iterrows():
        row_num = idx + 2

        try:
            # Extract fields 
            account_no = str(row.get('Account_No', '')).strip()
            meter_id   = str(row.get('Meter_ID',   '')).strip()
            location   = str(row.get('Location',   '')).strip()
            unit_str   = str(row.get('Unit', 'kWh')).strip() or 'kWh'

            # Validate required 
            if not account_no:
                raise ValueError("Account_No is required")

            # Dates
            if pd.isna(row['from_date']):
                raise ValueError(f"Cannot parse Billing_From: '{row['Billing_From']}'")
            if pd.isna(row['to_date']):
                raise ValueError(f"Cannot parse Billing_To: '{row['Billing_To']}'")

            from_date = row['from_date'].date()
            to_date   = row['to_date'].date()

            if to_date <= from_date:
                raise ValueError(
                    f"Billing_To ({to_date}) must be after Billing_From ({from_date})"
                )

            # Consumption
            consumption_str = str(row['consumption_clean']).strip()
            if not consumption_str:
                raise ValueError("Consumption is required")

            try:
                consumption_raw = Decimal(consumption_str)
            except Exception:
                raise ValueError(f"Cannot parse consumption: '{row['Consumption']}'")

            if consumption_raw <= 0:
                raise ValueError(f"Consumption must be positive: {consumption_raw}")

            # Normalize unit
            consumption_normalized, unit_normalized, unit_error = normalize_unit(
                consumption_raw, unit_str
            )

            # Source ref 
            source_ref = meter_id or account_no

            # Split across months
            monthly_splits = split_billing_period(
                consumption_normalized, from_date, to_date
            )

            for month_start, month_end, month_kwh in monthly_splits:

                # Suspicious check on monthly slice
                # check AFTER split — a large bill split across
                # months may not be suspicious per month
                flag_reason = None
                if month_kwh > SUSPICIOUS_KWH:
                    flag_reason = (
                        f"High monthly consumption: {month_kwh} kWh "
                        f"(threshold: {SUSPICIOUS_KWH} kWh)"
                    )
                if unit_error:
                    flag_reason = f"{flag_reason} | {unit_error}" if flag_reason else unit_error

                # Save record 
                record = EmissionRecord.objects.create(
                    company             = company,
                    ingestion           = batch,
                    source_ref          = source_ref,
                    raw_data            = safe_dict(row),  
                    scope               = 2,          # electricity = always Scope 2
                    category            = 'electricity',
                    period_start        = month_start,
                    period_end          = month_end,
                    quantity_raw        = consumption_raw,
                    unit_raw            = unit_str,
                    quantity_normalized = month_kwh,
                    unit_normalized     = unit_normalized,
                    location            = location or account_no,
                    description         = (
                        f"Meter: {meter_id} | "
                        f"Account: {account_no} | "
                        f"Bill period: {from_date} to {to_date}"
                    ),
                    status              = 'FLAGGED' if flag_reason else 'PENDING',
                    is_flagged          = bool(flag_reason),
                    flag_reason         = flag_reason or '',
                )

                AuditLog.objects.create(
                    record       = record,
                    action       = 'CREATED',
                    performed_by = uploaded_by,
                    old_value    = None,
                    new_value    = {
                        'month_kwh':    str(month_kwh),
                        'unit':         unit_normalized,
                        'period_start': str(month_start),
                        'period_end':   str(month_end),
                        'source_ref':   source_ref,
                    },
                    notes = (
                        f"Split from billing period {from_date} to {to_date}, "
                        f"row {row_num}"
                    ),
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