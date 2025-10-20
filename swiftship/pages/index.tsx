import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import TrackingForm from '@/components/TrackingForm'
import PackageCard from '@/components/PackageCard'

export default function Home() {
  const [trackingResult, setTrackingResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleTrackingSubmit = async (trackingNumber: string) => {
    setLoading(true)
    setError('')
    setTrackingResult(null)

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

  const handleViewDetails = (trackingNumber: string) => {
    router.push(`/track?number=${trackingNumber}`)
  }

  return (
    <Layout>
      <Head>
        <title>SwiftShip - Fast & Reliable Package Tracking</title>
        <meta name="description" content="Track your packages with SwiftShip - Fast, reliable, and secure package tracking service" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="homepage">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-content">
            <h1>Fast & Reliable Package Tracking</h1>
            <p>Track your packages in real-time with SwiftShip's advanced tracking system</p>
            
            <div className="hero-features">
              <div className="feature">
                <span className="feature-icon">🚀</span>
                <span>Real-time Updates</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🔒</span>
                <span>Secure Tracking</span>
              </div>
              <div className="feature">
                <span className="feature-icon">📱</span>
                <span>Mobile Friendly</span>
              </div>
            </div>
          </div>
        </section>

        {/* Tracking Section */}
        <section className="tracking-section">
          <TrackingForm 
            onSubmit={handleTrackingSubmit}
            loading={loading}
            error={error}
          />

          {trackingResult && (
            <div className="tracking-result">
              <PackageCard package={trackingResult} showHistory={false} />
              <div className="result-actions">
                <button 
                  onClick={() => handleViewDetails(trackingResult.trackingNumber)}
                  className="view-details-btn"
                >
                  View Full Details & History
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Features Section */}
        <section className="features-section">
          <div className="container">
            <h2>Why Choose SwiftShip?</h2>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon-large">📦</div>
                <h3>Easy Tracking</h3>
                <p>Simply enter your tracking number to get instant updates on your package location and status.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon-large">⚡</div>
                <h3>Real-time Updates</h3>
                <p>Get live updates as your package moves through our network, from pickup to delivery.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon-large">🌍</div>
                <h3>Global Coverage</h3>
                <p>Track packages worldwide with our extensive network of shipping partners and carriers.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon-large">📞</div>
                <h3>24/7 Support</h3>
                <p>Our customer support team is available around the clock to help with any tracking issues.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="container">
            <h2>Need Help?</h2>
            <p>Can't find your package or have questions about your shipment?</p>
            <button 
              onClick={() => router.push('/contact')}
              className="cta-button"
            >
              Contact Support
            </button>
          </div>
        </section>
      </div>

      <style jsx>{`
        .homepage {
          min-height: calc(100vh - 120px);
        }

        .hero {
          background: linear-gradient(135deg, #0070f3 0%, #0051a2 100%);
          color: white;
          padding: 4rem 2rem;
          text-align: center;
        }

        .hero-content h1 {
          font-size: 3rem;
          font-weight: 700;
          margin-bottom: 1rem;
          line-height: 1.2;
        }

        .hero-content p {
          font-size: 1.25rem;
          margin-bottom: 2rem;
          opacity: 0.9;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero-features {
          display: flex;
          justify-content: center;
          gap: 2rem;
          flex-wrap: wrap;
        }

        .feature {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          padding: 0.75rem 1.5rem;
          border-radius: 25px;
          backdrop-filter: blur(10px);
        }

        .feature-icon {
          font-size: 1.25rem;
        }

        .tracking-section {
          padding: 4rem 2rem;
          background-color: #f8f9fa;
        }

        .tracking-result {
          max-width: 600px;
          margin: 2rem auto 0;
        }

        .result-actions {
          text-align: center;
          margin-top: 1rem;
        }

        .view-details-btn {
          background-color: #0070f3;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .view-details-btn:hover {
          background-color: #0051a2;
          transform: translateY(-1px);
        }

        .features-section {
          padding: 4rem 2rem;
          background-color: white;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .features-section h2 {
          text-align: center;
          font-size: 2.5rem;
          color: #333;
          margin-bottom: 3rem;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 2rem;
        }

        .feature-card {
          text-align: center;
          padding: 2rem;
          border-radius: 12px;
          background: #f8f9fa;
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .feature-icon-large {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .feature-card h3 {
          color: #0070f3;
          margin-bottom: 1rem;
          font-size: 1.5rem;
        }

        .feature-card p {
          color: #666;
          line-height: 1.6;
        }

        .cta-section {
          padding: 4rem 2rem;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          text-align: center;
        }

        .cta-section h2 {
          font-size: 2rem;
          color: #333;
          margin-bottom: 1rem;
        }

        .cta-section p {
          font-size: 1.1rem;
          color: #666;
          margin-bottom: 2rem;
        }

        .cta-button {
          background-color: #0070f3;
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 8px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cta-button:hover {
          background-color: #0051a2;
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(0, 112, 243, 0.3);
        }

        @media (max-width: 768px) {
          .hero {
            padding: 3rem 1rem;
          }

          .hero-content h1 {
            font-size: 2rem;
          }

          .hero-content p {
            font-size: 1.1rem;
          }

          .hero-features {
            gap: 1rem;
          }

          .feature {
            padding: 0.5rem 1rem;
            font-size: 0.9rem;
          }

          .tracking-section {
            padding: 3rem 1rem;
          }

          .features-section {
            padding: 3rem 1rem;
          }

          .features-section h2 {
            font-size: 2rem;
          }

          .features-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }

          .cta-section {
            padding: 3rem 1rem;
          }
        }
      `}</style>
    </Layout>
  )
}