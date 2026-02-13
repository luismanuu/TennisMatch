# Tennis Match Platform

A platform for amateur tennis players in Ecuador to track matches, ELO ratings, and tournaments.

## Tech Stack

- **Nuxt 3** - Vue.js framework
- **TypeScript** - Type safety
- **Clerk** - Authentication
- **Supabase** - Database
- **Nuxt UI** - UI component library

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Clerk account (for authentication)
- Supabase account (for database)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Create a `.env` file in the root directory with the required variables.
   - Recommended: copy `.env.example` to `.env` and fill in the values.
   - See `docs/CONFIGURATION.md` for details.

```env
# Clerk Authentication
NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
NUXT_CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Or use the alternative naming:
# CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
# CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

3. Get your Clerk keys:
   - Sign up at [clerk.com](https://clerk.com)
   - Create a new application
   - Copy your Publishable Key and Secret Key from the dashboard

4. Get your Supabase keys:
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project
   - Go to Settings > API
   - Copy your Project URL, anon/public key, and service_role key

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Build

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```
TennisMatch/
├── composables/          # Reusable composables (useClerk, useSupabase)
├── middleware/          # Route middleware (auth protection)
├── pages/               # Application pages
│   ├── index.vue       # Home page
│   ├── sign-in/        # Sign in page
│   └── sign-up/        # Sign up page
├── types/              # TypeScript type definitions
└── server/             # Server-side code (API routes)
```

## Features

### Current Implementation

- ✅ User authentication with Clerk (sign up, sign in, sign out)
- ✅ Protected routes with middleware
- ✅ Supabase connection setup
- ✅ TypeScript support
- ✅ Nuxt UI components

### Coming Soon

- User profile management
- Match registration
- ELO rating system
- Tournament brackets
- Player statistics

## Authentication

The application uses Clerk for authentication. Users can:

- Sign up with email/password or social providers (configured in Clerk dashboard)
- Sign in to their account
- Access protected routes (automatically redirected to sign-in if not authenticated)

### Development Email Limits

⚠️ **Important**: Clerk limits development instances to 100 emails per month. If you hit this limit:

1. **Enable Test Emails** (Recommended):
   - Go to Clerk Dashboard → **Configure** → **Email & SMS** → Enable test emails
   - View test emails at [https://go.clerk.com/test-emails](https://go.clerk.com/test-emails)
   - See `docs/CLERK_TEST_EMAILS.md` for detailed instructions

2. **Benefits of Test Emails**:
   - Unlimited testing (no email limit)
   - View emails in dashboard without sending
   - Faster development workflow
   - Better debugging capabilities

## Database

Supabase is used as the database. The connection is configured and ready for:

- Player profiles
- Match records
- Tournament data
- ELO ratings

## License

MIT

