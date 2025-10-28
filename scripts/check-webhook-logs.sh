#!/bin/bash

# Telnyx Webhook Log Checker
# This script helps you verify if Telnyx is sending call cost data

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Telnyx Call Cost Webhook Checker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if PM2 is running
echo "1️⃣  Checking PM2 status..."
pm2 status nextjs-crm
echo ""

# Check recent webhook events
echo "2️⃣  Recent webhook events (last 50 lines)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 logs nextjs-crm --lines 50 --nostream | grep -E "TELNYX WEBHOOK|call\.(cost|hangup)" || echo "No webhook events found in recent logs"
echo ""

# Check database for recent calls
echo "3️⃣  Recent calls in database (last 5)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PGPASSWORD='Cupidsehrish06245*' psql -h localhost -U crm_user -d nextjs_crm -c "
SELECT 
  substring(id::text, 1, 8) as id,
  from_number,
  to_number,
  duration,
  CASE 
    WHEN cost IS NULL THEN 'NULL'
    ELSE '$' || cost::text
  END as cost,
  to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM telnyx_calls 
ORDER BY created_at DESC 
LIMIT 5;
"
echo ""

# Check billing records
echo "4️⃣  Recent billing records (last 5)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PGPASSWORD='Cupidsehrish06245*' psql -h localhost -U crm_user -d nextjs_crm -c "
SELECT 
  record_type,
  phone_number,
  '$' || cost::text as cost,
  substring(description, 1, 40) as description,
  to_char(billing_date, 'YYYY-MM-DD HH24:MI:SS') as billing_date
FROM telnyx_billing 
WHERE record_type = 'call'
ORDER BY billing_date DESC 
LIMIT 5;
"
echo ""

# Check for webhook data in recent calls
echo "5️⃣  Checking if webhook_data contains cost information..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PGPASSWORD='Cupidsehrish06245*' psql -h localhost -U crm_user -d nextjs_crm -c "
SELECT 
  substring(id::text, 1, 8) as id,
  from_number,
  to_number,
  CASE 
    WHEN webhook_data::text LIKE '%\"cost\"%' THEN '✅ Has cost data'
    WHEN webhook_data IS NULL THEN '❌ No webhook data'
    ELSE '⚠️  No cost in webhook'
  END as webhook_status,
  to_char(created_at, 'YYYY-MM-DD HH24:MI') as created_at
FROM telnyx_calls 
ORDER BY created_at DESC 
LIMIT 5;
"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count calls with cost
CALLS_WITH_COST=$(PGPASSWORD='Cupidsehrish06245*' psql -h localhost -U crm_user -d nextjs_crm -t -c "SELECT COUNT(*) FROM telnyx_calls WHERE cost IS NOT NULL;")
TOTAL_CALLS=$(PGPASSWORD='Cupidsehrish06245*' psql -h localhost -U crm_user -d nextjs_crm -t -c "SELECT COUNT(*) FROM telnyx_calls;")

echo "Total Calls: $TOTAL_CALLS"
echo "Calls with Cost: $CALLS_WITH_COST"
echo ""

if [ "$CALLS_WITH_COST" -eq "$TOTAL_CALLS" ] && [ "$TOTAL_CALLS" -gt 0 ]; then
  echo "✅ All calls have cost data!"
elif [ "$CALLS_WITH_COST" -gt 0 ]; then
  echo "⚠️  Some calls have cost data, some don't"
  echo "   This is normal if you recently enabled Call Cost webhook"
else
  echo "❌ No calls have cost data"
  echo "   Check if Call Cost webhook is enabled in Telnyx Portal"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Make a test call (30+ seconds)"
echo "2. Run this script again: bash scripts/check-webhook-logs.sh"
echo "3. Check if the new call has actual cost data"
echo ""
echo "To view real-time logs:"
echo "  pm2 logs nextjs-crm"
echo ""
echo "To check webhook data for a specific call:"
echo "  PGPASSWORD='Cupidsehrish06245*' psql -h localhost -U crm_user -d nextjs_crm -c \"SELECT webhook_data FROM telnyx_calls ORDER BY created_at DESC LIMIT 1;\""
echo ""

