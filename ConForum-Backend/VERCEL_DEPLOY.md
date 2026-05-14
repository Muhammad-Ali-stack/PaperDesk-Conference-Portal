# Deploying ConForum to Vercel

This project has two services that each get deployed as a **separate Vercel project**:

1. **conforum-ieee-checker** — Python/Flask (deploy this first to get its URL)
2. **conforum-backend** — Node.js/Express

---

## Step 1 — Prerequisites

- A [Vercel account](https://vercel.com) (free tier works)
- Your code pushed to a GitHub repository

---

## Step 2 — Deploy the Flask IEEE Checker first

The Node backend needs the IEEE Checker URL, so deploy it first.

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Set **Root Directory** to `conforum-ieee-checker`
4. Vercel auto-detects `vercel.json` — no extra config needed
5. Click **Deploy**
6. Copy the deployed URL (e.g. `https://conforum-ieee-checker.vercel.app`)

---

## Step 3 — Deploy the Node.js Backend

1. Go to [vercel.com/new](https://vercel.com/new) again
2. Import the same repository
3. Set **Root Directory** to `conforum-backend`
4. Add the following **Environment Variables** in the Vercel dashboard:

| Variable           | Value                                                        |
|--------------------|--------------------------------------------------------------|
| `MONGO_URL`        | Your MongoDB Atlas connection string                         |
| `JWT_SECRET`       | A long random secret string                                  |
| `SUPABASE_URL`     | Your Supabase project URL                                    |
| `SUPABASE_API_KEY` | Your Supabase anon/service key                               |
| `GMAIL_USER`       | Your Gmail address                                           |
| `GMAIL_PASSWORD`   | Your Gmail App Password                                      |
| `IEEE_CHECKER_URL` | The URL from Step 2 (e.g. `https://conforum-ieee-checker.vercel.app`) |
| `BASE_URL`         | Your frontend URL (or leave blank if frontend isn't live yet)|

5. Click **Deploy**

---

## Step 4 — Test the deployment

```
GET https://your-backend.vercel.app/
# Should return: { "status": "success", "message": "ConForum API is running." }

GET https://your-ieee-checker.vercel.app/
# Should return: { "status": "ok", "service": "IEEE Compliance Checker" }
```

---

## Notes

- **Vercel is serverless** — clustering is disabled on Vercel automatically. Vercel handles scaling.
- **MongoDB**: Use [MongoDB Atlas](https://www.mongodb.com/atlas) for a free cloud database.
- **No spaces in folder names** — both folders are now named without spaces (`conforum-backend`, `conforum-ieee-checker`) so Vercel handles them correctly.
