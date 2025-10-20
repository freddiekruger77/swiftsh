import { useState } from 'react'
import { PackageStatus } from '@/lib/types'

interface AdminPackageFormProps {
  onSubmit: (data: any) => void
  loading?: boolean
  error?: string
  mode?: 'create' | 'update'
  initialData?: any
}

export default function AdminPackageForm({ 
  onSubmit, 
  loading = false, 
  error, 
  mode = 'create',
  initialData 
}: AdminPackageFormProps) {
  const [formData, setFormData] = useState({
    trackingNumber: initialData?.trackingNumber || '',
    status: initialData?.status || PackageStatus.CREATED,
    location: initialData?.currentLocation || '',
    destination: initialData?.destination || '',
    customerName: initialData?.customerName || '',
    customerEmail: initialData?.customerEmail || '',
    estimatedDelivery: initialData?.estimatedDelivery ? 
      new Date(initialData.estimatedDelivery).toISOString().split('T')[0] : '',
    notes: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      action: mode,
      ...formData
    })
  }

  const isFormValid = formData.trackingNumber.trim() && 
                     formData.status && 
                     formData.location.trim() && 
                     formData.destination.trim()

  const statusOptions = [
    { value: PackageStatus.CREATED, label: 'Created' },
    { value: PackageStatus.PICKED_UP, label: 'Picked Up' },
    { value: PackageStatus.IN_TRANSIT, label: 'In Transit' },
    { value: PackageStatus.OUT_FOR_DELIVERY, label: 'Out for Delivery' },
    { value: PackageStatus.DELIVERED, label: 'Delivered' },
    { value: PackageStatus.EXCEPTION, label: 'Exception' }
  ]

  return (
    <div className="admin-form-container">
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-header">
          <h2>{mode === 'create' ? 'Create New Package' : 'Update Package'}</h2>
          <p>
            {mode === 'create' 
              ? 'Add a new package to the tracking system' 
              : 'Update package information and status'
            }
          </p>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="trackingNumber">Tracking Number *</label>
            <input
              type="text"
              id="trackingNumber"
              name="trackingNumber"
              value={formData.trackingNumber}
              onChange={handleChange}
              placeholder="SW123456789"
              required
              disabled={loading || mode === 'update'}
              style={{ fontFamily: 'Courier New, monospace', letterSpacing: '1px' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">Status *</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              disabled={loading}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="location">Current Location *</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="New York, NY"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="destination">Destination *</label>
            <input
              type="text"
              id="destination"
              name="destination"
              value={formData.destination}
              onChange={handleChange}
              placeholder="Los Angeles, CA"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="customerName">Customer Name</label>
            <input
              type="text"
              id="customerName"
              name="customerName"
              value={formData.customerName}
              onChange={handleChange}
              placeholder="John Doe"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="customerEmail">Customer Email</label>
            <input
              type="email"
              id="customerEmail"
              name="customerEmail"
              value={formData.customerEmail}
              onChange={handleChange}
              placeholder="john@example.com"
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="estimatedDelivery">Estimated Delivery</label>
            <input
              type="date"
              id="estimatedDelivery"
              name="estimatedDelivery"
              value={formData.estimatedDelivery}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes about this update..."
              rows={3}
              disabled={loading}
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading || !isFormValid}
          className="submit-button"
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              {mode === 'create' ? 'Creating...' : 'Updating...'}
            </>
          ) : (
            <>
              <span className="icon">{mode === 'create' ? '📦' : '✏️'}</span>
              {mode === 'create' ? 'Create Package' : 'Update Package'}
            </>
          )}
        </button>
      </form>

      <style jsx>{`
        .admin-form-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }

        .admin-form {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
          border: 1px solid #e9ecef;
        }

        .form-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .form-header h2 {
          color: #0070f3;
          margin-bottom: 0.5rem;
          font-size: 1.75rem;
          font-weight: 600;
        }

        .form-header p {
          color: #6c757d;
          font-size: 1rem;
          line-height: 1.5;
        }

        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid #f5c6cb;
        }

        .error-icon {
          font-size: 1.1rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #495057;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 0.875rem 1rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #0070f3;
          box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
        }

        .form-group input:disabled,
        .form-group select:disabled,
        .form-group textarea:disabled {
          background-color: #f8f9fa;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }

        .submit-button {
          width: 100%;
          padding: 1rem 1.5rem;
          background-color: #0070f3;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .submit-button:hover:not(:disabled) {
          background-color: #0051a2;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 112, 243, 0.3);
        }

        .submit-button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .spinner {
          width: 1rem;
          height: 1rem;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .icon {
          font-size: 1rem;
        }

        @media (max-width: 768px) {
          .admin-form-container {
            padding: 1rem;
          }

          .admin-form {
            padding: 1.5rem;
          }

          .form-header h2 {
            font-size: 1.5rem;
          }

          .form-row {
            grid-template-columns: 1fr;
            gap: 0;
            margin-bottom: 1rem;
          }

          .form-group {
            margin-bottom: 1.5rem;
          }
        }
      `}</style>
    </div>
  )
}