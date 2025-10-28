# Enable Telnyx Call Cost Webhook

This guide will help you enable the "Call Cost" webhook in your Telnyx account so that accurate call pricing data is automatically sent to your CRM.

## Why Enable This?

Currently, your CRM is using **estimated** call costs based on a fallback rate ($0.015/min). Enabling the Call Cost webhook will provide:

- ✅ **Accurate pricing** from Telnyx (varies by destination)
- ✅ **Real-time cost data** after each call ends
- ✅ **Detailed billing** with exact carrier fees and rates
- ✅ **Better financial reporting** and analytics

---

## Step-by-Step Instructions

### 1. Log into Telnyx Portal

Go to: **https://portal.telnyx.com**

Use your Telnyx account credentials to log in.

---

### 2. Navigate to Call Control Applications

1. Click on **"Voice"** in the left sidebar
2. Click on **"Call Control Applications"**
3. You should see a list of your Call Control Applications

---

### 3. Find Your Application

Look for the application that has:
- **Webhook URL**: `https://adlercapitalcrm.com/api/telnyx/webhooks/calls`

This is the application your CRM is using.

---

### 4. Edit the Application

1. Click on the application name to open it
2. Scroll down to the **"Webhooks"** section
3. Look for a checkbox or toggle labeled **"Enable Call Cost"** or **"Send Call Cost Webhooks"**

---

### 5. Enable Call Cost

1. **Check the box** or **toggle ON** the "Enable Call Cost" option
2. This will send a `call.cost` webhook event after each call ends
3. Click **"Save"** or **"Update"** at the bottom of the page

---

### 6. Verify the Setting

After saving, you should see:
- ✅ "Enable Call Cost" is checked/enabled
- ✅ Your webhook URL is still: `https://adlercapitalcrm.com/api/telnyx/webhooks/calls`

---

### 7. Test with a Call

1. Make a test call from your CRM
2. After the call ends, check the Billing page
3. The call should now show an **accurate cost** from Telnyx (not the estimated $0.015/min)

---

## What Happens Next?

### For Future Calls:
- ✅ All new calls will automatically receive accurate cost data from Telnyx
- ✅ Costs will be stored in the database immediately after each call
- ✅ Billing page will show real-time accurate costs

### For Past Calls:
- ⚠️ The 24 existing calls have been backfilled with **estimated costs** ($0.66 total)
- ℹ️ These estimates are based on duration × $0.015/min
- ℹ️ Future calls will have accurate costs from Telnyx

---

## Troubleshooting

### "I don't see the Enable Call Cost option"

**Solution 1**: Check if you're using the correct application type
- The option is available for **Call Control Applications**
- Not available for legacy Voice API applications

**Solution 2**: Contact Telnyx Support
- Email: support@telnyx.com
- Chat: Available in the Telnyx Portal
- Ask them to enable "Call Cost webhooks" for your account

---

### "I enabled it but still not receiving cost data"

**Check 1**: Verify the webhook URL is correct
- Should be: `https://adlercapitalcrm.com/api/telnyx/webhooks/calls`
- Should be HTTPS (not HTTP)

**Check 2**: Check webhook logs in Telnyx Portal
- Go to your Call Control Application
- Look for "Webhook Logs" or "Recent Webhooks"
- Verify that `call.cost` events are being sent

**Check 3**: Check your CRM logs
- SSH into your server
- Run: `pm2 logs nextjs-crm`
- Look for `[TELNYX WEBHOOK][CALL]` messages
- You should see `call.cost` events

---

## Current Status

### ✅ Completed:
1. Added fallback rate to `.env` file: `TELNYX_VOICE_RATE_PER_MIN=0.015`
2. Backfilled 24 existing calls with estimated costs ($0.66 total)
3. Created billing records for all past calls
4. Billing page now shows both SMS and Call costs

### 📋 To Do:
1. **Enable "Call Cost" webhook in Telnyx Portal** (follow steps above)
2. Make a test call to verify accurate costs are received
3. Monitor billing page to confirm real-time cost updates

---

## Summary of Current Billing Data

| Type | Records | Total Cost |
|------|---------|------------|
| **SMS** | 809 | $5.81 |
| **Calls** | 24 | $0.66 (estimated) |
| **Total** | 833 | **$6.47** |

After enabling Call Cost webhook, future calls will show accurate costs instead of estimates.

---

## Need Help?

If you encounter any issues:

1. **Check Telnyx Documentation**: https://developers.telnyx.com/docs/voice
2. **Contact Telnyx Support**: support@telnyx.com
3. **Check CRM Logs**: `pm2 logs nextjs-crm`
4. **Review Webhook Handler**: `app/api/telnyx/webhooks/calls/route.ts` (line 394-462)

---

## Technical Details

### Webhook Event Structure

When enabled, Telnyx will send a `call.cost` event like this:

```json
{
  "event_type": "call.cost",
  "payload": {
    "call_control_id": "v3:abc123...",
    "cost": {
      "amount": "0.0180",
      "currency": "USD"
    }
  }
}
```

Your CRM automatically handles this event and:
1. Updates the `telnyx_calls` table with the cost
2. Creates a record in `telnyx_billing` table
3. Updates the phone number's total cost
4. Displays the cost on the Billing page

---

**Last Updated**: October 17, 2025

