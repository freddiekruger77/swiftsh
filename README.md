# SwiftShip - Package Tracking System

A modern, fast, and reliable package tracking system built with Next.js, TypeScript, and SQLite3.

## 🚀 Features

- 📦 **Real-time Package Tracking** - Track packages with detailed status history
- 👨‍💼 **Admin Panel** - Comprehensive package management interface
- 📱 **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- 🔒 **Secure Authentication** - Protected admin routes with NextAuth.js
- 💬 **Customer Support** - Contact form with admin management
- ⚡ **Fast Performance** - Optimized for speed and user experience
- 🎨 **Modern UI** - Clean, professional interface with smooth animations
- 🔍 **Advanced Search** - Quick package lookup with validation
- 📊 **Dashboard Analytics** - Package status overview and statistics

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Database**: SQLite3 with optimized queries
- **Authentication**: NextAuth.js with session management
- **Styling**: CSS-in-JS with responsive utilities
- **Validation**: Comprehensive client-side and server-side validation
- **Error Handling**: Advanced error boundary system
- **Deployment**: Vercel with production optimizations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-username/swiftship.git
cd swiftship
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration:
```bash
# Database
DATABASE_PATH=./data/swiftship.db

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Admin Credentials
ADMIN_EMAIL=admin@swiftship.com
ADMIN_PASSWORD=admin123
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
swiftship/
├── pages/                  # Next.js pages and API routes
│   ├── api/               # API endpoints
│   ├── admin/             # Admin pages
│   └── ...                # Public pages
├── components/            # Reusable React components
│   ├── forms/             # Form components with validation
│   ├── ui/                # UI components
│   └── ...
├── lib/                   # Utilities and helpers
│   ├── db.ts              # Database operations
│   ├── auth.ts            # Authentication utilities
│   ├── validation.ts      # Form validation
│   └── errorHandling.ts   # Error management
├── hooks/                 # Custom React hooks
├── styles/                # Global styles and utilities
├── data/                  # SQLite database files
└── .kiro/specs/           # Project specifications
```

## 🎯 Usage

### For Customers

1. **Track Packages**: Enter your tracking number on the homepage
2. **View Details**: See real-time status updates and delivery information
3. **Get Help**: Use the contact form for support

### For Administrators

1. **Login**: Access `/admin/login` with admin credentials
2. **Dashboard**: View package statistics and overview
3. **Manage Packages**: Create, update, and track packages
4. **Handle Contacts**: Review and respond to customer inquiries

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Deploy to Vercel**
- Go to [vercel.com](https://vercel.com)
- Import your GitHub repository
- Set environment variables
- Deploy!

3. **Set Environment Variables**
```bash
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-production-secret
DATABASE_PATH=/tmp/swiftship.db
ADMIN_EMAIL=admin@swiftship.com
ADMIN_PASSWORD=your-secure-password
```

### Alternative Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions including:
- Netlify deployment
- Railway deployment
- Docker deployment
- Custom server deployment

## 🧪 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
npm run deploy       # Deploy to Vercel
```

### Database Management

```bash
# Initialize database with sample data
curl -X POST http://localhost:3000/api/admin/init-db

# Check application health
curl http://localhost:3000/api/health
```

### Testing

The application includes comprehensive error handling and validation:
- Form validation with real-time feedback
- Error boundaries for graceful error handling
- API error handling with retry logic
- Database connection health checks

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | SQLite database file path | `./data/swiftship.db` |
| `NEXTAUTH_URL` | Application URL for NextAuth | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | JWT secret for NextAuth | Required |
| `ADMIN_EMAIL` | Admin login email | `admin@swiftship.com` |
| `ADMIN_PASSWORD` | Admin login password | `admin123` |
| `SEED_DATABASE` | Seed with sample data | `false` |

### Customization

- **Styling**: Modify `styles/globals.css` for global styles
- **Components**: Add new components in `components/` directory
- **API Routes**: Add new endpoints in `pages/api/` directory
- **Database Schema**: Modify `lib/db.ts` for schema changes

## 📊 Features Overview

### Package Tracking
- Real-time status updates
- Detailed tracking history
- Estimated delivery dates
- Location tracking
- Exception handling

### Admin Panel
- Package creation and management
- Status update system
- Customer contact management
- Dashboard analytics
- Secure authentication

### User Experience
- Mobile-responsive design
- Fast loading times
- Intuitive navigation
- Error handling
- Accessibility compliance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the [DEPLOYMENT.md](./DEPLOYMENT.md) guide
- **Issues**: Report bugs on [GitHub Issues](https://github.com/your-username/swiftship/issues)
- **Health Check**: Visit `/api/health` to check system status

## 🎉 Demo

Try the live demo at: [https://swiftship.vercel.app](https://swiftship.vercel.app)

**Demo Credentials:**
- Email: `admin@swiftship.com`
- Password: `admin123`

**Sample Tracking Numbers:**
- `SW123456789` - In Transit
- `SW987654321` - Delivered
- `SW456789123` - Out for Delivery

---

Built with ❤️ using Next.js, TypeScript, and modern web technologies.