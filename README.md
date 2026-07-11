# PocketSafe

A personal finance app for tracking expenses, splitting bills with friends, setting savings goals, and seeing where your money actually goes.

**Built by:** Santanu Panchadhyai — CS student
**Live app:** [pocket-safe.pages.dev](https://pocket-safe.pages.dev)

I built this using AI coding tools (Antigravity, Gemini, OpenAI Codex) as my implementation help, while I handled the architecture, the prompts, and all the debugging decisions myself. This README walks through what the app does, how it's structured, and some of the harder problems I ran into while building it.

---

## Table of Contents

1. [What This App Does](#what-this-app-does)
2. [How the Data Flows](#how-the-data-flows)
3. [Problems I Ran Into (and How I Fixed Them)](#problems-i-ran-into-and-how-i-fixed-them)
4. [Running It Locally](#running-it-locally)
5. [Project Structure](#project-structure)
6. [Features](#features)
7. [Tech Stack](#tech-stack)

---

## What This App Does

PocketSafe has four main parts that all work off the same data:

- **Expense Ledger** — log and categorize your spending
- **Bill Splitter** — split group expenses and figure out who owes who
- **Savings Goals** — set a target and track progress toward it
- **Reports** — charts and graphs based on everything above

The important design decision here was making all four parts read from the *same* underlying data instead of keeping separate copies. That sounds obvious, but it's actually the thing that caused most of my bugs early on (more on that below).

## How the Data Flows

Here's roughly what happens when you add a transaction, from typing it in to seeing it show up in a chart:

```
USER INPUT
  (amount, category, payment method, or a group bill)
        │
        ▼
VALIDATION
  (check the amount is a real number, category is picked,
   nothing required is missing)
        │
        ▼
CENTRAL LEDGER STORE  ──────────────┐
  (this is the one and only         │
   place transaction data lives)    │
        │                           │
        │                    (if it's a group bill)
        │                           ▼
        │                  BILL SPLITTING ENGINE
        │                    1. build a table of who owes who
        │                    2. reduce it down to net amounts
        │                    3. settle with the fewest payments
        │                    4. write the result back to the ledger
        │                           │
        ▼                           ▼
        └───────────────┬───────────┘
                         ▼
              SAVED TO FIRESTORE
                         │
              (this triggers an update signal)
                         ▼
              DASHBOARD RE-RENDERS
    (cash flow chart, category pie chart, savings graph
     all pull fresh data automatically — no refresh needed)
```

The two decisions that mattered most: (1) there's only one place data gets written, and (2) every chart listens for changes instead of loading data once and forgetting about it.

## Problems I Ran Into (and How I Fixed Them)

Building this wasn't just "describe the feature, get working code" from the AI tools. Some of the hardest parts had nothing to do with writing code at all. Here's what actually gave me trouble.

### 1. Picking a database

I went back and forth for a while on what to actually use for storage. I needed something that could handle real-time updates (so balances and charts feel instant), didn't need me to manage my own server, and had a free tier that wouldn't fall apart the moment I had more than a couple of test users. I looked at a few options before landing on **Firestore**, mainly because it plugs directly into Firebase's auth and hosting, and the real-time listeners meant I didn't have to build my own polling or refresh logic on top of it. Getting the data structured well in a NoSQL, document-based database took some trial and error, since I was used to thinking in tables, not collections.

### 2. Deploying the frontend

The frontend is a Vite + React app, and it's live on **Cloudflare Pages** at pocket-safe.pages.dev. Getting the build settings right took a couple of failed deploys — Cloudflare needs the correct build command (`npm run build`) and output directory (`dist`) set in the project dashboard, and I had a mismatch there early on that left me staring at a broken build with no obvious error. Environment variables were another catch: values in my local `.env` don't automatically carry over, so I had to mirror the Firebase config into Cloudflare's own environment variable settings before the live site could actually connect to the backend.

### 3. Deploying the backend

The backend runs on **Firebase**. Getting this actually live was its own thing separate from writing the backend logic itself — setting up the Firebase project, configuring Firestore security rules so people could only read and write their own data, and making sure environment config was correct between my local setup and the deployed version. I broke things more than once by testing against production data instead of a local/dev environment, which taught me to be a lot more careful about separating the two.

### 4. Getting the PWA UI right

Making the app feel like an actual app instead of a website in a browser tab took more effort than I expected. Getting the manifest, icons, and install behavior working consistently, plus making the UI itself feel responsive and native across different screen sizes, was a lot of small fixes rather than one big problem — spacing that looked fine on desktop but cramped on mobile, touch targets that were too small, that kind of thing. It's the kind of struggle that doesn't show up as a single bug you can point to, just a lot of iteration until it stopped feeling like a webpage.

### 5. Making the logo

This one's not code at all, but it took real time. Getting an icon that looked clean at small sizes (like a home-screen icon) and still felt like it represented what the app does took several rounds of trying things, scrapping them, and trying again. Small details — like how a mark looks at 48px versus 512px — matter a lot more than I expected going in.

### 6. Managing AI credits across models and editors

Since I was using AI tools (Antigravity, Gemini, OpenAI Codex) as my coding help throughout, staying within budget was a real, ongoing part of the process — not just a side detail. Different models and editors have different credit costs and different strengths, so I'd often switch between them depending on what I was doing: one for scaffolding a new feature, a cheaper one for small fixes, another for reviewing code. That meant I had to keep re-explaining context every time I switched tools, since none of them shared memory with each other, and I had to be deliberate about which tasks were worth spending credits on versus which ones I could just do myself.

### 7. The learning curve, even with AI doing a lot of the typing

Having AI tools write a lot of the code didn't mean I could skip understanding it. I still had to learn how Firestore's data model actually works, how Firebase security rules are written, how PWAs are structured, and how to debug a deployment issue that only shows up in production and not locally. If anything, using AI tools meant I had to get *better* at reading and understanding code quickly, since my job was reviewing and directing rather than just typing — and you can't review what you don't understand.

---

## Running It Locally

You'll need Node.js 18 or newer and npm 9 or newer.

```bash
# clone the repo
git clone https://github.com/Santanu-SP/Pocket-Safe.git
cd Pocket-Safe

# install dependencies
npm install

# set up your environment file
cp .env.example .env
```

Then open `.env` and add your own Firebase project config (you'll get these values from the Firebase console under Project Settings):

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Don't commit `.env` — make sure it's in `.gitignore`.

To start the dev server:

```bash
npm run dev
```

To check code quality:

```bash
npm run lint
```

To build for production:

```bash
npm run build      # builds the production bundle to dist/
```

The frontend deploys to **Cloudflare Pages** (build command `npm run build`, output directory `dist`) at [pocket-safe.pages.dev](https://pocket-safe.pages.dev). The backend and database run separately on Firebase (Cloud Functions + Firestore), managed through the Firebase console/CLI.

> Note: the repo's `package.json` still has a `gh-pages` deploy script left over from an earlier setup — it isn't the current deployment path, Cloudflare Pages is.

## Project Structure

Standard Vite + React layout, with Firebase config kept separate from the UI code:

```
Pocket-Safe/
│
├── src/
│   ├── assets/           # icons, logo, images
│   ├── components/       # ledger, splitter, goals, reports, shared UI
│   ├── pages/             # main screens
│   ├── firebase/          # Firebase init + Firestore helpers
│   ├── App.jsx
│   └── main.jsx
│
├── public/
├── .env.example
├── .gitignore
├── package.json
├── vite.config.js
└── README.md
```

(The backend — Cloud Functions and Firestore rules — lives on Firebase, managed through the Firebase CLI/console rather than as part of this frontend repo. The frontend itself deploys to Cloudflare Pages.)

## Features

**Getting started**
- Sign up with email or Google
- Set your currency and monthly income baseline
- Optional: skip linking any accounts and just track manually

**Core stuff**
- Log expenses with category, payment method, and notes
- Set up recurring expenses so you don't have to log rent every month
- Search and filter your transactions
- Split bills equally, by percentage, or by exact item
- Set savings goals with a target date and get pacing alerts
- See your spending as monthly cash flow, a category breakdown, and long-term trends

**Account**
- 2FA, session management
- Export your data as CSV
- Manage friends/roommates for quick splitting
- Dark and light mode

## Tech Stack

- **Frontend:** React 19 + Vite, styled with Tailwind CSS 4, animations with Framer Motion
- **Linting:** oxlint
- **Backend:** Firebase (Cloud Functions)
- **Database:** Firestore
- **Frontend hosting:** Cloudflare Pages
- **Backend hosting:** Firebase
- **AI tools used during development:** Antigravity, Gemini, OpenAI Codex — used as coding help, directed and reviewed by me throughout, switched between depending on the task and to manage credit usage

---

© 2026 PocketSafe
