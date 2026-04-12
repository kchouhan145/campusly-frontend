# Campusly Frontend

Campusly is a role-aware campus community frontend built with React + Vite. It provides a unified interface for authentication, announcements, events, chat, lost and found, marketplace listings, profile management, and admin user operations.

## Tech Stack

- React 19
- Vite 8
- React Router 7
- Tailwind CSS 4
- Socket.IO Client
- ESLint 9

## Core Features

- Authentication flow with login, signup, and OTP verification on the home page.
- Role-aware UI for `student`, `teacher`, and `admin` users.
- Real-time dashboard updates via Socket.IO.
- Department and direct messaging UI.
- Events listing and creation workflow.
- Lost and found post management.
- Marketplace listing, filtering, and item status updates.
- Profile page with editable fields and generated avatars.
- Admin user panel for role/status updates and user management.

## App Routes

- `/` - Home, auth, and dashboard
- `/chat` - Chat and people discovery
- `/events` - Campus events
- `/lostfound` - Lost and found posts
- `/marketplace` - Product marketplace
- `/profile` - User profile
- `/admin` - Admin users panel (admin role only)

## Prerequisites

- Node.js 18+
- npm 9+

## Environment Variables

Create a `.env` file in the project root and add:

```env
VITE_API_BASE_URL=http://localhost:5000
```

This value should point to the Campusly backend base URL.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

The app runs on Vite's default dev server and is exposed with `--host`.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Project Structure

```text
src/
	components/
		navbar.jsx
	pages/
		adminUsers.jsx
		chat.jsx
		events.jsx
		home.jsx
		lostfound.jsx
		marketplace.jsx
		profile.jsx
	App.jsx
	main.jsx
```

## Notes

- Authentication token is stored in local storage as `campuslyToken`.
- User role is stored in local storage as `campuslyUserRole`.
- Admin navigation appears only when the role is `admin`.
