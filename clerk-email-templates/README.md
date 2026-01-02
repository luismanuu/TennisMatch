# Clerk Email Templates

This directory contains custom email templates for Clerk invitations using Clerk's template syntax.

## How to Use

1. **Go to Clerk Dashboard:**
   - Navigate to **Configure** → **Email & SMS** → **Email Templates**

2. **Customize Invitation Email:**
   - Find the "User invitation" template
   - Click "Edit" or "Customize"
   - Replace the default template with the content from `invitation-email-clerk.html`
   - Save the template

3. **Available Variables:**
   - `{{name}}` - The invited user's name
   - `{{emailAddress}}` - The invited user's email
   - `{{action_url}}` - The invitation acceptance URL (automatically provided by Clerk)
   - `{{invitation.expires_in_days}}` - Number of days until invitation expires
   - `{{app.name}}` - Your app name (if configured)
   - `{{inviter_name}}` - Name of person who sent invitation (if available)

4. **Preview:**
   - Use Clerk's preview feature to see how the email will look
   - Test with a real invitation to ensure everything works

## Template Features

- ✅ Professional, modern design with Tenis Ecuador branding
- ✅ Mobile-responsive (Clerk's template system handles this)
- ✅ Branded with green accent colors (#22c55e)
- ✅ Clear call-to-action button
- ✅ Alternative text link for accessibility
- ✅ Expiry notice with dynamic days
- ✅ Spanish language to match your app
- ✅ Tennis emoji (🎾) for visual branding
- ✅ Information box showing user details

## Files

- `invitation-email-clerk.html` - **Use this one!** Clerk template syntax version
- `invitation-email.html` - Standard HTML version (for reference only)

## Notes

- The template uses Clerk's `<re-*>` tag system for maximum compatibility
- Colors match your app's design system (green accent colors)
- The template is in Spanish to match your app's language
- All Clerk variables are automatically replaced when the email is sent
- The template includes proper spacing and styling for better email client support

