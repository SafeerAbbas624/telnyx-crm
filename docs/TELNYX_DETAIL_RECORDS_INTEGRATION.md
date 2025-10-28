# Telnyx Detail Records API Integration

## 🎯 Overview

This document describes the integration with Telnyx's **Detail Records API** to fetch exact call and SMS costs. This is more reliable than waiting for webhook cost data, which may not always be sent.

---

## 📊 Problem Statement

### **Issue**:
- ✅ **SMS costs** are received in webhooks (working)
- ❌ **Call costs** are NOT consistently received in webhooks
- 🔧 **Current workaround**: Using fallback rate of $0.015/min (estimated, not accurate)

### **Solution**:
Use Telnyx's **Detail Records API** to fetch exact costs after calls/SMS complete.

---

## 🏗️ Architecture

### **How It Works**:

```
┌─────────────────┐
│  Call Ends      │
│  (webhook)      │
└────────┬────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌────────────────────┐              ┌──────────────────────┐
│ Create Billing     │              │ Schedule Background  │
│ with Estimated     │              │ Job (30s delay)      │
│ Cost (fallback)    │              │                      │
└────────────────────┘              └──────────┬───────────┘
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │ Fetch Cost from      │
                                    │ Detail Records API   │
                                    │ (5s + retries)       │
                                    └──────────┬───────────┘
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │ Update Call & Billing│
                                    │ with Accurate Cost   │
                                    └──────────────────────┘
```

### **Components**:

1. **`lib/telnyx-detail-records.ts`** - API client for Detail Records
2. **`lib/jobs/fetch-call-cost.ts`** - Background job processor
3. **`app/api/billing/fetch-call-cost/route.ts`** - Manual trigger endpoint
4. **`app/api/cron/process-call-costs/route.ts`** - Cron job endpoint
5. **Updated webhook handler** - Triggers cost fetch after call ends

---

## 📁 File Structure

```
lib/
├── telnyx-detail-records.ts       # Detail Records API client
└── jobs/
    └── fetch-call-cost.ts         # Background job processor

app/api/
├── billing/
│   └── fetch-call-cost/
│       └── route.ts               # Manual trigger endpoint
├── cron/
│   └── process-call-costs/
│       └── route.ts               # Cron job endpoint
└── telnyx/webhooks/calls/
    └── route.ts                   # Updated webhook handler
```

---

## 🔧 Implementation Details

### **1. Detail Records API Client**

**File**: `lib/telnyx-detail-records.ts`

**Functions**:
- `fetchCallDetailRecord(callControlId)` - Fetch call cost by call_leg_id
- `fetchMessageDetailRecord(messageUuid)` - Fetch SMS cost by UUID
- `fetchDetailRecordsByDateRange(start, end)` - Fetch records for date range

**Example Usage**:
```typescript
import { fetchCallDetailRecord } from '@/lib/telnyx-detail-records'

const result = await fetchCallDetailRecord('call_control_id_here')
console.log(result.cost) // 0.0180
console.log(result.currency) // USD
console.log(result.billedSeconds) // 120
```

---

### **2. Background Job Processor**

**File**: `lib/jobs/fetch-call-cost.ts`

**Functions**:
- `fetchAndUpdateCallCost(callControlId)` - Fetch and update single call
- `processCallCostFetchJobs()` - Process all pending jobs

**Features**:
- ✅ Fetches cost from Detail Records API
- ✅ Updates `telnyx_calls` table with accurate cost
- ✅ Updates `telnyx_billing` table (replaces estimated cost)
- ✅ Updates `telnyx_phone_numbers.totalCost` (adjusts for difference)
- ✅ Retries with exponential backoff (up to 5 attempts)
- ✅ Marks jobs as completed/failed

---

### **3. Webhook Integration**

**File**: `app/api/telnyx/webhooks/calls/route.ts`

**Changes**:
1. Imports `fetchAndUpdateCallCost` function
2. After call hangup:
   - Creates estimated billing record (fallback)
   - Schedules background job for 30 seconds later
   - **NEW**: Triggers immediate cost fetch after 5 seconds

**Code**:
```typescript
// After call ends, fetch cost from Detail Records API
setTimeout(async () => {
  try {
    await fetchAndUpdateCallCost(data.call_control_id)
  } catch (error) {
    console.error('Error fetching cost:', error)
  }
}, 5000) // Wait 5 seconds
```

---

### **4. Manual Trigger Endpoint**

**Endpoint**: `POST /api/billing/fetch-call-cost`

**Request**:
```json
{
  "callControlId": "v3:abc123..."
}
```

**Response** (Success):
```json
{
  "success": true,
  "callId": "v3:abc123...",
  "cost": 0.0180,
  "message": "Call cost updated successfully"
}
```

**Response** (Retry Needed):
```json
{
  "success": false,
  "callId": "v3:abc123...",
  "error": "Cost not found in detail records",
  "shouldRetry": true
}
```

---

### **5. Cron Job Endpoint**

**Endpoint**: `GET /api/cron/process-call-costs`

**Purpose**: Process pending call cost fetch jobs

**Authentication**: Optional `CRON_SECRET` environment variable

**Response**:
```json
{
  "success": true,
  "processed": 10,
  "succeeded": 8,
  "failed": 1,
  "retried": 1,
  "timestamp": "2025-10-17T12:00:00.000Z"
}
```

---

## 🚀 Deployment

### **1. Build and Deploy**:
```bash
npm run build
pm2 restart nextjs-crm
```

### **2. Test Manual Trigger**:
```bash
# Get a recent call ID
CALL_ID=$(PGPASSWORD='Cupidsehrish06245*' psql -h localhost -U crm_user -d nextjs_crm -t -c "SELECT telnyx_call_id FROM telnyx_calls ORDER BY created_at DESC LIMIT 1;")

# Trigger cost fetch
curl -X POST http://localhost:3000/api/billing/fetch-call-cost \
  -H "Content-Type: application/json" \
  -d "{\"callControlId\": \"$CALL_ID\"}"
```

### **3. Test Cron Endpoint**:
```bash
curl http://localhost:3000/api/cron/process-call-costs
```

---

## ⏰ Setting Up Cron Job

### **Option 1: System Cron** (Recommended)

Add to crontab:
```bash
# Run every minute
* * * * * curl -s http://localhost:3000/api/cron/process-call-costs >> /var/log/call-cost-cron.log 2>&1
```

### **Option 2: PM2 Cron**

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'nextjs-crm',
      script: 'npm',
      args: 'start',
      // ... other config
    },
    {
      name: 'call-cost-cron',
      script: 'curl',
      args: 'http://localhost:3000/api/cron/process-call-costs',
      cron_restart: '* * * * *', // Every minute
      autorestart: false,
    }
  ]
}
```

### **Option 3: External Cron Service**

Use services like:
- **Cron-job.org**
- **EasyCron**
- **Vercel Cron** (if deployed on Vercel)

---

## 🧪 Testing

### **Test 1: Make a Test Call**
```bash
# Make a call through your system
# Wait 10 seconds
# Check if cost was fetched
```

### **Test 2: Check Database**
```sql
-- Check recent calls with costs
SELECT 
  telnyx_call_id,
  from_number,
  to_number,
  duration,
  cost,
  created_at
FROM telnyx_calls
ORDER BY created_at DESC
LIMIT 10;

-- Check billing records
SELECT 
  phone_number,
  record_type,
  cost,
  description,
  metadata->>'source' as source,
  billing_date
FROM telnyx_billing
WHERE record_type = 'call'
ORDER BY billing_date DESC
LIMIT 10;
```

### **Test 3: Check Background Jobs**
```sql
-- Check pending jobs
SELECT 
  telnyx_call_id,
  status,
  attempts,
  next_run_at,
  last_error
FROM telnyx_cdr_reconcile_jobs
WHERE status = 'pending'
ORDER BY next_run_at ASC;

-- Check completed jobs
SELECT 
  telnyx_call_id,
  status,
  attempts,
  completed_at
FROM telnyx_cdr_reconcile_jobs
WHERE status = 'completed'
ORDER BY completed_at DESC
LIMIT 10;
```

---

## 📊 Expected Results

### **Before** (Estimated Cost):
```json
{
  "cost": 0.0150,
  "description": "Call to +1234567890 (60s) [estimated @ 0.015/min]",
  "metadata": {
    "estimated": true,
    "ratePerMin": 0.015,
    "source": "fallback"
  }
}
```

### **After** (Accurate Cost from Detail Records):
```json
{
  "cost": 0.0180,
  "description": "Call to +1234567890 (60s)",
  "metadata": {
    "source": "detail_records_api",
    "rate": 0.009,
    "billedSeconds": 120,
    "callSeconds": 60,
    "fetchedAt": "2025-10-17T12:00:00.000Z"
  }
}
```

---

## 🔍 Monitoring

### **Check Logs**:
```bash
# PM2 logs
pm2 logs nextjs-crm --lines 100

# Filter for cost fetch logs
pm2 logs nextjs-crm | grep "FETCH CALL COST"

# Filter for Detail Records API logs
pm2 logs nextjs-crm | grep "TELNYX DETAIL RECORDS"
```

### **Key Log Messages**:
- `[FETCH CALL COST] Starting for call:` - Job started
- `[TELNYX DETAIL RECORDS] Found cost:` - Cost found in API
- `[FETCH CALL COST] Updated existing billing record:` - Cost updated
- `[CRON] Call cost fetch jobs processed:` - Cron job completed

---

## 🐛 Troubleshooting

### **Issue 1: Cost Not Found**
**Symptom**: `Cost not found in detail records`

**Causes**:
- Telnyx hasn't processed the call yet (takes 30-60 seconds)
- Call was not billable
- API key doesn't have access to detail records

**Solution**:
- Wait and let retry mechanism handle it
- Check if call appears in Telnyx Portal
- Verify API key permissions

---

### **Issue 2: Jobs Not Processing**
**Symptom**: Jobs stuck in `pending` status

**Causes**:
- Cron job not running
- API errors

**Solution**:
```bash
# Manually trigger cron
curl http://localhost:3000/api/cron/process-call-costs

# Check job status
psql -h localhost -U crm_user -d nextjs_crm -c "SELECT * FROM telnyx_cdr_reconcile_jobs WHERE status = 'pending';"
```

---

### **Issue 3: Duplicate Costs**
**Symptom**: Cost charged twice

**Causes**:
- Both webhook and Detail Records API created billing records

**Solution**:
- Code already handles this by checking for existing billing records
- If duplicates exist, run cleanup script

---

## 📈 Performance

### **Timing**:
- **Immediate fetch**: 5 seconds after call ends
- **Scheduled job**: 30 seconds after call ends
- **Retry intervals**: 1min, 2min, 4min, 8min, 16min

### **API Rate Limits**:
- Telnyx Detail Records API: No documented limit
- Recommended: Process max 10 jobs per minute

---

## 🎉 Summary

### **✅ Benefits**:
1. **Accurate costs** from Telnyx Detail Records API
2. **Automatic fetching** after each call
3. **Retry mechanism** with exponential backoff
4. **Replaces estimated costs** with accurate data
5. **Works for both calls and SMS**

### **📋 Next Steps**:
1. ✅ Deploy code changes
2. ✅ Set up cron job
3. ✅ Make test call
4. ✅ Verify cost is fetched
5. ✅ Monitor logs

---

**Last Updated**: October 17, 2025  
**Status**: ✅ Ready for Production

