export default function SummaryCards({ summary }) {
    const cards = [
        { label: 'Total Records', value: summary.total,    color: '#6b7280', bg: '#f9fafb' },
        { label: 'Pending',       value: summary.pending,  color: '#d97706', bg: '#fffbeb' },
        { label: 'Flagged',       value: summary.flagged,  color: '#dc2626', bg: '#fef2f2' },
        { label: 'Approved',      value: summary.approved, color: '#16a34a', bg: '#f0fdf4' },
        { label: 'Rejected',      value: summary.rejected, color: '#6b7280', bg: '#f3f4f6' },
    ]

    return (
        <div style={styles.grid}>
            {cards.map(card => (
                <div key={card.label} style={{ ...styles.card, background: card.bg }}>
                    <div style={{ ...styles.value, color: card.color }}>
                        {card.value ?? '—'}
                    </div>
                    <div style={styles.label}>{card.label}</div>
                </div>
            ))}
        </div>
    )
}

const styles = {
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 12,
        marginBottom: 24,
    },
    card: {
        borderRadius: 10,
        padding: '16px 20px',
        border: '1px solid #e5e7eb',
    },
    value: {
        fontSize: 28,
        fontWeight: 700,
        lineHeight: 1,
        marginBottom: 4,
    },
    label: {
        fontSize: 12,
        color: '#9ca3af',
        fontWeight: 500,
    },
}