import Navbar from '../components/Navbar'
import UploadForm from '../components/UploadForm'

export default function Upload() {
    return (
        <div style={styles.page}>
            <Navbar />

            <div style={styles.container}>
                <div style={styles.pageHeader}>
                    <h2 style={styles.pageTitle}>Upload Data</h2>
                    <p style={styles.pageSubtitle}>
                        Upload emission source files. Each source is processed independently.
                    </p>
                </div>

                <div style={styles.grid}>
                    <UploadForm
                        title="SAP — Fuel & Procurement"
                        icon="⛽"
                        sourceType="SAP"
                        endpoint="/ingest/sap/"
                        fields="Expected columns: WERKS, BUDAT, MATNR, MENGE, MEINS, EBELN, EBELP"
                    />
                    <UploadForm
                        title="Utility — Electricity"
                        icon="⚡"
                        sourceType="UTILITY"
                        endpoint="/ingest/utility/"
                        fields="Expected columns: Account_No, Meter_ID, Billing_From, Billing_To, Consumption, Unit"
                    />
                    <UploadForm
                        title="Corporate Travel"
                        icon="✈️"
                        sourceType="TRAVEL"
                        endpoint="/ingest/travel/"
                        fields="Expected columns: Trip_ID, Employee_ID, Travel_Date, Type, From, To, Class, Nights"
                    />
                </div>
            </div>
        </div>
    )
}

const styles = {
    page: {
        minHeight: '100vh',
        background: '#f9fafb',
    },
    container: {
        maxWidth: 1100,
        margin: '0 auto',
        padding: '32px 24px',
    },
    pageHeader: {
        marginBottom: 28,
    },
    pageTitle: {
        margin: 0,
        fontSize: 22,
        fontWeight: 700,
        color: '#111827',
    },
    pageSubtitle: {
        margin: '6px 0 0',
        fontSize: 14,
        color: '#6b7280',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20,
    },
}