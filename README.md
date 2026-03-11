# Attendance Tracker (ATT)

A web application for college students to track their class attendance, analyse trends, and plan bunks smartly — all in one place.

## Features

- **Dashboard** — Overview of attendance stats across all subjects
- **Subject Management** — Add, edit, and organise subjects/courses
- **Mark Attendance** — Log daily attendance as present, absent, or class not happened
- **Attendance History** — Browse and filter past attendance records
- **Bunk Calculator** — Find out how many classes you can safely skip while staying above your target percentage
- **Analytics** — Visual charts and insights powered by Recharts
- **Profile & Settings** — Set target attendance %, college name, and preferences
- **Notifications** — In-app notification center with email alerts via EmailJS
- **Authentication** — Secure sign-up / login with Supabase Auth

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, React Router 7 |
| Styling | Tailwind CSS 4 |
| Backend / DB | Supabase (PostgreSQL + Auth + Row-Level Security) |
| Charts | Recharts |
| Email | EmailJS |
| Build Tool | Vite 7 |
| Language | JavaScript (JSX) + TypeScript config |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- A [Supabase](https://supabase.com/) project

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd ATT
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the project root with the following keys:

```env
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### 4. Set up the database

Open the Supabase SQL Editor and run the contents of [`supabase/schema.sql`](supabase/schema.sql) to create the required tables, indexes, and triggers.

### 5. Start the dev server

```bash
npm run dev
```

The app will be available at `http://localhost:5173` by default.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check with TSC and build for production |
| `npm run preview` | Preview the production build locally |

## Project Structure

```
src/
├── components/        # Reusable UI components (Navbar, ProtectedRoute, etc.)
├── context/           # React context providers (Auth, Toast, Notification)
├── hooks/             # Custom React hooks
├── lib/               # Third-party client setup (Supabase)
├── pages/             # Route-level page components
└── services/          # API helpers and email service
supabase/
└── schema.sql         # Database schema for Supabase
```

## License

This project is for educational / personal use.
