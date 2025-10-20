import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>SwiftShip</h3>
          <p>Fast, reliable package tracking service for all your shipping needs.</p>
        </div>
        
        <div className="footer-section">
          <h4>Quick Links</h4>
          <ul>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/track">Track Package</Link></li>
            <li><Link href="/contact">Contact Us</Link></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h4>Support</h4>
          <ul>
            <li><Link href="/contact">Help Center</Link></li>
            <li><Link href="/contact">Report Issue</Link></li>
            <li><Link href="/contact">Feedback</Link></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h4>Contact Info</h4>
          <p>Email: support@swiftship.com</p>
          <p>Phone: 1-800-SWIFT-SHIP</p>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; 2024 SwiftShip. All rights reserved.</p>
        <p>Built with Next.js and TypeScript</p>
      </div>

      <style jsx>{`
        .footer {
          background-color: #2c3e50;
          color: white;
          margin-top: auto;
        }

        .footer-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 3rem 2rem 2rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 2rem;
        }

        .footer-section h3 {
          color: #0070f3;
          margin-bottom: 1rem;
          font-size: 1.5rem;
        }

        .footer-section h4 {
          color: #ecf0f1;
          margin-bottom: 1rem;
          font-size: 1.1rem;
        }

        .footer-section p {
          color: #bdc3c7;
          line-height: 1.6;
          margin-bottom: 0.5rem;
        }

        .footer-section ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .footer-section ul li {
          margin-bottom: 0.5rem;
        }

        .footer-section ul li a {
          color: #bdc3c7;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .footer-section ul li a:hover {
          color: #0070f3;
        }

        .footer-bottom {
          border-top: 1px solid #34495e;
          padding: 1.5rem 2rem;
          text-align: center;
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-bottom p {
          color: #95a5a6;
          margin: 0;
          font-size: 0.9rem;
        }

        @media (max-width: 768px) {
          .footer-content {
            padding: 2rem 1rem;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
          }

          .footer-bottom {
            flex-direction: column;
            gap: 0.5rem;
            padding: 1rem;
          }
        }

        @media (max-width: 480px) {
          .footer-content {
            grid-template-columns: 1fr;
            text-align: center;
          }
        }
      `}</style>
    </footer>
  )
}