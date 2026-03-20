# Deployment Guide

## 🚀 Deploy to Production

### Frontend (Vercel)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repo
   - Select the `frontend` folder
   - Add environment variables:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your_anon_key
     VITE_SOCKET_URL=https://your-backend-url.com
     ```
   - Click "Deploy"

### Backend Options

Since Vercel doesn't support persistent connections (Socket.io), choose one of these:

#### Option 1: Railway (Recommended)
```bash
# Deploy backend to Railway
# 1. Go to railway.app
# 2. Connect GitHub repo
# 3. Select backend folder
# 4. Add environment variables:
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

#### Option 2: Render
```bash
# Deploy backend to Render
# 1. Go to render.com
# 2. Connect GitHub repo
# 3. Select backend folder
# 4. Add environment variables (same as above)
```

#### Option 3: Fly.io
```bash
# Deploy backend to Fly.io
# 1. Install fly CLI
# 2. fly launch
# 3. Set environment variables
# 4. fly deploy
```

## 📋 Environment Variables

### Frontend (Vercel)
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
- `VITE_SOCKET_URL` - Your deployed backend URL

### Backend (Railway/Render)
- `PORT` - Server port (usually 3001)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key

## 🔄 Update CORS

After deploying, update the CORS settings in `backend/index.js`:

```javascript
cors: {
  origin: [
    'http://localhost:5173',           // Local development
    'https://your-frontend-domain.vercel.app'  // Production
  ],
  methods: ['GET', 'POST'],
  credentials: true
}
```

## ✅ Verification

1. **Frontend**: Visit your Vercel URL
2. **Backend**: Visit `https://your-backend-url.com/health`
3. **Test**: Sign in and try matchmaking

## 🛠️ Troubleshooting

**Socket.io connection issues:**
- Check backend URL in frontend environment variables
- Verify CORS includes your frontend domain
- Ensure backend is running 24/7

**Authentication issues:**
- Verify Supabase URL and keys are correct
- Check Google OAuth redirect URI in Supabase
- Ensure frontend URL is added to Supabase auth settings

**Build errors:**
- Check Node.js version (requires 18+)
- Verify all dependencies are installed
- Check environment variable names (VITE_ prefix for frontend)
