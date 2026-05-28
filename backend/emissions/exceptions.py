class UnsupportedFileError(Exception):
    """
    Raised by parsers when the uploaded file cannot be processed —
    wrong columns, unreadable format, or empty content.
    Caught by _handle_upload and returned as HTTP 400.
    """
    pass