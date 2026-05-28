import { useState } from 'react'
import api from '../api/axios'

const SAMPLE_CSVS = {
    SAP: {
        filename: 'sample_sap.csv',
        content: [
            'WERKS,BUDAT,MATNR,MENGE,MEINS,EBELN,EBELP,TXZ01',
            '1000,20240115,DIESEL-001,500.00,LTR,4500001234,00010,Diesel for generator',
            '2000,20240118,PETROL-002,"1.200,00",LTR,4500001235,00010,Petrol fleet vehicles',
            '3000,20240120,NATGAS-004,800.00,M3,4500001236,00010,Natural gas boiler',
            '1000,20240122,LPG-005,250.00,KG,4500001237,00020,LPG kitchen',
        ].join('\n'),
    },
    UTILITY: {
        filename: 'sample_utility.csv',
        content: [
            'Account_No,Meter_ID,Billing_From,Billing_To,Consumption,Unit,Location',
            'ACC-001,MTR-BLR-01,01/12/2023,03/01/2024,12500,kWh,Bangalore Office',
            'ACC-002,MTR-MUM-01,15/12/2023,14/01/2024,8750,kWh,Mumbai Factory',
            'ACC-003,MTR-DEL-01,01/01/2024,31/01/2024,5200,kVAh,Delhi Warehouse',
        ].join('\n'),
    },
    TRAVEL: {
        filename: 'sample_travel.csv',
        content: [
            'Trip_ID,Employee_ID,Travel_Date,Type,From,To,Class,Nights,Purpose',
            'TRP-001,EMP-101,2024-01-10,FLIGHT,BOM,LHR,BUSINESS,,Client meeting London',
            'TRP-001,EMP-101,2024-01-13,HOTEL,,LHR,,2,Client meeting London',
            'TRP-002,EMP-202,2024-01-15,FLIGHT,DEL,SIN,ECONOMY,,Conference Singapore',
            'TRP-003,EMP-303,2024-01-20,FLIGHT,BOM,XYZ,ECONOMY,,Unknown route test',
            'TRP-004,EMP-404,2024-01-22,CAB,,,,,Airport transfer',
            'TRP-005,EMP-505,2024-01-25,TRAIN,DEL,BOM,,,Sales visit',
        ].join('\n'),
    },
}

function downloadSample(sourceType) {
    const sample = SAMPLE_CSVS[sourceType]
    if (!sample) return
    const blob = new Blob([sample.content], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = sample.filename
    a.click()
    URL.revokeObjectURL(url)
}

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
            console.log(res)
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
                    <button
                        style={styles.sampleBtn}
                        onClick={() => downloadSample(sourceType)}
                        type="button"
                    >
                        ↓ Download sample CSV
                    </button>
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
                            {result.success} rows imported
                        </span>
                        {result.failed > 0 && (
                            <span style={styles.failedCount}>
                                {result.failed} failed
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
    sampleBtn: {
        marginTop: 6,
        padding: '3px 0',
        background: 'none',
        border: 'none',
        color: '#16a34a',
        fontSize: 12,
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 2,
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