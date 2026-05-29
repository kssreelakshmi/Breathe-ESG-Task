import { useState } from 'react'
import StatusBadge from './StatusBadge'
import { useAuth } from '../context/useAuth'
import api from '../api/axios'

export default function RecordTable({ records, actionLoading, onApprove, onReject }) {
    const { user } = useAuth()
    const [detailRecord, setDetailRecord] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)

    const openDetail = async (id) => {
        setDetailLoading(true)
        setDetailRecord(null)
        try {
            const res = await api.get(`/records/${id}/`)
            setDetailRecord(res.data)
        } catch (err) {
            console.error('Failed to fetch record detail', err)
        } finally {
            setDetailLoading(false)
        }
    }

    const closeDetail = () => setDetailRecord(null)

    if (records.length === 0) {
        return (
            <div style={styles.empty}>
                No records found. Try changing the filters or upload a file.
            </div>
        )
    }

    return (
        <>
            <div style={styles.wrapper}>
                <table style={styles.table}>
                   <thead>
                        <tr style={styles.thead}>
                            {user?.role === 'analyst' && (
                                <th style={styles.th}>Company</th>
                            )}
                            <th style={styles.th}>Source</th>
                            <th style={styles.th}>Scope</th>
                            <th style={styles.th}>Category</th>
                            <th style={styles.th}>Raw Value</th>
                            <th style={styles.th}>Normalized</th>
                            <th style={styles.th}>Period</th>
                            <th style={styles.th}>Location</th>
                            <th style={styles.th}>Batch</th>
                            <th style={styles.th}>Status</th>
                            {user?.role === 'analyst' && (
                                <th style={styles.th}>Actions</th>
                            )}
                            <th style={styles.th}>...</th>  
                        </tr>
                    </thead>
                    <tbody>
                        {records.map(record => (
                            <tr
                                key={record.id}
                                style={{
                                    ...styles.tr,
                                    background: record.is_flagged ? '#fff7ed' : '#fff',
                                }}
                            >
                                {/* Company — analyst only */}
                                {user?.role === 'analyst' && (
                                    <td style={styles.td}>{record.company_name}</td>
                                )}

                                {/* Source */}
                                <td style={styles.td}>
                                    <span style={styles.sourceBadge}>
                                        {record.source_type}
                                    </span>
                                </td>

                                {/* Scope */}
                                <td style={styles.td}>
                                    <span style={styles.scopeText}>
                                        Scope {record.scope}
                                    </span>
                                </td>

                                {/* Category */}
                                <td style={styles.td}>{record.category}</td>

                                {/* Raw Value */}
                                <td style={styles.td}>
                                    {record.quantity_raw} {record.unit_raw}
                                </td>

                                {/* Normalized */}
                                <td style={styles.td}>
                                    {record.quantity_normalized} {record.unit_normalized}
                                </td>

                                {/* Period */}
                                <td style={styles.td}>
                                    <span style={styles.period}>
                                        {record.period_start}
                                        {record.period_end && <> → {record.period_end}</>}
                                    </span>
                                </td>

                                {/* Location */}
                                <td style={styles.td}>
                                    {record.location || '—'}
                                </td>

                                {/* Batch */}
                                <td style={styles.td}>
                                    <span style={styles.batchText}>
                                        #{record.ingestion}
                                    </span>
                                </td>

                                {/* Status + flags */}
                                <td style={styles.td}>
                                    <div style={styles.statusCell}>
                                        <StatusBadge status={record.status} />
                                        {record.is_flagged && (
                                            <span
                                                style={styles.flagHint}
                                                title={record.flag_reason}
                                            >
                                                ⚠ {record.flag_reason?.slice(0, 50)}
                                                {record.flag_reason?.length > 50 ? '...' : ''}
                                            </span>
                                        )}
                                        {record.review_notes && (
                                            <span style={styles.reviewNote}>
                                                💬 {record.review_notes?.slice(0, 40)}
                                                {record.review_notes?.length > 40 ? '...' : ''}
                                            </span>
                                        )}
                                    </div>
                                </td>

                                {/* Actions — analyst only */}
                                {user?.role === 'analyst' && (
                                    <td style={styles.td}>
                                        {record.is_locked ? (
                                            <span style={styles.lockedText}>🔒 Locked</span>
                                        ) : (
                                            <div style={styles.actionBtns}>
                                                <button
                                                    style={
                                                        record.status === 'APPROVED'
                                                            ? styles.approveBtnDone
                                                            : styles.approveBtn
                                                    }
                                                    disabled={
                                                        actionLoading === record.id ||
                                                        record.status === 'APPROVED'
                                                    }
                                                    onClick={() => onApprove(record.id)}
                                                >
                                                    {actionLoading === record.id
                                                        ? '...'
                                                        : record.status === 'APPROVED'
                                                        ? '✓ Done'
                                                        : '✓ Approve'
                                                    }
                                                </button>
                                                <button
                                                    style={
                                                        record.status === 'REJECTED'
                                                            ? styles.rejectBtnDone
                                                            : styles.rejectBtn
                                                    }
                                                    disabled={
                                                        actionLoading === record.id ||
                                                        record.status === 'REJECTED'
                                                    }
                                                    onClick={() => onReject(record.id)}
                                                >
                                                    {record.status === 'REJECTED'
                                                        ? '✕ Done'
                                                        : '✕ Reject'
                                                    }
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                )}

                                {/* View Details */}
                                <td style={{ ...styles.td, display:"flex", flexDirection:"column",alignItems:"center" }}>
                                    <button
                                        style={styles.detailBtn}
                                        onClick={() => openDetail(record.id)}
                                    >
                                        View details
                                    </button>
                                </td>

                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Detail Modal ───────────────────────────── */}
            {(detailLoading || detailRecord) && (
                <div style={styles.overlay} onClick={closeDetail}>
                    <div
                        style={styles.modal}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* modal header */}
                        <div style={styles.modalHeader}>
                            <h3 style={styles.modalTitle}>Record Detail</h3>
                            <button style={styles.closeBtn} onClick={closeDetail}>✕</button>
                        </div>

                        {detailLoading ? (
                            <div style={styles.modalLoading}>Loading...</div>
                        ) : (
                            <div style={styles.modalBody}>

                                {/* ── Info Grid ─────────────────── */}
                                <div style={styles.infoGrid}>
                                    <InfoRow label="Source"     value={detailRecord.source_type} />
                                    <InfoRow label="Source Ref" value={detailRecord.source_ref} />
                                    <InfoRow label="Scope"      value={`Scope ${detailRecord.scope}`} />
                                    <InfoRow label="Category"   value={detailRecord.category} />
                                    <InfoRow label="Period"     value={
                                        detailRecord.period_end
                                            ? `${detailRecord.period_start} → ${detailRecord.period_end}`
                                            : detailRecord.period_start
                                    } />
                                    <InfoRow label="Location"   value={detailRecord.location || '—'} />
                                    <InfoRow label="Raw"        value={`${detailRecord.quantity_raw} ${detailRecord.unit_raw}`} />
                                    <InfoRow label="Normalized" value={`${detailRecord.quantity_normalized} ${detailRecord.unit_normalized}`} />
                                    <InfoRow label="Status"     value={<StatusBadge status={detailRecord.status} />} />
                                    {detailRecord.reviewed_by_name && (
                                        <InfoRow label="Reviewed by" value={detailRecord.reviewed_by_name} />
                                    )}
                                    {detailRecord.review_notes && (
                                        <InfoRow label="Review notes" value={detailRecord.review_notes} />
                                    )}
                                    {detailRecord.is_flagged && (
                                        <InfoRow
                                            label="Flag reason"
                                            value={detailRecord.flag_reason}
                                            highlight
                                        />
                                    )}
                                </div>

                                {/* ── Description ───────────────── */}
                                {detailRecord.description && (
                                    <div style={styles.section}>
                                        <div style={styles.sectionTitle}>Description</div>
                                        <div style={styles.descriptionBox}>
                                            {detailRecord.description}
                                        </div>
                                    </div>
                                )}

                                {/* ── Raw Data ──────────────────── */}
                                {detailRecord.raw_data && (
                                    <div style={styles.section}>
                                        <div style={styles.sectionTitle}>
                                            Original CSV Row
                                        </div>
                                        <div style={styles.rawDataBox}>
                                            {Object.entries(detailRecord.raw_data).map(([k, v]) => (
                                                <div key={k} style={styles.rawDataRow}>
                                                    <span style={styles.rawKey}>{k}</span>
                                                    <span style={styles.rawValue}>{v ?? '—'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── Audit Log ─────────────────── */}
                                <div style={styles.section}>
                                    <div style={styles.sectionTitle}>
                                        Audit Log ({detailRecord.audit_logs?.length || 0} entries)
                                    </div>
                                    {detailRecord.audit_logs?.length === 0 ? (
                                        <div style={styles.emptyAudit}>No audit entries.</div>
                                    ) : (
                                        detailRecord.audit_logs?.map(log => (
                                            <div key={log.id} style={styles.auditEntry}>
                                                <div style={styles.auditTop}>
                                                    <span style={styles.auditAction}>
                                                        {log.action}
                                                    </span>
                                                    <span style={styles.auditMeta}>
                                                        by {log.performed_by_name} · {new Date(log.performed_at).toLocaleString()}
                                                    </span>
                                                </div>
                                                {log.notes && (
                                                    <div style={styles.auditNotes}>
                                                        {log.notes}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}

// small helper component for the info grid rows
function InfoRow({ label, value, highlight }) {
    return (
        <div style={infoRowStyles.row}>
            <span style={infoRowStyles.label}>{label}</span>
            <span style={{
                ...infoRowStyles.value,
                color: highlight ? '#dc2626' : '#111827',
            }}>
                {value}
            </span>
        </div>
    )
}

const infoRowStyles = {
    row: {
        display: 'flex',
        gap: 12,
        padding: '6px 0',
        borderBottom: '1px solid #f3f4f6',
    },
    label: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: 600,
        minWidth: 110,
    },
    value: {
        fontSize: 13,
        color: '#111827',
        flex: 1,
    },
}

const styles = {
    wrapper: {
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        overflow: 'auto',
    },
    table:  { width: '100%', borderCollapse: 'collapse', minWidth: 900 },
    thead:  { background: '#f9fafb' },
    th: {
        padding: '12px 14px',
        textAlign: 'left',
        fontSize: 11,
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid #e5e7eb',
        whiteSpace: 'nowrap',
    },
    tr:  { borderBottom: '1px solid #f3f4f6' },
    td: {
        padding: '12px 14px',
        fontSize: 13,
        color: '#374151',
        verticalAlign: 'top',

    },
    sourceBadge: {
        background: '#eff6ff',
        color: '#3b82f6',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
    },
    scopeText:  { fontSize: 12, color: '#6b7280', fontWeight: 500 },
    period:     { fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' },
    batchText:  { fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' },
    statusCell: { display: 'flex', flexDirection: 'column', gap: 4 },
    flagHint:   { fontSize: 11, color: '#ea580c', maxWidth: 180, lineHeight: 1.4 },
    reviewNote: { fontSize: 11, color: '#6b7280', fontStyle: 'italic' },
    detailBtn: {
        background: 'none',
        border: 'none',
        color: '#3b82f6',
        fontSize: 11,
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
        
    },
    lockedText: { fontSize: 12, color: '#9ca3af' },
    actionBtns: { display: 'flex', flexDirection: 'column', gap: 5 },
    approveBtn: {
        padding: '5px 10px',
        background: '#f0fdf4',
        color: '#16a34a',
        border: '1px solid #bbf7d0',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    approveBtnDone: {
        padding: '5px 10px',
        background: '#f3f4f6',
        color: '#9ca3af',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'not-allowed',
        whiteSpace: 'nowrap',
    },
    rejectBtn: {
        padding: '5px 10px',
        background: '#fef2f2',
        color: '#dc2626',
        border: '1px solid #fecaca',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    rejectBtnDone: {
        padding: '5px 10px',
        background: '#f3f4f6',
        color: '#9ca3af',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'not-allowed',
        whiteSpace: 'nowrap',
    },
    empty: {
        padding: 48,
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: 14,
    },
    // modal
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        zIndex: 200,
        padding: 16,
    },
    modal: {
        background: '#fff',
        borderRadius: 12,
        width: 520,
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
    },
    modalTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' },
    closeBtn: {
        background: 'none',
        border: 'none',
        fontSize: 16,
        cursor: 'pointer',
        color: '#6b7280',
        padding: 4,
    },
    modalLoading: {
        padding: 40,
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: 14,
    },
    modalBody: {
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
    },
    infoGrid: {
        display: 'flex',
        flexDirection: 'column',
    },
    section: { display: 'flex', flexDirection: 'column', gap: 8 },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 700,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    descriptionBox: {
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12,
        color: '#374151',
        lineHeight: 1.6,
    },
    rawDataBox: {
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxHeight: 200,
        overflowY: 'auto',
    },
    rawDataRow: {
        display: 'flex',
        gap: 12,
        fontSize: 12,
    },
    rawKey: {
        color: '#6b7280',
        fontFamily: 'monospace',
        minWidth: 100,
        fontWeight: 600,
    },
    rawValue: {
        color: '#111827',
        fontFamily: 'monospace',
    },
    auditEntry: {
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '10px 12px',
    },
    auditTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    auditAction: {
        fontSize: 12,
        fontWeight: 700,
        color: '#111827',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
    },
    auditMeta: {
        fontSize: 11,
        color: '#9ca3af',
    },
    auditNotes: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    emptyAudit: {
        fontSize: 13,
        color: '#9ca3af',
        padding: '8px 0',
    },
}