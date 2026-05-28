import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import SummaryCards from '../components/SummaryCards'
import RecordTable from '../components/RecordTable'

export default function Dashboard() {
    const [records, setRecords] = useState([])
    const [summary, setSummary] = useState({})
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(null)

    // filters
    const [statusFilter, setStatusFilter] = useState('')
    const [sourceFilter, setSourceFilter] = useState('')
    const [scopeFilter, setScopeFilter]   = useState('')

    // reject modal
    const [rejectModal, setRejectModal] = useState(null)
    const [rejectNote, setRejectNote]   = useState('')

    // ── Fetch records + summary ──────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const params = {}
            if (statusFilter) params.status = statusFilter
            if (sourceFilter) params.source_type = sourceFilter
            if (scopeFilter)  params.scope = scopeFilter

            const [recRes, sumRes] = await Promise.all([
                api.get('/records/', { params }),
                api.get('/summary/'),
            ])
            setRecords(recRes.data)
            setSummary(sumRes.data)
        } catch (err) {
            console.error('Failed to fetch data', err)
        } finally {
            setLoading(false)
        }
    }, [statusFilter, sourceFilter, scopeFilter])

    useEffect(() => { fetchData() }, [fetchData])

    // ── Approve ──────────────────────────────────────────────
    const handleApprove = async (id) => {
        setActionLoading(id)
        try {
            await api.patch(`/records/${id}/approve/`, {})
            fetchData()
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to approve')
        } finally {
            setActionLoading(null)
        }
    }

    // ── Open reject modal ────────────────────────────────────
    const handleOpenReject = (id) => {
        setRejectModal(id)
        setRejectNote('')
    }

    // ── Confirm reject ───────────────────────────────────────
    const handleReject = async () => {
        if (!rejectNote.trim()) {
            alert('Please provide a reason for rejection')
            return
        }
        setActionLoading(rejectModal)
        try {
            await api.patch(`/records/${rejectModal}/reject/`, { notes: rejectNote })
            setRejectModal(null)
            setRejectNote('')
            fetchData()
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to reject')
        } finally {
            setActionLoading(null)
        }
    }

    return (
        <div style={styles.page}>
            <Navbar />

            <div style={styles.container}>

                {/* header */}
                <div style={styles.pageHeader}>
                    <h2 style={styles.pageTitle}>Review Dashboard</h2>
                    <p style={styles.pageSubtitle}>
                        Review, approve, or reject emission records before they are locked for audit.
                    </p>
                </div>

                {/* summary cards */}
                <SummaryCards summary={summary} />

                {/* filters */}
                <div style={styles.filters}>
                    <select
                        style={styles.select}
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="FLAGGED">Flagged</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                    </select>

                    <select
                        style={styles.select}
                        value={sourceFilter}
                        onChange={e => setSourceFilter(e.target.value)}
                    >
                        <option value="">All Sources</option>
                        <option value="SAP">SAP</option>
                        <option value="UTILITY">Utility</option>
                        <option value="TRAVEL">Travel</option>
                    </select>

                    <select
                        style={styles.select}
                        value={scopeFilter}
                        onChange={e => setScopeFilter(e.target.value)}
                    >
                        <option value="">All Scopes</option>
                        <option value="1">Scope 1</option>
                        <option value="2">Scope 2</option>
                        <option value="3">Scope 3</option>
                    </select>

                    <button style={styles.refreshBtn} onClick={fetchData}>
                        ↻ Refresh
                    </button>
                </div>

                
                {loading ? (
                    <div style={styles.loadingBox}>Loading records...</div>
                ) : (
                    <RecordTable
                        records={records}
                        actionLoading={actionLoading}
                        onApprove={handleApprove}
                        onReject={handleOpenReject}
                    />
                )}

            </div>

            {rejectModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h3 style={styles.modalTitle}>Reject Record</h3>
                        <p style={styles.modalSubtitle}>
                            Provide a reason. This is required and saved in the audit log.
                        </p>
                        <textarea
                            style={styles.textarea}
                            rows={4}
                            placeholder="e.g. Duplicate entry, incorrect unit, value seems wrong..."
                            value={rejectNote}
                            onChange={e => setRejectNote(e.target.value)}
                            autoFocus
                        />
                        <div style={styles.modalActions}>
                            <button
                                style={styles.cancelBtn}
                                onClick={() => setRejectModal(null)}
                            >
                                Cancel
                            </button>
                            <button
                                style={styles.confirmRejectBtn}
                                onClick={handleReject}
                                disabled={actionLoading === rejectModal}
                            >
                                {actionLoading === rejectModal
                                    ? 'Rejecting...'
                                    : 'Confirm Reject'
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const styles = {
    page:         { minHeight: '100vh', background: '#f9fafb' },
    container:    { maxWidth: 1300, margin: '0 auto', padding: '32px 24px' },
    pageHeader:   { marginBottom: 24 },
    pageTitle:    { margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' },
    pageSubtitle: { margin: '6px 0 0', fontSize: 14, color: '#6b7280' },
    filters: {
        display: 'flex',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    select: {
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        fontSize: 13,
        background: '#fff',
        color: '#374151',
    },
    refreshBtn: {
        padding: '8px 16px',
        background: '#fff',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        fontSize: 13,
        cursor: 'pointer',
        color: '#374151',
    },
    loadingBox: {
        padding: 48,
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: 14,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
    },
    // modal
    modalOverlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
    },
    modal: {
        background: '#fff',
        borderRadius: 12,
        padding: 28,
        width: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    },
    modalTitle:    { margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' },
    modalSubtitle: { margin: '6px 0 16px', fontSize: 13, color: '#6b7280' },
    textarea: {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        fontSize: 13,
        resize: 'vertical',
        boxSizing: 'border-box',
    },
    modalActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 16,
    },
    cancelBtn: {
        padding: '8px 16px',
        background: '#fff',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        fontSize: 13,
        cursor: 'pointer',
    },
    confirmRejectBtn: {
        padding: '8px 16px',
        background: '#dc2626',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
    },
}