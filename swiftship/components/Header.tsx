import Link from 'next/link'
import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { data: session } = useSession()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <header className="header">
      <nav className="nav">
        <Link href="/" className="logo">
          <h1>SwiftShip</h1>
        </Link>
        
        <button 
          className={`menu-toggle ${isMenuOpen ? 'active' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <ul className={`nav-links ${isMenuOpen ? 'active' : ''}`}>
          <li><Link href="/" onClick={() => setIsMenuOpen(false)}>Home</Link></li>
          <li><Link href="/track" onClick={() => setIsMenuOpen(false)}>Track Package</Link></li>
          <li><Link href="/contact" onClick={() => setIsMenuOpen(false)}>Contact</Link></li>
          {session && (session.user as any)?.role === 'admin' ? (
            <li><Link href="/admin" onClick={() => setIsMenuOpen(false)}>Admin</Link></li>
          ) : (
            <li><Link href="/admin/login" onClick={() => setIsMenuOpen(false)}>Admin Login</Link></li>
          )}
        </ul>
      </nav>

      <style jsx>{`
        .header {
          background-color: #0070f3;
          color: white;
          padding: 0;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem 2rem;
          position: relative;
        }

        .logo h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: bold;
          color: white;
          text-decoration: none;
        }

        .logo:hover h1 {
          opacity: 0.9;
        }

        .menu-toggle {
          display: none;
          flex-direction: column;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
        }

        .menu-toggle span {
          width: 25px;
          height: 3px;
          background-color: white;
          margin: 3px 0;
          transition: 0.3s;
          border-radius: 2px;
        }

        .menu-toggle.active span:nth-child(1) {
          transform: rotate(-45deg) translate(-5px, 6px);
        }

        .menu-toggle.active span:nth-child(2) {
          opacity: 0;
        }

        .menu-toggle.active span:nth-child(3) {
          transform: rotate(45deg) translate(-5px, -6px);
        }

        .nav-links {
          display: flex;
          list-style: none;
          gap: 2rem;
          margin: 0;
          padding: 0;
        }

        .nav-links li a {
          color: white;
          text-decoration: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .nav-links li a:hover {
          background-color: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        @media (max-width: 768px) {
          .nav {
            padding: 1rem;
          }

          .menu-toggle {
            display: flex;
          }

          .nav-links {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background-color: #0070f3;
            flex-direction: column;
            gap: 0;
            padding: 1rem 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transform: translateY(-100%);
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
          }

          .nav-links.active {
            transform: translateY(0);
            opacity: 1;
            visibility: visible;
          }

          .nav-links li {
            width: 100%;
          }

          .nav-links li a {
            display: block;
            padding: 1rem 2rem;
            border-radius: 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          .nav-links li:last-child a {
            border-bottom: none;
          }
        }

        @media (max-width: 480px) {
          .logo h1 {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </header>
  )
}