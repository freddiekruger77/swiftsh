import { useState } from 'react'
import Head from 'next/head'
import Layout from '@/components/Layout'
import ContactForm from '@/components/ContactForm'

export default function Contact() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleContactSubmit = async (formData: { name: string; email: string; message: string }) => {
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        // Reset form would be handled by parent component
      } else {
        setError(data.message || 'Failed to send message')
      }
    } catch (err) {
      setError('Unable to send message at this time. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <Head>
        <title>Contact Us - SwiftShip Support</title>
        <meta name="description" content="Get help with your package tracking, shipping questions, or technical support from SwiftShip" />
      </Head>

      <div className="contact-page">
        <div className="container">
          <div className="page-header">
            <h1>Contact Support</h1>
            <p>We're here to help with any questions about your packages or our services</p>
          </div>

          <div className="contact-content">
            <div className="contact-form-section">
              <ContactForm 
                onSubmit={handleContactSubmit}
                loading={loading}
                success={success}
                error={error}
              />
            </div>

            <div className="contact-info-section">
              <div className="contact-methods">
                <h2>Other Ways to Reach Us</h2>
                
                <div className="contact-method">
                  <div className="method-icon">📞</div>
                  <div className="method-content">
                    <h3>Phone Support</h3>
                    <p>1-800-SWIFT-SHIP</p>
                    <p className="method-hours">Mon-Fri: 8AM-8PM EST<br />Sat-Sun: 9AM-5PM EST</p>
                  </div>
                </div>

                <div className="contact-method">
                  <div className="method-icon">📧</div>
                  <div className="method-content">
                    <h3>Email Support</h3>
                    <p>support@swiftship.com</p>
                    <p className="method-hours">Response within 24 hours</p>
                  </div>
                </div>

                <div className="contact-method">
                  <div className="method-icon">💬</div>
                  <div className="method-content">
                    <h3>Live Chat</h3>
                    <p>Available on our website</p>
                    <p className="method-hours">Mon-Fri: 9AM-6PM EST</p>
                  </div>
                </div>

                <div className="contact-method">
                  <div className="method-icon">📍</div>
                  <div className="method-content">
                    <h3>Mailing Address</h3>
                    <p>SwiftShip Customer Service<br />
                       123 Shipping Lane<br />
                       Logistics City, LC 12345</p>
                  </div>
                </div>
              </div>

              <div className="faq-section">
                <h2>Frequently Asked Questions</h2>
                
                <div className="faq-item">
                  <h3>How do I track my package?</h3>
                  <p>Enter your tracking number on our homepage or tracking page. You'll get real-time updates on your package location and status.</p>
                </div>

                <div className="faq-item">
                  <h3>My tracking number isn't working. What should I do?</h3>
                  <p>Make sure you've entered the correct tracking number. It can take up to 24 hours for new packages to appear in our system. If you're still having issues, contact us.</p>
                </div>

                <div className="faq-item">
                  <h3>How often is tracking information updated?</h3>
                  <p>Tracking information is updated every few hours during transit, with more frequent updates as your package approaches delivery.</p>
                </div>

                <div className="faq-item">
                  <h3>What if my package is delayed?</h3>
                  <p>Delays can happen due to weather, high volume, or other factors. Check your tracking for updates, and contact us if your package is significantly delayed.</p>
                </div>

                <div className="faq-item">
                  <h3>Can I change my delivery address?</h3>
                  <p>Address changes may be possible before your package is out for delivery. Contact us as soon as possible with your tracking number and new address.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .contact-page {
          min-height: calc(100vh - 120px);
          background-color: #f8f9fa;
          padding: 2rem 0;
        }

        .container {
          max-width: 1200px;
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

        .contact-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          align-items: start;
        }

        .contact-info-section {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .contact-methods {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          border: 1px solid #e9ecef;
        }

        .contact-methods h2 {
          color: #333;
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
        }

        .contact-method {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #e9ecef;
        }

        .contact-method:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .method-icon {
          font-size: 2rem;
          flex-shrink: 0;
        }

        .method-content h3 {
          color: #0070f3;
          margin-bottom: 0.5rem;
          font-size: 1.1rem;
        }

        .method-content p {
          color: #333;
          margin-bottom: 0.25rem;
          font-weight: 500;
        }

        .method-hours {
          color: #6c757d !important;
          font-size: 0.9rem !important;
          font-weight: normal !important;
        }

        .faq-section {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          border: 1px solid #e9ecef;
        }

        .faq-section h2 {
          color: #333;
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
        }

        .faq-item {
          margin-bottom: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #e9ecef;
        }

        .faq-item:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .faq-item h3 {
          color: #0070f3;
          margin-bottom: 0.75rem;
          font-size: 1.1rem;
        }

        .faq-item p {
          color: #666;
          line-height: 1.6;
        }

        @media (max-width: 968px) {
          .contact-content {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
        }

        @media (max-width: 768px) {
          .container {
            padding: 0 1rem;
          }

          .page-header h1 {
            font-size: 2rem;
          }

          .contact-methods,
          .faq-section {
            padding: 1.5rem;
          }

          .contact-method {
            flex-direction: column;
            text-align: center;
            gap: 0.5rem;
          }

          .method-icon {
            font-size: 2.5rem;
          }
        }
      `}</style>
    </Layout>
  )
}