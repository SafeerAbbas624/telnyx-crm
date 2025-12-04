# 🛠️ Adler Capital CRM - Technology Stack

## 📦 FRONTEND DEPENDENCIES

### Core Framework
- **next**: ^14.2.15 - React framework with SSR/SSG
- **react**: ^18 - UI library
- **react-dom**: ^18 - DOM rendering

### UI Components & Styling
- **@radix-ui/react-***: ^1.x - Headless UI components
  - accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu
  - hover-card, label, menubar, navigation-menu, popover
  - progress, radio-group, scroll-area, select, separator
  - slider, switch, tabs, toggle, tooltip
- **tailwindcss**: ^3.4.17 - Utility-first CSS framework
- **tailwind-merge**: ^2.5.5 - Merge Tailwind classes
- **tailwindcss-animate**: ^1.0.7 - Animation utilities
- **lucide-react**: ^0.454.0 - Icon library
- **class-variance-authority**: ^0.7.1 - CSS class composition

### Forms & Validation
- **react-hook-form**: ^7.54.1 - Form state management
- **@hookform/resolvers**: ^3.9.1 - Form validation resolvers
- **zod**: ^3.24.1 - TypeScript-first schema validation

### State Management
- **zustand**: Latest - Lightweight state management
- **react-window**: ^2.0.2 - Virtual scrolling for large lists
- **react-window-infinite-loader**: ^1.0.10 - Infinite scroll

### Real-time Communication
- **socket.io-client**: ^4.8.1 - WebSocket client
- **@telnyx/webrtc**: ^2.22.17 - WebRTC for voice calls

### Rich Text Editing
- **@tiptap/react**: ^3.6.3 - Rich text editor
- **@tiptap/starter-kit**: ^3.6.3 - Editor extensions
- **@tiptap/extension-image**: ^3.6.3 - Image support
- **@tiptap/extension-link**: ^3.6.3 - Link support
- **@tiptap/extension-placeholder**: ^3.6.3 - Placeholder text

### Data & Utilities
- **date-fns**: ^3.0.0 - Date manipulation
- **date-fns-tz**: ^3.2.0 - Timezone support
- **papaparse**: Latest - CSV parsing
- **uuid**: ^11.1.0 - UUID generation
- **clsx**: ^2.1.1 - Conditional className utility

### File Handling
- **react-dropzone**: ^14.3.8 - Drag-and-drop file upload
- **form-data**: ^4.0.4 - FormData handling

### UI Enhancements
- **embla-carousel-react**: 8.5.1 - Carousel component
- **react-resizable-panels**: ^2.1.7 - Resizable panels
- **vaul**: ^0.9.6 - Drawer component
- **sonner**: ^1.7.1 - Toast notifications
- **next-themes**: ^0.4.4 - Theme management
- **cmdk**: 1.0.4 - Command palette
- **input-otp**: 1.4.1 - OTP input

### Authentication
- **next-auth**: ^4.24.11 - Authentication library
- **@next-auth/prisma-adapter**: ^1.0.7 - Prisma adapter

---

## ⚙️ BACKEND DEPENDENCIES

### Database & ORM
- **@prisma/client**: ^6.12.0 - Prisma ORM client
- **prisma**: ^6.12.0 - Prisma CLI

### Database Drivers
- **pg**: PostgreSQL driver (implicit via Prisma)

### Email
- **nodemailer**: ^6.10.1 - Email sending
- **mailparser**: ^3.7.4 - Email parsing
- **imap-simple**: ^5.1.0 - IMAP client

### Job Queue
- **bull**: ^4.16.5 - Job queue
- **@types/bull**: ^3.15.9 - Bull types
- **ioredis**: ^5.8.0 - Redis client

### Search (Optional)
- **@elastic/elasticsearch**: ^9.1.1 - Elasticsearch client

### Real-time
- **socket.io**: ^4.8.1 - WebSocket server

### Security
- **bcryptjs**: ^3.0.2 - Password hashing
- **@types/bcryptjs**: ^2.4.6 - bcryptjs types

### Utilities
- **dotenv**: ^17.2.0 - Environment variables
- **node-fetch**: ^3.3.2 - HTTP client
- **tsx**: ^4.20.6 - TypeScript executor

### CSV Processing
- **csv-parse**: ^6.1.0 - CSV parser

---

## 🔧 DEVELOPMENT DEPENDENCIES

### TypeScript
- **typescript**: ^5 - TypeScript compiler
- **@types/node**: ^22 - Node.js types
- **@types/react**: ^18 - React types
- **@types/react-dom**: ^18 - React DOM types
- **@types/react-window**: ^1.8.8 - React Window types
- **@types/mailparser**: ^3.4.6 - Mailparser types
- **@types/uuid**: ^10.0.0 - UUID types
- **@types/react-dropzone**: ^4.2.2 - Dropzone types

### Linting & Code Quality
- **eslint**: ^8.57.0 - JavaScript linter
- **eslint-config-next**: ^14.2.15 - Next.js ESLint config
- **@typescript-eslint/eslint-plugin**: Latest - TypeScript ESLint
- **@typescript-eslint/parser**: Latest - TypeScript parser

### Build Tools
- **postcss**: ^8.5 - CSS processor
- **autoprefixer**: ^10.4.20 - CSS vendor prefixes

---

## 🗄️ DATABASE

### PostgreSQL
- **Version**: 12+
- **Connection**: Via Prisma ORM
- **Features**:
  - JSONB for flexible data
  - UUID for primary keys
  - Timestamptz for timezone-aware timestamps
  - Full-text search (optional)
  - Partitioning for large tables

### Redis
- **Purpose**: Job queue (Bull), caching, sessions
- **Used by**: Background jobs, real-time features

### Elasticsearch (Optional)
- **Purpose**: Full-text search, analytics
- **Used by**: Advanced contact search

---

## 🔌 EXTERNAL INTEGRATIONS

### Telnyx
- **SMS**: Send/receive SMS messages
- **Voice**: Make/receive calls
- **WebRTC**: Browser-based calling
- **Webhooks**: Real-time status updates
- **API**: REST API for phone number management

### Email Providers
- **Gmail**: SMTP/IMAP support
- **Domain Email**: Any SMTP/IMAP provider
- **Outlook**: SMTP/IMAP support
- **Custom**: Any email provider with SMTP/IMAP

### Authentication
- **NextAuth.js**: Email/password, OAuth providers
- **Session Storage**: Database (Prisma adapter)

---

## 📊 DEPLOYMENT

### Process Manager
- **PM2**: Production process management
- **Config**: ecosystem.config.js
- **Features**:
  - Clustering (multiple instances)
  - Auto-restart on crash
  - Memory limits
  - Log rotation
  - Health monitoring

### Environment
- **Node.js**: 18+
- **Port**: 3000
- **Memory**: 1GB per instance
- **Uptime**: 24/7 production

### File Storage
- **Local**: `/public/uploads/`
- **Structure**: `/uploads/loans/[loanId]/[filename]`
- **Scalability**: Can migrate to S3/Cloud Storage

---

## 🔐 SECURITY

### Password Security
- **Hashing**: bcryptjs with salt rounds
- **Storage**: Hashed in database

### Email Credentials
- **Encryption**: Encrypted before storage
- **Decryption**: On-demand for IMAP/SMTP

### API Security
- **Authentication**: NextAuth.js sessions
- **Authorization**: Role-based access control
- **CORS**: Configured for same-origin

### Data Protection
- **HTTPS**: Required in production
- **Session Tokens**: Secure, httpOnly cookies
- **CSRF**: Protected by NextAuth.js

---

## 📈 PERFORMANCE

### Frontend Optimization
- **Code Splitting**: Next.js automatic
- **Image Optimization**: Next.js Image component
- **Virtual Scrolling**: React Window for large lists
- **Lazy Loading**: Dynamic imports

### Backend Optimization
- **Database Indexes**: Comprehensive indexing
- **Query Optimization**: Prisma select/include
- **Caching**: Redis for frequently accessed data
- **Job Queue**: Async processing with Bull

### Monitoring
- **Logs**: PM2 log files
- **Metrics**: Custom tracking
- **Errors**: Error logging and reporting

---

## 🚀 SCALABILITY

### Horizontal Scaling
- **PM2 Clustering**: Multiple Node.js instances
- **Load Balancing**: Nginx/HAProxy
- **Database**: PostgreSQL replication

### Vertical Scaling
- **Memory**: Increase per instance
- **CPU**: Multi-core utilization
- **Storage**: Database optimization

### Future Enhancements
- **Microservices**: Separate services for email, SMS, calls
- **Message Queue**: RabbitMQ/Kafka for high volume
- **CDN**: CloudFlare for static assets
- **Cloud Storage**: AWS S3 for file uploads

---

**Last Updated**: 2025-11-06
**Version**: Enterprise Edition

