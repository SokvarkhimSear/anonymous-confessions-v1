# Deployment Guide: Anonymous Confessions

This guide covers how to deploy the Anonymous Confessions app to two popular platforms: **Google Cloud Run** (for containerized hosting) and **Vercel via GitHub** (for optimized frontend hosting). 

*(Note: Assuming "verbal" in your request meant "Vercel", which is the industry standard platform for deploying GitHub-connected React/Vite apps).*

## Prerequisites
- Export your code from AI Studio (Settings -> Export to GitHub or Download ZIP).
- Ensure your Firebase project (`anonymous-confessions-e4b44`) has Firestore and Anonymous Authentication enabled.

---

## Option 1: Deploying to Google Cloud Run

Google Cloud Run is perfect if you want to run the included Express server (`server.ts`) in a scalable container.

### Step 1: Add a Start Script
First, ensure your `package.json` has a `start` script. Add this to the `"scripts"` section:
```json
"start": "NODE_ENV=production tsx server.ts"
```

### Step 2: Create a Dockerfile
Create a file named `Dockerfile` in the root of your project:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

### Step 3: Deploy using Google Cloud CLI
1. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install).
2. Authenticate and set your project in your terminal:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_GCP_PROJECT_ID
   ```
3. Deploy the app:
   ```bash
   gcloud run deploy anonymous-confessions --source . --port 3000 --allow-unauthenticated
   ```
4. Cloud Run will build your container and provide a live URL!

---

## Option 2: Deploying to Vercel via GitHub

Vercel is the easiest way to deploy a Vite/React Single Page Application. Since your backend logic relies entirely on Firebase (client-side), Vercel is highly recommended and offers a generous free tier.

### Step 1: Push to GitHub
1. Create a new repository on GitHub.
2. Initialize Git in your project folder, commit your files, and push them to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

### Step 2: Import to Vercel
1. Go to [Vercel.com](https://vercel.com/) and log in with your GitHub account.
2. Click **Add New...** > **Project**.
3. Import the GitHub repository you just created.

### Step 3: Configure Build Settings
Vercel will automatically detect that this is a Vite project. Ensure the settings are:
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

### Step 4: Deploy
1. Click **Deploy**.
2. Vercel will build your app and assign it a live URL (e.g., `https://anonymous-confessions.vercel.app`).
3. *Bonus:* Any future pushes to the `main` branch on GitHub will automatically trigger a new deployment on Vercel!

---

## ⚠️ Crucial Final Step: Firebase Authorized Domains

Whichever platform you choose, you **must** add the new live URL to your Firebase Authorized Domains so Authentication works:

1. Go to the [Firebase Console](https://console.firebase.google.com/project/anonymous-confessions-e4b44/authentication/settings).
2. Navigate to **Authentication** > **Settings** > **Authorized domains**.
3. Click **Add domain** and paste your new Cloud Run or Vercel domain (e.g., `anonymous-confessions.vercel.app` or your Cloud Run URL). Do not include `https://` or trailing slashes.
