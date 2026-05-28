import csv
import io
from decimal import Decimal
from datetime import datetime
from emissions.exceptions import UnsupportedFileError


# WHY csv MODULE (NOT pandas)?

# Travel parser branches heavily per row:
#   FLIGHT → airport lookup → distance → CO2
#   HOTEL  → nights → CO2
#   GROUND → transport type → default distance → CO2

# This branching logic gains nothing from pandas.
# pandas helps when you process columns uniformly across rows.
# Here every row type needs different fields and calculations.
# The csv module is simpler and equally correct.

# AIRPORT DISTANCE TABLE (km, great-circle distances)

# Real deployment would use an API (AviationStack, OpenFlights DB)
# or a full IATA airport coordinate database.
# For prototype: common Indian + international business routes.
# Key format: "ORIGIN-DESTINATION" (always try both directions)

AIRPORT_DISTANCES = {
    # Indian domestic
    'BOM-DEL': 1148,
    'BOM-BLR': 845,
    'BOM-MAA': 1062,
    'BOM-HYD': 622,
    'BOM-CCU': 1659,
    'DEL-BLR': 1740,
    'DEL-MAA': 1756,
    'DEL-HYD': 1253,
    'DEL-CCU': 1305,
    'BLR-MAA': 285,
    'BLR-HYD': 500,
    # International
    'BOM-LHR': 7191,
    'BOM-JFK': 12541,
    'BOM-SIN': 4370,
    'BOM-DXB': 1934,
    'BOM-CDG': 7018,
    'DEL-LHR': 6730,
    'DEL-JFK': 11757,
    'DEL-SIN': 5636,
    'DEL-DXB': 2198,
    'DEL-FRA': 5752,
    'BLR-LHR': 8385,
    'BLR-SIN': 3390,
    'MAA-LHR': 8238,
    'MAA-SIN': 3559,
    'LHR-CDG': 340,
    'LHR-JFK': 5540,
    'LHR-SIN': 10841,
    'SIN-HKG': 2574,
    'SIN-NRT': 5316,
    'DXB-LHR': 5490,
}


# EMISSION FACTORS
# Flights: kg CO₂ per km per passenger
# Source: DEFRA UK 2023 GHG Conversion Factors
# Business/First multipliers reflect larger seat footprint

FLIGHT_FACTORS = {
    'ECONOMY':  Decimal('0.133'),
    'BUSINESS': Decimal('0.267'),   # ~2x economy
    'FIRST':    Decimal('0.400'),   # ~3x economy
    'PREMIUM':  Decimal('0.200'),   # between economy and business
}

# kg CO₂ per room per night
# Source: Cornell Hotel Sustainability Benchmarking Index 2022
HOTEL_FACTOR = Decimal('20.6')

# kg CO₂ per km
# Source: DEFRA 2023 / UK government GHG factors
GROUND_FACTORS = {
    'TRAIN': Decimal('0.041'),
    'CAB':   Decimal('0.171'),
    'TAXI':  Decimal('0.171'),
    'BUS':   Decimal('0.089'),
    'CAR':   Decimal('0.171'),
}

# Default distances (km) used when CSV doesn't provide exact distance
# These are rough averages for a typical corporate trip
# Documented in DECISIONS.md as a prototype assumption
DEFAULT_GROUND_KM = {
    'TRAIN': 500,
    'CAB':   20,
    'TAXI':  20,
    'BUS':   100,
    'CAR':   50,
}


# HELPERS Function
def parse_date(date_str):
    if not date_str:
        return None
    date_str = date_str.strip()
    for fmt in ['%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%m/%d/%Y', '%d.%m.%Y']:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None


def get_distance(origin, destination):
    """
    Look up flight distance between two IATA airport codes.
    Tries both directions since distance is symmetric.
    Returns distance in km or None if route not in table.
    """
    o = origin.strip().upper()
    d = destination.strip().upper()

    return (
        AIRPORT_DISTANCES.get(f"{o}-{d}") or
        AIRPORT_DISTANCES.get(f"{d}-{o}")
    )


# MAIN PARSER
def parse_travel_csv(file_content, company, batch, uploaded_by):
    """
    Parses corporate travel CSV (Concur / Navan export style).

    Expected columns:
        Trip_ID      - unique trip identifier
        Employee_ID  - employee identifier
        Travel_Date  - date of travel
        Type         - FLIGHT / HOTEL / TRAIN / CAB / TAXI / BUS / CAR
        From         - origin airport code (flights) or city
        To           - destination airport code (flights) or city
        Class        - ECONOMY / BUSINESS / FIRST / PREMIUM  (flights)
        Nights       - number of nights  (hotels)
        Purpose      - business purpose  (optional)

    Notes on quantity_normalized / unit_normalized:
        For FLIGHT and GROUND: stored as distance in km
        For HOTEL: stored as number of nights
        Estimated CO2 is saved in the description field.
        This keeps activity data separate from emission calculation.
        In a full system, CO2 would be computed from activity × emission factor
        with versioned factor tables.

    Returns:
        {'success': int, 'failed': int, 'errors': list}
    """
    from emissions.models import EmissionRecord, AuditLog

    # Decode bytes
    try:
        content = file_content.decode('utf-8')
    except UnicodeDecodeError:
        content = file_content.decode('latin-1')

    try:
        reader = csv.DictReader(io.StringIO(content))
        headers = reader.fieldnames
    except Exception:
        raise UnsupportedFileError(
            "Could not parse file as CSV. Please upload a valid corporate travel export (.csv)."
        )

    if not headers:
        raise UnsupportedFileError(
            "File appears to be empty or has no header row. "
            "Expected columns: Trip_ID, Employee_ID, Travel_Date, Type, From, To, Class, Nights. "
            "Download the sample CSV from the upload page for the correct format."
        )

    TRAVEL_REQUIRED = ['Trip_ID', 'Travel_Date', 'Type']
    missing = [col for col in TRAVEL_REQUIRED if col not in headers]
    if missing:
        raise UnsupportedFileError(
            f"Unsupported file format. Missing required travel columns: {', '.join(missing)}. "
            f"Expected: Trip_ID, Employee_ID, Travel_Date, Type, From, To, Class, Nights (optional: Purpose). "
            f"Download the sample CSV from the upload page for the correct format."
        )

    success_count = 0
    failed_count  = 0
    errors        = []

    for row_num, row in enumerate(reader, start=2):
        try:
            # Extract fields
            trip_id      = row.get('Trip_ID',     '').strip()
            employee_id  = row.get('Employee_ID', '').strip()
            date_str     = row.get('Travel_Date', '').strip()
            travel_type  = row.get('Type',        '').strip().upper()
            origin       = row.get('From',        '').strip().upper()
            destination  = row.get('To',          '').strip().upper()
            travel_class = row.get('Class',       'Economy').strip().upper() or 'ECONOMY'
            nights_str   = row.get('Nights',      '').strip()
            purpose      = row.get('Purpose',     '').strip()

            # Validate
            if not date_str:
                raise ValueError("Travel_Date is required")
            if not travel_type:
                raise ValueError("Type is required (FLIGHT/HOTEL/TRAIN/CAB/BUS/CAR)")

            travel_date = parse_date(date_str)
            if not travel_date:
                raise ValueError(f"Cannot parse date: '{date_str}'")

            source_ref  = trip_id or f"row-{row_num}"
            flag_reason = None

            # Branch by travel type
            # FLIGHT
            if travel_type == 'FLIGHT':
                if not origin or not destination:
                    raise ValueError("FLIGHT requires From and To airport codes")

                distance = get_distance(origin, destination)

                if distance is None:
                    # Don't crash the row — flag for analyst to review
                    # Analyst can manually set distance and re-approve
                    flag_reason         = (
                        f"Unknown route: {origin} → {destination}. "
                        f"Distance set to 0. Please review manually."
                    )
                    distance            = 0
                    co2_kg              = Decimal('0')
                else:
                    factor = FLIGHT_FACTORS.get(
                        travel_class,
                        FLIGHT_FACTORS['ECONOMY']  # default unknown class to economy
                    )
                    co2_kg = round(Decimal(str(distance)) * factor, 4)

                quantity_raw        = Decimal(str(distance))
                unit_raw            = 'km'
                quantity_normalized = quantity_raw   # km is already canonical
                unit_normalized     = 'km'
                location            = f"{origin} → {destination}"
                category            = 'flight'
                description         = (
                    f"Trip: {trip_id} | Employee: {employee_id} | "
                    f"Route: {origin} → {destination} | "
                    f"Class: {travel_class} | "
                    f"Distance: {distance} km | "
                    f"Est. CO2: {co2_kg} kg CO2 | "
                    f"Purpose: {purpose}"
                )

            # HOTEL
            elif travel_type == 'HOTEL':
                if not nights_str:
                    raise ValueError("HOTEL requires Nights field")

                try:
                    nights = int(nights_str)
                except ValueError:
                    raise ValueError(f"Cannot parse Nights: '{nights_str}'")

                if nights <= 0:
                    raise ValueError(f"Nights must be positive, got: {nights}")

                co2_kg              = round(HOTEL_FACTOR * Decimal(str(nights)), 4)
                quantity_raw        = Decimal(str(nights))
                unit_raw            = 'nights'
                quantity_normalized = quantity_raw
                unit_normalized     = 'nights'
                location            = destination or origin or 'Unknown'
                category            = 'hotel'
                description         = (
                    f"Trip: {trip_id} | Employee: {employee_id} | "
                    f"Location: {location} | "
                    f"Nights: {nights} | "
                    f"Est. CO2: {co2_kg} kg CO2 | "
                    f"Purpose: {purpose}"
                )

            # GROUND TRANSPORT 
            elif travel_type in GROUND_FACTORS:
                factor   = GROUND_FACTORS[travel_type]
                distance = DEFAULT_GROUND_KM[travel_type]
                co2_kg   = round(factor * Decimal(str(distance)), 4)

                quantity_raw        = Decimal(str(distance))
                unit_raw            = 'km'
                quantity_normalized = quantity_raw
                unit_normalized     = 'km'
                location = (
                    f"{origin} → {destination}"
                    if origin and destination
                    else origin or destination or 'Local'
                )
                category            = travel_type.lower()
                description         = (
                    f"Trip: {trip_id} | Employee: {employee_id} | "
                    f"Type: {travel_type} | "
                    f"Est. distance: {distance} km | "
                    f"Est. CO2: {co2_kg} kg CO2 | "
                    f"Purpose: {purpose}"
                )

            else:
                raise ValueError(
                    f"Unknown travel type: '{travel_type}'. "
                    f"Accepted: FLIGHT, HOTEL, TRAIN, CAB, TAXI, BUS, CAR"
                )

            # Save record
            record = EmissionRecord.objects.create(
                company             = company,
                ingestion           = batch,
                source_ref          = source_ref,
                raw_data            = dict(row),
                scope               = 3,            # travel = always Scope 3
                category            = category,
                period_start        = travel_date,
                period_end          = None,
                quantity_raw        = quantity_raw,
                unit_raw            = unit_raw,
                quantity_normalized = quantity_normalized,
                unit_normalized     = unit_normalized,
                location            = location,
                description         = description,
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
                    'travel_type':         travel_type,
                    'quantity_normalized': str(quantity_normalized),
                    'unit_normalized':     unit_normalized,
                    'source_ref':          source_ref,
                },
                notes = f"Parsed from travel CSV row {row_num}",
            )

            success_count += 1

        except Exception as e:
            failed_count += 1
            errors.append({
                'row':   row_num,
                'error': str(e),
                'data':  dict(row),
            })

    return {
        'success': success_count,
        'failed':  failed_count,
        'errors':  errors,
    }