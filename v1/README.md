# Anonymous 1-on-1 Chat Platform (MVP)

A real-time anonymous chat platform that connects strangers for 1-on-1 conversations using Supabase and Socket.io.

## Features

- 🔐 **Google Authentication** via Supabase Auth
- 👤 **Anonymous Privacy** - Only display names are shared, never emails or real names
- 🎲 **Random Matchmaking** - Instantly paired with available users
- 💬 **Real-time Chat** - Powered by Socket.io
- ⏭️ **Skip/Next** - Find a new conversation partner anytime
- ✏️ **Custom Display Names** - Set your own anonymous identity

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Database & Auth**: Supabase (PostgreSQL)

## Project Structure

```
v1/
├── frontend/          # React application
│   ├── src/
│   │   ├── lib/
│   │   │   └── supabase.js
│   │   ├── App.jsx
│   │   └── index.css
│   └── .env.example
└── backend/           # Socket.io server
    ├── index.js
    ├── schema.sql
    └── .env.example
```

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- A Supabase account and project
- Google OAuth credentials configured in Supabase

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Authentication > Providers** and enable Google OAuth
3. Configure Google OAuth:
   - Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com)
   - Add authorized redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase
4. Run the SQL schema in **SQL Editor**:

```sql
-- Copy contents from backend/schema.sql
```

5. Get your project credentials:
   - Project URL: `https://<your-project-ref>.supabase.co`
   - Anon/Public Key: Found in Settings > API
   - Service Role Key: Found in Settings > API (keep this secret!)

### 2. Backend Setup

```bash
cd v1/backend

# Copy environment template
cp .env.example .env

# Edit .env with your Supabase credentials
# PORT=3001
# SUPABASE_URL=your_supabase_project_url
# SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Install dependencies (already done if you followed initial setup)
npm install

# Start the server
npm start
```

The backend will run on `http://localhost:3001`

### 3. Frontend Setup

```bash
cd v1/frontend

# Copy environment template
cp .env.example .env

# Edit .env with your Supabase credentials
# VITE_SUPABASE_URL=your_supabase_project_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# VITE_SOCKET_URL=http://localhost:3001

# Install dependencies (already done if you followed initial setup)
npm install

# Start the development server
npm run dev
```

The frontend will run on `http://localhost:5173`

### 4. Testing the Application

1. Open `http://localhost:5173` in your browser
2. Click "Sign in with Google"
3. After authentication, you'll be redirected back to the app
4. Set your display name (optional)
5. Click "Find Match" to enter the queue
6. Open another browser/incognito window and repeat steps 2-5
7. You should be matched and able to chat!
8. Click "Next" to skip and find a new partner

## How It Works

### Authentication Flow

1. User clicks "Sign in with Google"
2. Supabase handles OAuth flow and creates a user record
3. A database trigger automatically creates a profile with default display name
4. User can update their display name anytime

### Matchmaking Flow

1. User clicks "Find Match"
2. Socket.io authenticates the user and adds them to the waiting queue
3. When 2+ users are in queue, they're paired into a private room
4. Both users receive the partner's display name (anonymous)
5. Real-time messages are exchanged via Socket.io events

### Skip/Next Flow

1. User clicks "Next" button
2. Current room is cleaned up
3. Partner is notified and returned to idle state
4. User re-enters the queue to find a new match

## API Endpoints

### Backend (Socket.io Events)

- `authenticate` - Authenticate user with userId and displayName
- `find_match` - Enter the matchmaking queue
- `send_message` - Send a message in current room
- `next` - Skip current partner and find new match
- `matched` - Emitted when paired with a partner
- `receive_message` - Emitted when receiving a message
- `partner_left` - Emitted when partner disconnects or skips

### REST Endpoint

- `GET /health` - Check server status and queue size

## Database Schema

### profiles table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, references auth.users |
| display_name | TEXT | User's anonymous display name |
| created_at | TIMESTAMP | Profile creation time |
| updated_at | TIMESTAMP | Last update time |

## Security & Privacy

- ✅ Only display names are shared between users
- ✅ Email addresses and real names are never exposed
- ✅ Row Level Security (RLS) enabled on profiles table
- ✅ Users can only read/update their own profile
- ✅ Service role key kept server-side only

## Development Notes

- The Tailwind CSS warnings in the IDE are expected - they're processed correctly by PostCSS
- Make sure both frontend and backend are running simultaneously
- Use different browsers or incognito mode to test matchmaking with yourself

## Future Enhancements

- [ ] Add typing indicators
- [ ] Add message timestamps
- [ ] Add user online status
- [ ] Add chat history (optional)
- [ ] Add report/block functionality
- [ ] Add interest-based matching
- [ ] Add video/voice chat support

## License

MIT
