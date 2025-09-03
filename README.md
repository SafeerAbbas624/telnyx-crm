# SMS Messaging Interface & CRM System

A comprehensive Customer Relationship Management (CRM) system with integrated SMS messaging, email communication, call management, and contact organization features. Built with Next.js, TypeScript, and modern web technologies.

## 🚀 Features

### 📱 Communication Management
- **SMS Messaging**: Send and receive SMS messages through Telnyx integration
- **Email Integration**: Full email management with SMTP/IMAP support for any email provider
- **Call Management**: Telnyx-powered voice calls with automatic activity logging
- **Real-time Messaging**: WebSocket integration for instant message delivery

### 👥 Contact Management
- **Advanced Contact Organization**: Comprehensive contact profiles with property information
- **Smart Filtering**: Advanced search and filter capabilities by location, property type, deal status
- **Bulk Operations**: Mass messaging, bulk contact management, and batch operations
- **Contact Assignment**: Assign contacts to team members for focused management

### 📊 Activity & Task Management
- **Activity Tracking**: Log calls, meetings, emails, and tasks with due dates
- **Task Filtering**: Filter activities by time periods (Overdue & Today, Next 7 Days, Next Month, All Time)
- **Interactive Task Cards**: Click-to-edit tasks with complete/delete functionality
- **Activity Timeline**: Chronological view of all contact communications

### 🎯 Text Blast & Campaigns
- **Advanced Text Blasting**: Send bulk SMS to filtered contact groups
- **Template Management**: Save and reuse message templates
- **Progress Tracking**: Real-time campaign progress with message counts
- **Smart Filtering**: Target specific contact segments with advanced filters

### 👨‍💼 User Management & Permissions
- **Admin Dashboard**: Full system access with user management capabilities
- **Team Dashboard**: Restricted access for team members with assigned resources
- **Role-Based Access**: Admin and team member roles with appropriate permissions
- **Resource Assignment**: Assign phone numbers, email accounts, and contacts to team members

## 🛠 Technology Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: Modern UI component library
- **React Hook Form**: Form management
- **Zustand**: State management

### Backend
- **Next.js API Routes**: Server-side API endpoints
- **Prisma ORM**: Database management and queries
- **PostgreSQL**: Primary database
- **NextAuth.js**: Authentication and session management

### Integrations
- **Telnyx**: SMS and voice communication platform
- **SMTP/IMAP**: Email integration for any email provider
- **WebSocket**: Real-time communication

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database
- Telnyx account for SMS/Voice services
- Email account with SMTP/IMAP access (Gmail, domain email, etc.)

## ⚙️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sms-messaging-interface
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

   # NextAuth
   NEXTAUTH_SECRET="your-nextauth-secret"
   NEXTAUTH_URL="http://localhost:3000"

   # Telnyx Configuration
   TELNYX_API_KEY="your-telnyx-api-key"
   TELNYX_PUBLIC_KEY="your-telnyx-public-key"
   TELNYX_WEBHOOK_SECRET="your-webhook-secret"

   # Production Webhook URL
   WEBHOOK_BASE_URL="https://yourdomain.com"
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npx prisma generate

   # Run database migrations
   npx prisma db push

   # (Optional) Seed database with sample data
   npx prisma db seed
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## 🗄️ Database Schema

### Core Tables
- **users**: User accounts with role-based access
- **contacts**: Contact information with property details
- **activities**: Tasks, calls, meetings, and notes
- **messages**: SMS message storage
- **telnyx_messages**: Telnyx-specific message data
- **email_accounts**: Email account configurations
- **email_messages**: Email storage and threading
- **telnyx_calls**: Call logs and recordings
- **phone_numbers**: Telnyx phone number management

### Relationship Tables
- **contact_assignments**: User-to-contact assignments
- **contact_tags**: Contact categorization
- **email_conversations**: Email thread management

## 🔧 Configuration

### Telnyx Setup
1. Create a Telnyx account and obtain API credentials
2. Purchase phone numbers for SMS/Voice
3. Configure webhook endpoints:
   - SMS: `https://yourdomain.com/api/telnyx/webhooks/messages`
   - Calls: `https://yourdomain.com/api/telnyx/webhooks/calls`

### Email Integration
1. Configure SMTP/IMAP settings in the Email Center
2. Supported providers: Gmail, domain emails, Outlook, etc.
3. Test connection before saving configuration

## 📱 Usage Guide

### Admin Dashboard
- **Overview**: System statistics and recent activities
- **Contacts**: Full contact management with advanced filtering
- **Text Center**: SMS conversations and bulk messaging
- **Email Center**: Email management and campaigns
- **Calls**: Call history and management
- **User Management**: Create and manage team members

### Team Dashboard
- **Activities**: Personal task and activity management
- **Messages**: Assigned contact conversations
- **Emails**: Email conversations for assigned contacts
- **Calls**: Call management for assigned phone numbers
- **Contacts**: View and manage assigned contacts

### Key Features Usage

#### Text Blasting
1. Navigate to Text Center → Text Blast
2. Select contacts using advanced filters
3. Choose or create message template
4. Set message delay and sender number
5. Monitor progress in real-time

#### Contact Management
1. Import contacts via CSV or add manually
2. Use advanced filters to segment contacts
3. Assign contacts to team members
4. Track all communications in contact timeline

#### Activity Management
1. Create tasks with due dates and priorities
2. Use filter buttons to view relevant activities
3. Click tasks to edit or mark complete
4. Automatic activity logging for calls and emails

## 🔐 Security Features

- **Authentication**: Secure login with NextAuth.js
- **Role-Based Access**: Admin and team member permissions
- **Data Encryption**: Secure storage of sensitive information
- **Webhook Validation**: Telnyx webhook signature verification
- **Session Management**: Secure session handling

## 🚀 Deployment

### Production Deployment
1. **Environment Variables**: Set all production environment variables
2. **Database**: Configure production PostgreSQL database
3. **Webhooks**: Update webhook URLs to production domain
4. **Build**: Run production build
   ```bash
   npm run build
   npm start
   ```

### Recommended Platforms
- **Vercel**: Seamless Next.js deployment
- **Railway**: Full-stack deployment with database
- **DigitalOcean**: VPS deployment with custom configuration

## 📊 API Documentation

### Core Endpoints

#### Authentication
- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout
- `GET /api/auth/session` - Get current session

#### Contacts
- `GET /api/contacts` - List contacts with filtering
- `POST /api/contacts` - Create new contact
- `PUT /api/contacts/[id]` - Update contact
- `DELETE /api/contacts/[id]` - Delete contact
- `POST /api/contacts/import` - Bulk import contacts

#### Messages
- `GET /api/conversations` - List conversations
- `GET /api/conversations/[id]/messages` - Get conversation messages
- `POST /api/messages/send` - Send SMS message
- `POST /api/telnyx/webhooks/messages` - Telnyx SMS webhook

#### Activities
- `GET /api/activities` - List activities
- `POST /api/activities` - Create activity
- `PUT /api/activities/[id]` - Update activity
- `DELETE /api/activities/[id]` - Delete activity

#### Team Management
- `GET /api/team/activities` - Team member activities
- `GET /api/team/conversations` - Team member conversations
- `POST /api/admin/assign-contacts` - Assign contacts to team members

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use Prettier for code formatting
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 🆘 Support & Troubleshooting

### Common Issues

#### Database Connection
```bash
# Reset database
npx prisma db push --force-reset

# Regenerate Prisma client
npx prisma generate
```

#### Telnyx Webhooks
- Ensure webhook URLs are publicly accessible
- Verify webhook signatures in production
- Check Telnyx dashboard for delivery status

#### Email Integration
- Verify SMTP/IMAP credentials
- Check firewall settings for email ports
- Test connection before saving configuration

### Getting Help
- Create an issue in the repository
- Check existing documentation
- Review API logs for debugging

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔄 Version History

- **v1.0.0**: Initial release with core CRM functionality
- **v1.1.0**: Added team dashboard and user management
- **v1.2.0**: Enhanced text blasting with templates and progress tracking
- **v1.3.0**: Email integration and conversation management
- **v1.4.0**: Advanced filtering and activity management improvements
- **v1.5.0**: Auto-scroll conversations and improved UX

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Telnyx](https://telnyx.com/) - Communication platform
- [Prisma](https://prisma.io/) - Database toolkit
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Shadcn/ui](https://ui.shadcn.com/) - UI components

---

Built with ❤️ using Next.js, TypeScript, and modern web technologies.

For questions or support, please create an issue or contact the development team.
