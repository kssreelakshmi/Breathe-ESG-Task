import StatusBadge from './StatusBadge'

export default function RecordTable({ records, actionLoading, onApprove, onReject }) {

    if (records.length === 0) {
        return (
            <div style={styles.empty}>
                No records found. Try changing the filters or upload a file.
            </div>
        )
    }

    return (
        <div style={styles.wrapper}>
            <table style={styles.table}>
                <thead>
                    <tr style={styles.thead}>
                        <th style={styles.th}>Source</th>
                        <th style={styles.th}>Scope</th>
                        <th style={styles.th}>Category</th>
                        <th style={styles.th}>Raw Value</th>
                        <th style={styles.th}>Normalized</th>
                        <th style={styles.th}>Period</th>
                        <th style={styles.th}>Location</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Actions</th>
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
                            <td style={styles.td}>
                                {record.category}
                            </td>

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
                                    {record.period_end && (
                                        <> → {record.period_end}</>
                                    )}
                                </span>
                            </td>

                            {/* Location */}
                            <td style={styles.td}>
                                {record.location || '—'}
                            </td>

                            {/* Status + flag reason */}
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

                            {/* Actions */}
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
                                            {record.status === 'REJECTED' ? '✕ Done' : '✕ Reject'}
                                        </button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

const styles = {
    wrapper: {
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        overflow: 'auto',           // horizontal scroll on small screens
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
    scopeText: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: 500,
    },
    period: {
        fontSize: 12,
        color: '#6b7280',
        whiteSpace: 'nowrap',
    },
    statusCell: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    flagHint: {
        fontSize: 11,
        color: '#ea580c',
        maxWidth: 180,
        lineHeight: 1.4,
    },
    reviewNote: {
        fontSize: 11,
        color: '#6b7280',
        fontStyle: 'italic',
    },
    lockedText: {
        fontSize: 12,
        color: '#9ca3af',
    },
    actionBtns: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
    },
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
}