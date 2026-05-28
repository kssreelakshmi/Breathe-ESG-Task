import pandas as pd
from decimal import Decimal

def safe_dict(row):
    """
    Convert a pandas row to a JSON-safe dict.
    Handles Timestamps, NaT, NaN, Decimal — anything
    that Django's JSONField can't serialize natively.
    """
    result = {}
    for key, value in row.items():
        if pd.isna(value) if not isinstance(value, str) else False:
            result[key] = None                          # NaN / NaT → None
        elif hasattr(value, 'isoformat'):
            result[key] = value.isoformat()             # Timestamp → "2024-01-05"
        elif isinstance(value, Decimal):
            result[key] = str(value)                    # Decimal → "800.0000"
        else:
            result[key] = str(value)                    # everything else → string
    return result
