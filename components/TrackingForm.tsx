import { useState } from 'react'

interface TrackingFormProps {
  onSubmit: (trackingNumber: string) => void
  loading?: boolean
  error?: string
}

export default function TrackingForm({ onSubmit, loading = false, error }: TrackingFormProps) {
  const [trackingNumber, setTrackingNumber] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (trackingNumber.trim()) {
      onSubmit(trackingNumber.trim())
    }
  }

  return (
    <div className="tracking-form-container">
      <form onSubmit={handleSubmit} className="tracking-form">
        <div className="form-header">
          <h2>Track Your Package</h2>
          <p>Enter your tracking number to get real-time updates on your shipment</p>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="input-group">
          <label htmlFor="trackingNumber">Tracking Number</label>
          <div className="input-wrapper">
            <input
              type="text"
              id="trackingNumber"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
              placeholder="Enter tracking number (e.g., SW123456789)"
              required
              disabled={loading}
              className="tracking-input"
            />
            <button 
              type="submit" 
              disabled={loading || !trackingNumber.trim()}
              className="track-button"
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Tracking...
                </>
              ) : (
                <>
                  <span className="search-icon">🔍</span>
                  Track Package
                </>
              )}
            </button>
          </div>
        </div>

        <div className="form-help">
          <p>
            <strong>Need help?</strong> Tracking numbers are typically 8-20 characters long 
            and contain letters and numbers.
          </p>
        </div>
      </form>

      <style jsx>{`
        .tracking-form-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem;
        }

        .tracking-form {
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

        .input-group {
          margin-bottom: 1.5rem;
        }

        .input-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #495057;
        }

        .input-wrapper {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .tracking-input {
          flex: 1;
          min-width: 250px;
          padding: 0.875rem 1rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s ease;
          font-family: 'Courier New', monospace;
          letter-spacing: 1px;
        }

        .tracking-input:focus {
          outline: none;
          border-color: #0070f3;
          box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
        }

        .tracking-input:disabled {
          background-color: #f8f9fa;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .track-button {
          padding: 0.875rem 1.5rem;
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
          gap: 0.5rem;
          white-space: nowrap;
        }

        .track-button:hover:not(:disabled) {
          background-color: #0051a2;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 112, 243, 0.3);
        }

        .track-button:disabled {
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

        .search-icon {
          font-size: 1rem;
        }

        .form-help {
          background-color: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid #0070f3;
        }

        .form-help p {
          margin: 0;
          color: #495057;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .tracking-form-container {
            padding: 1rem;
          }

          .tracking-form {
            padding: 1.5rem;
          }

          .form-header h2 {
            font-size: 1.5rem;
          }

          .input-wrapper {
            flex-direction: column;
          }

          .tracking-input {
            min-width: auto;
          }

          .track-button {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}