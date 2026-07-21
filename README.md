# PocketSafe 💰

Welcome to **PocketSafe**! This is a personal finance app designed to help you track expenses, split bills with friends, set actionable savings goals, and finally understand where your money actually goes. 

**Built by:** Santanu Panchadhyai (CS Student)  
**Live App:** [pocket-safe.pages.dev](https://pocket-safe.pages.dev)

I built this project to scratch my own itch when it came to managing money. It was also a fantastic learning experience collaborating with AI coding assistants while driving the architecture, prompts, and debugging myself. 

This README covers what the app does, how the data flows behind the scenes, and some of the real-world challenges I faced bringing it to life.

---

## 📖 Table of Contents

1. [What This App Does](#what-this-app-does)
2. [How the Data Flows](#how-the-data-flows)
3. [The Hard Parts (and How I Fixed Them)](#the-hard-parts-and-how-i-fixed-them)
4. [Running It Locally](#running-it-locally)
5. [Project Structure](#project-structure)
6. [Features](#features)
7. [Tech Stack](#tech-stack)

---

## 🎯 What This App Does

PocketSafe is split into four main features that all sync perfectly together:

- **Expense Ledger:** Log and categorize your daily spending.
- **Bill Splitter:** Easily split group expenses and figure out exactly who owes whom.
- **Savings Goals:** Set target amounts and track your progress toward buying that new gadget or booking a trip.
- **Reports:** Beautiful charts and graphs that visualize your habits based on everything above.

The secret sauce here? All four parts read from the *exact same* underlying data. There are no separate copies. It sounds like an obvious choice, but it's what saved me from a lot of painful bugs!

## 🔄 How the Data Flows

Ever wonder what happens when you log a coffee purchase? Here's the journey:

```text
USER INPUT (e.g., amount, category, or a group bill)
      │
      ▼
VALIDATION (Ensuring it's a valid number and category)
      │
      ▼
CENTRAL LEDGER STORE ──────────────┐
 (The single source of truth)      │
      │                            │
      │                     (If it's a group bill)
      │                            ▼
      │                   BILL SPLITTING ENGINE
      │                     1. Build a "who owes who" table
      │                     2. Reduce to net amounts
      │                     3. Settle with fewest payments
      │                     4. Write results back to the ledger
      │                            │
      ▼                            ▼
      └────────────────┬───────────┘
                       ▼
             SAVED TO FIRESTORE
                       │
             (Triggers a real-time update)
                       ▼
             DASHBOARD RE-RENDERS 
  (Charts and goals instantly update with fresh data!)
```

The two most important architectural decisions were: 
1. **Single Source of Truth:** Data is written in only one place.
2. **Reactive UI:** Every chart actively listens for changes instead of loading data once and requiring a manual refresh.

## 🧗 The Hard Parts (and How I Fixed Them)

Building PocketSafe wasn't just about telling an AI what to do and getting perfect code back. Some of the toughest challenges were architectural and operational. Here's a look at what actually gave me trouble:

### 1. Picking the Right Database
I debated for a while on what to use for storage. I wanted real-time updates (so the app feels instant) without having to manage my own server, plus a decent free tier. I landed on **Firestore** because it plugs directly into Firebase Auth and Hosting. The real-time listeners meant I didn't have to build my own refresh logic. Getting the data structured well in a NoSQL database took some trial and error since I was so used to relational tables!

### 2. Deploying the Frontend
The app is a Vite + React project hosted on **Cloudflare Pages**. Getting the build settings right took a few failed deploys. Cloudflare needs the exact build command (`npm run build`) and output directory (`dist`). Environment variables were another hurdle: I had to carefully mirror my local `.env` variables (like Firebase keys) into Cloudflare's dashboard before the live site could connect to the backend.

### 3. Deploying the Backend
The backend runs on **Firebase**. Setting up the project, configuring Firestore security rules (so people only see their own data), and keeping environment configs in sync between dev and production was a learning curve. I definitely broke things a few times by testing against production data! 

### 4. Nailing the PWA Experience
Making a web app feel like a native mobile app took surprising effort. Getting the manifest, icons, and install prompts right was one thing, but making the UI feel responsive across all screens was another. Fixing tiny spacing issues, adjusting touch targets, and refining interactions took a lot of iteration to make it feel premium.

### 5. Designing the Logo
Not a coding problem, but it took time! Creating an icon that looks clean on a home screen (at 48px) and still captures what the app does took several iterations.

### 6. The AI Learning Curve
Having AI tools write code didn't mean I could check out. I still had to deeply understand Firestore's data model, Firebase security rules, and PWA structures to guide the AI effectively. If anything, it forced me to get *better* at reading and reviewing code quickly. You can't review what you don't understand!

---

## 🚀 Running It Locally

Want to tinker with the code? You'll need **Node.js 18+** and **npm 9+**.

```bash
# Clone the repo
git clone https://github.com/Santanu-SP/Pocket-Safe.git
cd Pocket-Safe

# Install dependencies
npm install

# Set up your environment file
cp .env.example .env
```

Next, open `.env` and add your Firebase project config (found in the Firebase console under Project Settings):

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```
*(Make sure `.env` is in your `.gitignore`!)*

### Useful Commands:
- **Start dev server:** `npm run dev`
- **Check code quality:** `npm run lint`
- **Build for production:** `npm run build`

## 📁 Project Structure

A clean, modern Vite + React layout with dedicated separation between the React UI components and the runtime business logic:

```text
Pocket-Safe/
│
├── public/               # Static assets & runtime script
│   ├── app.js            # Core application state & Firestore business logic
│   ├── assets/           # App branding & logo assets (logo.png)
│   ├── favicon.svg       # Favicon icon
│   ├── icons.svg         # App icon SVG definitions
│   └── manifest.json     # Progressive Web App (PWA) manifest
│
├── src/                  # React Application UI Layer
│   ├── components/       # Sub-components (e.g. SplashScreen)
│   ├── App.css           # Layout utility styles
│   ├── App.jsx           # Main application shell & tab views
│   ├── index.css         # Global design system, CSS variables & dark mode
│   └── main.jsx          # React application entry point
│
├── index.html            # Single page HTML entry point (Firebase SDK compat scripts)
├── LICENSE               # MIT License
├── package.json          # Project dependencies & npm scripts
├── vite.config.js        # Vite configuration & plugin setup
└── README.md             # Project overview & documentation
```

## ✨ Features

**Getting Started:**
- Quick sign-up with Email or Google.
- Set your preferred currency and monthly income baseline.

**Core Tools:**
- Log expenses with categories, payment methods, and notes.
- Set up recurring expenses (never forget to log rent again).
- Search and filter your transaction history.
- Split bills equally, by percentage, or by exact items.
- Set savings goals with target dates and pacing alerts.
- Visualize spending with monthly cash flow, category breakdowns, and long-term trends.

**Account Management:**
- Secure session management.
- Export your data as a CSV.
- Manage friends/roommates for quick bill splitting.
- Toggle between beautiful Dark and Light modes.

## 🛠️ Tech Stack

- **Frontend:** React 19 + Vite, Tailwind CSS 4, Framer Motion
- **Backend & Database:** Firebase (Cloud Functions) & Firestore
- **Hosting:** Cloudflare Pages (Frontend) / Firebase (Backend)
- **Linting:** oxlint

---
*© 2026 PocketSafe*
