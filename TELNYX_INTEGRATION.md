# Telnyx Integration Guide

This document provides a comprehensive guide for setting up and using the Telnyx integration in your CRM system.

## Overview

The CRM now includes full Telnyx integration for:
- **SMS Messaging**: Send and receive SMS messages
- **Voice Calls**: Make and receive phone calls
- **Phone Number Management**: Manage your Telnyx phone numbers
- **Billing & Analytics**: Track usage and costs
- **Real-time Webhooks**: Receive status updates in real-time

## Setup Instructions

### 1. Telnyx Account Setup

1. **Create a Telnyx Account**: Sign up at [telnyx.com](https://telnyx.com)
2. **Get API Key**: 
   - Go to API Keys in your Telnyx dashboard
   - Create a new API key with full permissions
   - Copy the API key (starts with `KEY...`)

3. **Create a Connection**:
   - Go to Connections in your Telnyx dashboard
   - Create a new connection (choose "Messaging" and "Voice")
   - Note the Connection ID

4. **Purchase Phone Numbers**:
   - Go to Numbers → Search & Buy
   - Purchase numbers with SMS and Voice capabilities
   - Note the phone numbers you purchased

### 2. Environment Configuration

Update your `.env` file with your Telnyx credentials:

```env
# Telnyx Configuration
TELNYX_API_KEY="KEY01983C1204B0980CA0A15E10A6EBA7C0"  # Your actual API key
TELNYX_CONNECTION_ID="your_connection_id_here"          # Your connection ID

# Application URL (for webhooks)
NEXT_PUBLIC_APP_URL="http://localhost:3001"  # For development
# NEXT_PUBLIC_APP_URL="https://yourdomain.com"  # For production
```

**Important**: Your API key is already configured. You need to:
1. Create a Connection in your Telnyx dashboard
2. Copy the Connection ID and update `TELNYX_CONNECTION_ID`

### 3. Webhook Configuration

In your Telnyx dashboard, configure webhooks:

1. **SMS Webhooks** (Messaging Profile):
   - Primary URL: `{YOUR_APP_URL}/api/telnyx/webhooks/sms`
   - Failover URL: `{YOUR_APP_URL}/api/telnyx/webhooks/sms-failover`
   - Events: `message.sent`, `message.delivered`, `message.delivery_failed`, `message.received`, `message.finalized`
   - Method: POST

2. **Call Webhooks** (Connection):
   - URL: `{YOUR_APP_URL}/api/telnyx/webhooks/calls`
   - Events: `call.initiated`, `call.ringing`, `call.answered`, `call.bridged`, `call.hangup`, `call.recording.saved`, `call.machine.detection.ended`
   - Method: POST
   - Timeout: 10 seconds

3. **Webhook Security**:
   - All webhooks include `Telnyx-Signature-Ed25519` header for verification
   - Implement signature verification for production use

## Features

### 1. Phone Number Management

**Location**: Text Center → Text Blast Tab → Sender Phone Numbers

- **Add Numbers**: Click "Add Telnyx Phone Number"
- **State Tracking**: Associate numbers with states for organization
- **Usage Stats**: View SMS and call counts per number
- **Remove Numbers**: Delete numbers you no longer need

### 2. SMS Messaging

**Location**: Text Center → Text Blast Tab

- **Bulk SMS**: Send messages to multiple contacts
- **Template Support**: Use contact variables like `{firstName}`, `{lastName}`
- **Number Rotation**: Automatically rotate between available numbers
- **Real-time Status**: Track delivery status via webhooks
- **Cost Tracking**: Monitor SMS costs per message

### 3. Voice Calls

**Location**: Calls Tab (new)

- **Contact-based Calling**: Select contacts and call directly
- **Number Selection**: Choose which Telnyx number to call from
- **Call History**: View all call records with duration and cost
- **Call Recording**: Automatic recording with playback
- **Real-time Status**: Live call status updates

### 4. Billing & Analytics

**Location**: Billing Tab (new)

- **Cost Tracking**: View all SMS and call costs
- **Filtering**: Filter by phone number, date range, record type
- **Export Reports**: Download CSV reports
- **Usage Analytics**: See breakdown by SMS vs calls
- **Number-wise Reports**: Costs per phone number

## API Endpoints

### Phone Numbers
- `GET /api/telnyx/phone-numbers` - List all numbers
- `POST /api/telnyx/phone-numbers` - Add new number
- `DELETE /api/telnyx/phone-numbers/[id]` - Remove number

### SMS
- `POST /api/telnyx/sms/send` - Send SMS message
- `POST /api/telnyx/webhooks/sms` - SMS webhook handler

### Calls
- `GET /api/telnyx/calls` - List call history
- `POST /api/telnyx/calls` - Initiate call
- `POST /api/telnyx/webhooks/calls` - Call webhook handler

### Billing
- `GET /api/telnyx/billing` - Get billing records
- `POST /api/telnyx/billing` - Export billing data

## Database Schema

New tables added for Telnyx integration:

- **telnyx_phone_numbers**: Store your Telnyx phone numbers
- **telnyx_messages**: Track all SMS messages
- **telnyx_calls**: Store call records
- **telnyx_billing**: Track all costs and usage

## Usage Examples

### Sending SMS
```javascript
const response = await fetch('/api/telnyx/sms/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fromNumber: '+1234567890',
    toNumber: '+0987654321',
    message: 'Hello from your CRM!',
    contactId: 'contact-uuid'
  })
});
```

### Making Calls
```javascript
const response = await fetch('/api/telnyx/calls', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fromNumber: '+1234567890',
    toNumber: '+0987654321',
    contactId: 'contact-uuid'
  })
});
```

## Troubleshooting

### Common Issues

1. **API Key Issues**:
   - Ensure API key starts with `KEY`
   - Check API key permissions in Telnyx dashboard

2. **Webhook Issues**:
   - Verify webhook URLs are accessible
   - Check webhook event subscriptions
   - Use ngrok for local development

3. **Phone Number Issues**:
   - Ensure numbers are purchased and active
   - Check number capabilities (SMS/Voice)
   - Verify connection ID is correct

### Testing Webhooks Locally

For local development, use ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3001

# Use the ngrok URL in Telnyx webhooks
# Example: https://abc123.ngrok.io/api/telnyx/webhooks/sms
```

## Production Deployment

1. **Environment Variables**: Set production values
2. **Webhook URLs**: Update to production domain
3. **SSL Certificate**: Ensure HTTPS for webhooks
4. **Database**: Run migrations in production
5. **Monitoring**: Set up logging and error tracking

## Support

For Telnyx-specific issues:
- [Telnyx Documentation](https://developers.telnyx.com/)
- [Telnyx Support](https://telnyx.com/support)

For CRM integration issues:
- Check application logs
- Verify database connections
- Test API endpoints individually
