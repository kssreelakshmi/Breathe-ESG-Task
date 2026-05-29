const STATUS_STYLES = {
    PENDING:  { background: '#fffbeb', color: '#d97706' },
    APPROVED: { background: '#f0fdf4', color: '#16a34a' },
    REJECTED: { background: '#f3f4f6', color: '#6b7280' },
    FLAGGED:  { background: '#fef2f2', color: '#dc2626' },
}

export default function StatusBadge({ status }) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.PENDING

    return (
        <span style={{
            ...s,
            // padding: '1px 10px',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            display:'contents',

        }}>
            {status}
        </span>
    )
}