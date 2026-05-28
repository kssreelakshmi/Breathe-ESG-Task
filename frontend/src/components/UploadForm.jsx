import { useState } from 'react'
import api from '../api/axios'

export default function UploadForm({ title, icon, sourceType, endpoint, fields }) {
    const [file, setFile]       = useState(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult]   = useState(null)
    const [error, setError]     = useState('')

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first')
            return
        }

        setLoading(true)
        setError('')
        setResult(null)

        const formData = new FormData()
        formData.append('file', file)

        // company_id from logged in user's company
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        formData.append('company_id', user.company_id || '')

        try {
            const res = await api.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            setResult(res.data)
            setFile(null)
            // reset file input
            document.getElementById(`file-input-${sourceType}`).value = ''
        } catch (err) {
            setError(err.response?.data?.error || 'Upload failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={styles.card}>
            {/* header */}
            <div style={styles.header}>
                <span style={styles.icon}>{icon}</span>
                <div>
                    <h3 style={styles.title}>{title}</h3>
                    <p style={styles.hint}>{fields}</p>
                </div>
            </div>

            {/* file picker */}
            <div style={styles.fileArea}>
                <input
                    id={`file-input-${sourceType}`}
                    type="file"
                    accept=".csv"
                    onChange={e => setFile(e.target.files[0])}
                    style={styles.fileInput}
                />
                <label
                    htmlFor={`file-input-${sourceType}`}
                    style={styles.fileLabel}
                >
                    {file ? `📄 ${file.name}` : '📂 Choose CSV file'}
                </label>
            </div>

            {/* error */}
            {error && (
                <div style={styles.errorBox}>{error}</div>
            )}

            {/* result */}
            {result && (
                <div style={styles.resultBox}>
                    <div style={styles.resultRow}>
                        <span style={styles.successCount}>
                            ✅ {result.success} rows imported
                        </span>
                        {result.failed > 0 && (
                            <span style={styles.failedCount}>
                                ❌ {result.failed} failed
                            </span>
                        )}
                    </div>
                    {result.errors?.length > 0 && (
                        <details style={styles.errorDetails}>
                            <summary style={{ cursor: 'pointer', fontSize: 12 }}>
                                View failed rows
                            </summary>
                            {result.errors.map((e, i) => (
                                <div key={i} style={styles.errorRow}>
                                    Row {e.row}: {e.error}
                                </div>
                            ))}
                        </details>
                    )}
                </div>
            )}

            {/* upload button */}
            <button
                style={loading || !file ? styles.btnDisabled : styles.btn}
                onClick={handleUpload}
                disabled={loading || !file}
            >
                {loading ? 'Processing...' : 'Upload & Process'}
            </button>
        </div>
    )
}

const styles = {
    card: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    header: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
    },
    icon: { fontSize: 32 },
    title: {
        margin: 0,
        fontSize: 16,
        fontWeight: 700,
        color: '#111827',
    },
    hint: {
        margin: '3px 0 0',
        fontSize: 12,
        color: '#9ca3af',
    },
    fileArea: {
        display: 'flex',
        flexDirection: 'column',
    },
    fileInput: { display: 'none' },
    fileLabel: {
        padding: '10px 14px',
        border: '1.5px dashed #d1d5db',
        borderRadius: 8,
        fontSize: 13,
        color: '#6b7280',
        cursor: 'pointer',
        textAlign: 'center',
        background: '#fafafa',
    },
    errorBox: {
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#dc2626',
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 13,
    },
    resultBox: {
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 13,
    },
    resultRow: {
        display: 'flex',
        gap: 16,
    },
    successCount: { color: '#16a34a', fontWeight: 600 },
    failedCount:  { color: '#dc2626', fontWeight: 600 },
    errorDetails: { marginTop: 8 },
    errorRow: {
        fontSize: 11,
        color: '#dc2626',
        padding: '2px 0',
    },
    btn: {
        padding: '10px',
        background: '#16a34a',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
    },
    btnDisabled: {
        padding: '10px',
        background: '#d1fae5',
        color: '#86efac',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'not-allowed',
    },
}