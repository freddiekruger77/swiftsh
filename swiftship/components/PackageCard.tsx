import { PackageData, StatusUpdate } from '@/lib/types'

interface PackageCardProps {
  package: PackageData & { statusHistory?: StatusUpdate[] }
  showHistory?: boolean
}

export default function PackageCard({ 
  package: pkg, 
  showHistory = false 
}: PackageCardProps) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'created':
        return '#6c757d'
      case 'picked_up':
        return '#fd7e14'
      case 'in_transit':
        return '#0070f3'
      case 'out_for_delivery':
        return '#20c997'
      case 'delivered':
        return '#28a745'
      case 'exception':
        return '#dc3545'
      default:
        return '#6c757d'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'created':
        return '📦'
      case 'picked_up':
        return '🚚'
      case 'in_transit':
        return '🚛'
      case 'out_for_delivery':
        return '🚐'
      case 'delivered':
        return '✅'
      case 'exception':
        return '⚠️'
      default:
        return '📦'
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  return (
    <div className="package-card">
      <div className="package-header">
        <div className="tracking-info">
          <h3>Tracking: {pkg.trackingNumber}</h3>
          {pkg.customerName && (
            <p className="customer-name">For: {pkg.customerName}</p>
          )}
        </div>
        <div className="status-badge" style={{ backgroundColor: getStatusColor(pkg.status) }}>
          <span className="status-icon">{getStatusIcon(pkg.status)}</span>
          <span className="status-text">{formatStatus(pkg.status)}</span>
        </div>
      </div>

      <div className="package-details">
        <div className="detail-row">
          <div className="detail-item">
            <strong>Current Location:</strong>
            <span>{pkg.currentLocation}</span>
          </div>
          <div className="detail-item">
            <strong>Destination:</strong>
            <span>{pkg.destination}</span>
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-item">
            <strong>Last Updated:</strong>
            <span>{formatDate(pkg.lastUpdated)}</span>
          </div>
          {pkg.estimatedDelivery && (
            <div className="detail-item">
              <strong>Estimated Delivery:</strong>
              <span>{formatDate(pkg.estimatedDelivery)}</span>
            </div>
          )}
        </div>
      </div>

      {showHistory && pkg.statusHistory && pkg.statusHistory.length > 0 && (
        <div className="status-history">
          <h4>Status History</h4>
          <div className="timeline">
            {pkg.statusHistory.map((update, index) => (
              <div key={update.id} className="timeline-item">
                <div className="timeline-marker" style={{ backgroundColor: getStatusColor(update.status) }}>
                  {getStatusIcon(update.status)}
                </div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <strong>{formatStatus(update.status)}</strong>
                    <span className="timeline-date">{formatDate(update.timestamp)}</span>
                  </div>
                  <p className="timeline-location">{update.location}</p>
                  {update.notes && (
                    <p className="timeline-notes">{update.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .package-card {
          border: 1px solid #e9ecef;
          border-radius: 12px;
          padding: 1.5rem;
          margin: 1rem 0;
          background-color: white;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
          transition: all 0.2s ease;
        }

        .package-card:hover {
          box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .package-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .tracking-info h3 {
          color: #0070f3;
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .customer-name {
          color: #6c757d;
          margin: 0;
          font-size: 0.9rem;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          color: white;
          font-weight: 500;
          font-size: 0.9rem;
        }

        .status-icon {
          font-size: 1.1rem;
        }

        .package-details {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .detail-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .detail-item strong {
          color: #495057;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .detail-item span {
          color: #212529;
          font-size: 1rem;
        }

        .status-history {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #e9ecef;
        }

        .status-history h4 {
          color: #495057;
          margin-bottom: 1rem;
          font-size: 1.1rem;
        }

        .timeline {
          position: relative;
        }

        .timeline::before {
          content: '';
          position: absolute;
          left: 1rem;
          top: 0;
          bottom: 0;
          width: 2px;
          background-color: #e9ecef;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.5rem;
          position: relative;
        }

        .timeline-marker {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          color: white;
          flex-shrink: 0;
          z-index: 1;
        }

        .timeline-content {
          flex: 1;
          padding-top: 0.25rem;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .timeline-header strong {
          color: #495057;
          font-size: 1rem;
        }

        .timeline-date {
          color: #6c757d;
          font-size: 0.85rem;
        }

        .timeline-location {
          color: #212529;
          margin: 0 0 0.5rem 0;
          font-weight: 500;
        }

        .timeline-notes {
          color: #6c757d;
          margin: 0;
          font-size: 0.9rem;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .package-card {
            padding: 1rem;
          }

          .package-header {
            flex-direction: column;
            align-items: stretch;
          }

          .status-badge {
            align-self: flex-start;
          }

          .detail-row {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }

          .timeline::before {
            left: 0.75rem;
          }

          .timeline-marker {
            width: 1.5rem;
            height: 1.5rem;
            font-size: 0.7rem;
          }

          .timeline-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  )
}