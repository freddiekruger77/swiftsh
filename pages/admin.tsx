import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import AdminPackageForm from '@/components/AdminPackageForm'
import PackageCard from '@/components/PackageCard'

export default function Admin() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'packages' | 'create' | 'contacts'>('dashboard')
  const [packages, setPackages] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/admin/login')
      return
    }

    if ((session.user as any)?.role !== 'admin') {
      router.push('/admin/login')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    if (activeTab === 'packages') {
      fetchPackages()
    } else if (activeTab === 'contacts') {
      fetchContacts()
    }
  }, [activeTab])

  const fetchPackages = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/packages')
      const data = await response.json()
      if (data.success) {
        setPackages(data.packages || [])
      } else {
        setError('Failed to load packages')
      }
    } catch (err) {
      setError('Failed to load packages')
    } finally {
      setLoading(false)
    }
  }

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/packages?type=contacts')
      const data = await response.json()
      if (data.success) {
        setContacts(data.contacts || [])
      } else {
        setError('Failed to load contacts')
      }
    } catch (err) {
      setError('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }

  const handlePackageSubmit = async (formData: any) => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(`Package ${formData.action === 'create' ? 'created' : 'updated'} successfully!`)
        if (activeTab === 'packages') {
          fetchPackages()
        }
      } else {
        setError(data.message || 'Operation failed')
      }
    } catch (err) {
      setError('Operation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResolveContact = async (contactId: string) => {
    try {
      const response = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'resolve-contact', contactId }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Contact marked as resolved')
        fetchContacts()
      } else {
        setError('Failed to resolve contact')
      }
    } catch (err) {
      setError('Failed to resolve contact')
    }
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/admin/login' })
  }

  if (status === 'loading') {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!session || (session.user as any)?.role !== 'admin') {
    return null
  }

  return (
    <>
      <Head>
        <title>Admin Panel - SwiftShip</title>
        <meta name="description" content="SwiftShip admin panel for package management" />
      </Head>
      
      <div className="admin-container">
        <header className="admin-header">
          <h1>SwiftShip Admin</h1>
          <div className="admin-user-info">
            <span>Welcome, {session.user?.name}</span>
            <button onClick={handleSignOut} className="sign-out-btn">
              Sign Out
            </button>
          </div>
        </header>

        <nav className="admin-nav">
          <button 
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button 
            className={`nav-btn ${activeTab === 'packages' ? 'active' : ''}`}
            onClick={() => setActiveTab('packages')}
          >
            📦 Packages
          </button>
          <button 
            className={`nav-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            ➕ Create Package
          </button>
          <button 
            className={`nav-btn ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contacts')}
          >
            📞 Contacts
          </button>
        </nav>

        <main className="admin-main">
          {error && (
            <div className="alert alert-error">
              <span>⚠️</span>
              {error}
              <button onClick={() => setError('')} className="alert-close">×</button>
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <span>✅</span>
              {success}
              <button onClick={() => setSuccess('')} className="alert-close">×</button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="dashboard">
              <h2>Dashboard Overview</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">📦</div>
                  <div className="stat-content">
                    <h3>Total Packages</h3>
                    <p className="stat-number">{packages.length}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📞</div>
                  <div className="stat-content">
                    <h3>Contact Submissions</h3>
                    <p className="stat-number">{contacts.length}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🚚</div>
                  <div className="stat-content">
                    <h3>In Transit</h3>
                    <p className="stat-number">{packages.filter(p => p.status === 'in_transit').length}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">✅</div>
                  <div className="stat-content">
                    <h3>Delivered</h3>
                    <p className="stat-number">{packages.filter(p => p.status === 'delivered').length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'packages' && (
            <div className="packages-section">
              <div className="section-header">
                <h2>Package Management</h2>
                <button 
                  onClick={() => setActiveTab('create')}
                  className="primary-btn"
                >
                  Create New Package
                </button>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading packages...</p>
                </div>
              ) : packages.length === 0 ? (
                <div className="empty-state">
                  <p>No packages found. Create your first package to get started.</p>
                </div>
              ) : (
                <div className="packages-list">
                  {packages.map((pkg) => (
                    <PackageCard key={pkg.id} package={pkg} showHistory={false} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <div className="create-section">
              <AdminPackageForm 
                onSubmit={handlePackageSubmit}
                loading={loading}
                error={error}
                mode="create"
              />
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="contacts-section">
              <h2>Contact Submissions</h2>

              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading contacts...</p>
                </div>
              ) : contacts.length === 0 ? (
                <div className="empty-state">
                  <p>No contact submissions found.</p>
                </div>
              ) : (
                <div className="contacts-list">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="contact-card">
                      <div className="contact-header">
                        <h3>{contact.name}</h3>
                        <div className="contact-meta">
                          <span className="contact-email">{contact.email}</span>
                          <span className="contact-date">
                            {new Date(contact.submittedAt).toLocaleDateString()}
                          </span>
                          <span className={`contact-status ${contact.resolved ? 'resolved' : 'pending'}`}>
                            {contact.resolved ? 'Resolved' : 'Pending'}
                          </span>
                        </div>
                      </div>
                      <div className="contact-message">
                        <p>{contact.message}</p>
                      </div>
                      {!contact.resolved && (
                        <div className="contact-actions">
                          <button 
                            onClick={() => handleResolveContact(contact.id)}
                            className="resolve-btn"
                          >
                            Mark as Resolved
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        .admin-container {
          min-height: 100vh;
          background-color: #f8f9fa;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          gap: 1rem;
        }

        .admin-header {
          background-color: white;
          padding: 1rem 2rem;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .admin-header h1 {
          color: #0070f3;
          margin: 0;
          font-size: 1.5rem;
        }

        .admin-user-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .sign-out-btn {
          padding: 0.5rem 1rem;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
          font-weight: 500;
        }

        .sign-out-btn:hover {
          background-color: #c82333;
        }

        .admin-nav {
          background-color: white;
          padding: 0 2rem;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
        }

        .nav-btn {
          padding: 1rem 1.5rem;
          background: none;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 3px solid transparent;
          white-space: nowrap;
          font-weight: 500;
        }

        .nav-btn:hover {
          background-color: #f8f9fa;
        }

        .nav-btn.active {
          color: #0070f3;
          border-bottom-color: #0070f3;
        }

        .admin-main {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .alert {
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          position: relative;
        }

        .alert-error {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .alert-success {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .alert-close {
          position: absolute;
          right: 1rem;
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: inherit;
        }

        .dashboard h2 {
          margin-bottom: 2rem;
          color: #333;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .stat-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .stat-icon {
          font-size: 2.5rem;
        }

        .stat-content h3 {
          color: #666;
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .stat-number {
          font-size: 2rem;
          font-weight: 700;
          color: #0070f3;
          margin: 0;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .section-header h2 {
          color: #333;
          margin: 0;
        }

        .primary-btn {
          background-color: #0070f3;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .primary-btn:hover {
          background-color: #0051a2;
          transform: translateY(-1px);
        }

        .loading-state,
        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #666;
        }

        .spinner {
          width: 2rem;
          height: 2rem;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #0070f3;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .packages-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .contacts-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .contact-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .contact-header {
          margin-bottom: 1rem;
        }

        .contact-header h3 {
          color: #0070f3;
          margin: 0 0 0.5rem 0;
        }

        .contact-meta {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .contact-email {
          color: #666;
          font-size: 0.9rem;
        }

        .contact-date {
          color: #999;
          font-size: 0.85rem;
        }

        .contact-status {
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .contact-status.pending {
          background-color: #fff3cd;
          color: #856404;
        }

        .contact-status.resolved {
          background-color: #d4edda;
          color: #155724;
        }

        .contact-message p {
          color: #333;
          line-height: 1.6;
          margin: 0;
        }

        .contact-actions {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e9ecef;
        }

        .resolve-btn {
          background-color: #28a745;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
          font-weight: 500;
        }

        .resolve-btn:hover {
          background-color: #218838;
        }

        @media (max-width: 768px) {
          .admin-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .admin-main {
            padding: 1rem;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .section-header {
            flex-direction: column;
            align-items: stretch;
          }

          .contact-meta {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
        }
      `}</style>
    </>
  )
}