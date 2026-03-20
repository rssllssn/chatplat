# Environment Variables

## Vercel (Frontend)

Add these in your Vercel project dashboard under **Settings > Environment Variables**:

| Variable | Value | Where to find it |
|----------|-------|-------------------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase Dashboard > Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (long JWT string) | Supabase Dashboard > Settings > API > anon/public key |

**That's it.** Only 2 environment variables needed. No backend server required.

## Local Development

For local development, copy the `.env.example` file:

```bash
cd v1/frontend
cp .env.example .env
```

Then fill in your values in `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Supabase Setup Checklist

Before deploying, make sure you've done these in your Supabase project:

1. **Run the SQL schema** — Copy `supabase_schema.sql` into **SQL Editor** and run it
2. **Enable Google OAuth** — Go to **Authentication > Providers > Google** and add your Google Client ID + Secret
3. **Enable Realtime** — The schema SQL already does this, but verify under **Database > Replication** that `rooms` and `messages` tables have Realtime enabled
4. **Add your site URL** — Go to **Authentication > URL Configuration** and add:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app`
5. **Update Google OAuth redirect URI** — In Google Cloud Console, add:
   - `https://your-project.supabase.co/auth/v1/callback`

done!
