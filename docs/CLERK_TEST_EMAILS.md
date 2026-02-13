# Using Clerk Test Emails in Development

## Problem
You've reached Clerk's monthly development email limit (100 emails). In development mode, Clerk limits the number of emails that can be sent to prevent abuse.

## Solution: Enable Test Emails

Clerk provides a **test email** feature that allows you to view emails in the dashboard instead of actually sending them. This is perfect for development and testing.

## How to Enable Test Emails

### Step 1: Access Clerk Dashboard
1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Sign in to your account
3. Select your application

### Step 2: Navigate to Email Settings
1. In the left sidebar, go to **Configure** → **Email & SMS**
2. Click on **Email** tab
3. Look for **Test Mode** or **Development Mode** settings

### Step 3: Enable Test Emails
1. Find the **"Use test emails"** or **"Development mode"** toggle
2. Enable test emails for your development instance
3. Save the changes

### Step 4: View Test Emails
Once enabled, all emails sent by your application will be captured as test emails. You can view them at:

**https://go.clerk.com/test-emails**

Or navigate to:
- **Configure** → **Email & SMS** → **Test Emails** in the Clerk Dashboard

## What Happens When Test Emails Are Enabled

✅ **Emails are NOT sent** to actual email addresses  
✅ **Emails are captured** and viewable in the Clerk Dashboard  
✅ **No email limit** - you can test as many times as needed  
✅ **All email types** are captured (invitations, verification, password reset, etc.)  
✅ **Full email content** is preserved for testing  

## Benefits

- **Unlimited testing** - No more hitting the 100 email limit
- **Faster development** - No need to check real email inboxes
- **Better debugging** - See exactly what emails are being sent
- **Cost-effective** - No email delivery costs in development

## Important Notes

⚠️ **Test emails only work in development mode** - Make sure you're using test keys (`pk_test_...` and `sk_test_...`)

⚠️ **Production emails are not affected** - When you deploy to production with production keys, real emails will be sent

⚠️ **Test emails expire** - Test emails in the dashboard may expire after a certain period

## Verifying Test Emails Are Working

1. Create an invitation or trigger an email action in your app
2. Check the console logs - you should see the invitation was created successfully
3. Go to [https://go.clerk.com/test-emails](https://go.clerk.com/test-emails)
4. You should see the email listed there with full content

## Alternative: Reset Email Limit

If you need to send real emails in development:
- Wait for the monthly limit to reset (at the start of each month)
- Upgrade to a paid Clerk plan for higher limits
- Use test emails instead (recommended for development)

## Related Files

- `server/utils/clerk.ts` - Clerk invitation creation logic
- `clerk-email-templates/` - Custom email templates
- `README.md` - General project documentation
