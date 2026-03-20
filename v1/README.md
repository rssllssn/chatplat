# Anonymous 1-on-1 Chat Platform (MVP)

A real-time anonymous chat platform that connects strangers for 1-on-1 conversations. Fully hosted on **Vercel + Supabase** — no backend server needed.

## Features

- **Google Authentication** via Supabase Auth
- **Anonymous Privacy** — Only display names are shared, never emails or real names
- **Random Matchmaking** — Paired with available users via Supabase RPC
- **Real-time Chat** — Powered by Supabase Realtime (Postgres Changes)
- **Skip/Next** — Find a new conversation partner anytime
- **Custom Display Names** — Set your own anonymous identity

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS (hosted on Vercel)
- **Database, Auth & Realtime**: Supabase (PostgreSQL)

## Project Structure

```
v1/
├── frontend/              # React application (deployed to Vercel)
│   ├── src/
│   │   ├── lib/
│   │   │   └── supabase.js
│   │   ├── App.jsx
│   │   └── index.css
│   └── .env.example
├── supabase_schema.sql    # Run this in Supabase SQL Editor
├── vercel.json            # Vercel deployment config
└── ENV_VARIABLES.md       # Required environment variables
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase_schema.sql`
3. Go to **Authentication > Providers** and enable Google:
   - Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com)
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Paste Client ID + Secret into Supabase
4. Go to **Authentication > URL Configuration**:
   - Set Site URL to your Vercel domain (e.g. `https://your-app.vercel.app`)
   - Add your Vercel domain to Redirect URLs

### 2. Vercel Deployment

1. Push this repo to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Set **Root Directory** to `v1` (or use the `vercel.json` at v1 root)
4. Add environment variables (see `ENV_VARIABLES.md`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy

### 3. Local Development

```bash
cd v1/frontend
cp .env.example .env
# Fill in your Supabase credentials in .env
npm install
npm run dev
```

## How It Works

### Authentication
1. User clicks "Sign in with Google"
2. Supabase handles OAuth and creates a user record
3. A DB trigger auto-creates a profile with a default display name

### Matchmaking
1. User clicks "Find Match" → inserted into `queue` table
2. Client calls `find_match` RPC which atomically pairs two waiting users into a `rooms` row
3. Both users subscribe to Supabase Realtime on their room for partner updates
4. If the other user finds the match first, a Realtime listener on `rooms` notifies the waiting user

### Chat
1. Messages are inserted into `messages` table
2. Both users subscribe to Realtime INSERT events on their room's messages
3. Only the partner's display name is visible — no emails or real names

### Skip/Next
1. Room status is set to `ended`
2. Partner is notified via Realtime subscription
3. User automatically re-enters the queue

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User display names (RLS protected) |
| `queue` | Matchmaking waiting list |
| `rooms` | Active/ended chat rooms between paired users |
| `messages` | Chat messages in rooms |

## Security

- Row Level Security (RLS) on all tables
- Only display names shared between users
- No service role key needed client-side
- Users can only access their own rooms and messages

## License

MIT
