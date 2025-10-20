import { useState } from 'react'

interface ContactFormProps {
  onSubmit: (data: { name: string; email: string; message: string }) => void
  loading?: boolean
  success?: boolean
  error?: string
}

export default function ContactForm({ onSubmit, loading = false, success = false, error }: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const isFormValid = formData.name.trim() && formData.email.trim() && formData.message.trim()

  return (
    <div className="contact-form-container">
      <form onSubmit={handleSubmit} className="contact-form">
        <div className="form-header">
          <h2>Contact Us</h2>
          <p>Have a question or need help? We're here to assist you!</p>
        </div>

        {success && (
          <div className="success-message">
            <span className="success-icon">✅</span>
            Thank you for your message! We'll get back to you soon.
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email address"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="message">Message *</label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="Tell us how we can help you..."
            rows={6}
            required
            disabled={loading}
          />
          <div className="character-count">
            {formData.message.length}/1000 characters
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
              Sending...
            </>
          ) : (
            <>
              <span className="send-icon">📧</span>
              Send Message
            </>
          )}
        </button>

        <div className="form-help">
          <p>
            <strong>Response Time:</strong> We typically respond within 24 hours during business days.
          </p>
        </div>
      </form>

      <style jsx>{`
        .contact-form-container {
          max-width: 700px;
          margin: 0 auto;
          padding: 2rem;
        }

        .contact-form {
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

        .success-message {
          background-color: #d4edda;
          color: #155724;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid #c3e6cb;
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

        .success-icon,
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
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #495057;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #0070f3;
          box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.1);
        }

        .form-group input:disabled,
        .form-group textarea:disabled {
          background-color: #f8f9fa;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 120px;
        }

        .character-count {
          text-align: right;
          font-size: 0.8rem;
          color: #6c757d;
          margin-top: 0.25rem;
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
          margin-bottom: 1.5rem;
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

        .send-icon {
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
          .contact-form-container {
            padding: 1rem;
          }

          .contact-form {
            padding: 1.5rem;
          }

          .form-header h2 {
            font-size: 1.5rem;
          }

          .form-row {
            grid-template-columns: 1fr;
            gap: 0;
          }
        }
      `}</style>
    </div>
  )
}