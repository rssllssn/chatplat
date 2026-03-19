# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Supabase Configuration

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Navigate to **SQL Editor** and run the schema from `backend/schema.sql`
3. Go to **Authentication > Providers** and enable Google OAuth
4. Get your credentials from **Settings > API**

### Step 2: Environment Variables

**Backend** (`v1/backend/.env`):
```env
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

**Frontend** (`v1/frontend/.env`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_SOCKET_URL=http://localhost:3001
```

### Step 3: Start the Servers

**Terminal 1 - Backend:**
```bash
cd v1/backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd v1/frontend
npm run dev
```

### Step 4: Test It Out!

1. Open `http://localhost:5173`
2. Sign in with Google
3. Click "Find Match"
4. Open another browser (incognito) and repeat
5. Start chatting!

## 🎯 Key Features to Test

- ✅ Google Sign-in
- ✅ Display name editing
- ✅ Find Match button
- ✅ Real-time messaging
- ✅ Next/Skip button
- ✅ Partner disconnect handling

## 🐛 Troubleshooting

**Can't connect to backend?**
- Make sure backend is running on port 3001
- Check VITE_SOCKET_URL in frontend .env

**Authentication not working?**
- Verify Google OAuth is enabled in Supabase
- Check Supabase credentials in .env files
- Make sure redirect URL is configured in Google Console

**Not getting matched?**
- Need 2 users in queue to match
- Open incognito/different browser to test alone
- Check backend console for queue status

**Messages not sending?**
- Verify Socket.io connection in browser console
- Check backend logs for errors
- Ensure you're in a matched state

## 📝 Notes

- The Tailwind CSS warnings in the IDE are normal - they work correctly when the app runs
- Both frontend and backend must be running simultaneously
- Use `http://localhost:3001/health` to check backend status
