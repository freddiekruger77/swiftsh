import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import TrackingForm from '@/components/TrackingForm'
import PackageCard from '@/components/PackageCard'

export default function Track() {
  const [trackingResult, setTrackingResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [initialLoad, setInitialLoad] = useState(true)
  const router = useRouter()

  // Handle tracking number from URL query parameter
  useEffect(() => {
    const { number } = router.query
    if (number && typeof number === 'string' && initialLoad) {
      handleTrackingSubmit(number)
      setInitialLoad(false)
    }
  }, [router.query, initialLoad])

  const handleTrackingSubmit = async (trackingNumber: string) => {
    setLoading(true)
    setError('')
    setTrackingResult(null)

    // Update URL with tracking number
    router.push(`/track?number=${trackingNumber}`, undefined, { shallow: true })

    try {
      const response = await fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trackingNumber }),
      })

      const data = await response.json()

      if (data.success) {
        setTrackingResult(data.package)
      } else {
        setError(data.message || 'Package not found')
      }
    } catch (err) {
      setError('Unable to track package at this time. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleNewSearch = () => {
    setTrackingResult(null)
    setError('')
    router.push('/track', undefined, { shallow: true })
  }

  return (
    <Layout>
      <Head>
        <title>
          {trackingResult 
            ? `Track ${trackingResult.trackingNumber} - SwiftShip`
            : 'Track Package - SwiftShip'
          }
        </title>
        <meta name="description" content="Track your package status with detailed history and real-time updates" />
      </Head>

      <div className="track-page">
        <div className="container">
          <div className="page-header">
            <h1>Package Tracking</h1>
            <p>Get detailed information about your package location and delivery status</p>
          </div>

          {!trackingResult && (
            <div className="search-section">
              <TrackingForm 
                onSubmit={handleTrackingSubmit}
                loading={loading}
                error={error}
              />
            </div>
          )}

          {trackingResult && (
            <div className="results-section">
              <div className="results-header">
                <h2>Package Details</h2>
                <button onClick={handleNewSearch} className="new-search-btn">
                  Track Another Package
                </button>
              </div>

              <PackageCard package={trackingResult} showHistory={true} />

              <div className="additional-info">
                <div className="info-grid">
                  <div className="info-card">
                    <h3>📍 Current Status</h3>
                    <p>Your package is currently <strong>{trackingResult.status.replace(/_/g, ' ').toLowerCase()}</strong></p>
                    <p>Last updated: {new Date(trackingResult.lastUpdated).toLocaleString()}</p>
                  </div>

                  {trackingResult.estimatedDelivery && (
                    <div className="info-card">
                      <h3>📅 Estimated Delivery</h3>
                      <p>Expected delivery date:</p>
                      <p><strong>{new Date(trackingResult.estimatedDelivery).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</strong></p>
                    </div>
                  )}

                  <div className="info-card">
                    <h3>📞 Need Help?</h3>
                    <p>Having issues with your package?</p>
                    <button 
                      onClick={() => router.push('/contact')}
                      className="contact-btn"
                    >
                      Contact Support
                    </button>
                  </div>

                  <div className="info-card">
                    <h3>🔄 Auto Refresh</h3>
                    <p>This page automatically refreshes tracking information</p>
                    <button 
                      onClick={() => handleTrackingSubmit(trackingResult.trackingNumber)}
                      className="refresh-btn"
                      disabled={loading}
                    >
                      {loading ? 'Refreshing...' : 'Refresh Now'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!trackingResult && !loading && (
            <div className="help-section">
              <h2>Tracking Help</h2>
              <div className="help-grid">
                <div className="help-item">
                  <h3>📦 Where to find your tracking number?</h3>
                  <ul>
                    <li>Check your shipping confirmation email</li>
                    <li>Look on your receipt or shipping label</li>
                    <li>Contact the sender if you don't have it</li>
                  </ul>
                </div>

                <div className="help-item">
                  <h3>🔍 Tracking number format</h3>
                  <ul>
                    <li>Usually 8-20 characters long</li>
                    <li>Contains letters and numbers</li>
                    <li>Example: SW123456789</li>
                  </ul>
                </div>

                <div className="help-item">
                  <h3>⏰ Update frequency</h3>
                  <ul>
                    <li>Updates every few hours during transit</li>
                    <li>More frequent updates near delivery</li>
                    <li>May take 24 hours for initial tracking</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .track-page {
          min-height: calc(100vh - 120px);
          background-color: #f8f9fa;
          padding: 2rem 0;
        }

        .container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 0 2rem;
        }

        .page-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .page-header h1 {
          font-size: 2.5rem;
          color: #0070f3;
          margin-bottom: 1rem;
          font-weight: 700;
        }

        .page-header p {
          font-size: 1.1rem;
          color: #6c757d;
          max-width: 600px;
          margin: 0 auto;
        }

        .search-section {
          margin-bottom: 3rem;
        }

        .results-section {
          margin-bottom: 3rem;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .results-header h2 {
          color: #333;
          font-size: 1.75rem;
          margin: 0;
        }

        .new-search-btn {
          background-color: #6c757d;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .new-search-btn:hover {
          background-color: #5a6268;
          transform: translateY(-1px);
        }

        .additional-info {
          margin-top: 2rem;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .info-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          border: 1px solid #e9ecef;
        }

        .info-card h3 {
          color: #0070f3;
          margin-bottom: 1rem;
          font-size: 1.1rem;
        }

        .info-card p {
          color: #666;
          margin-bottom: 0.5rem;
          line-height: 1.5;
        }

        .contact-btn,
        .refresh-btn {
          background-color: #0070f3;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 0.5rem;
        }

        .contact-btn:hover,
        .refresh-btn:hover:not(:disabled) {
          background-color: #0051a2;
        }

        .refresh-btn:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .help-section {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          border: 1px solid #e9ecef;
        }

        .help-section h2 {
          color: #333;
          text-align: center;
          margin-bottom: 2rem;
          font-size: 1.75rem;
        }

        .help-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
        }

        .help-item h3 {
          color: #0070f3;
          margin-bottom: 1rem;
          font-size: 1.2rem;
        }

        .help-item ul {
          list-style: none;
          padding: 0;
        }

        .help-item li {
          color: #666;
          margin-bottom: 0.5rem;
          padding-left: 1.5rem;
          position: relative;
        }

        .help-item li::before {
          content: '•';
          color: #0070f3;
          position: absolute;
          left: 0;
          font-weight: bold;
        }

        @media (max-width: 768px) {
          .container {
            padding: 0 1rem;
          }

          .page-header h1 {
            font-size: 2rem;
          }

          .results-header {
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .help-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Layout>
  )
}