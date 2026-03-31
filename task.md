# CMS Editor Feature Implementation

## Phase 0 — Authentication
- [ ] Backend: `handlers/auth.js` (login + me)
- [ ] Backend: `lib/authMiddleware.js` (JWT verify)
- [ ] Backend: `server.js` — add auth routes + wrap all routes with middleware
- [ ] Backend: install `jsonwebtoken`, `bcryptjs` packages
- [ ] Frontend: restore `Login` route + `ProtectedRoute` in `App.jsx`
- [ ] Frontend: `api.js` — 401 interceptor
- [ ] Frontend: `Navbar.jsx` — logout → redirect to /login

## Phase 1 — Staged Articles
- [ ] Backend: `handlers/stagedArticles.js` (list, get, delete, review)
- [ ] Backend: `server.js` routes
- [ ] Frontend: `pages/StagedArticles.jsx`

## Phase 2 — Events
- [ ] Backend: `handlers/events.js` (list, create, update, delete)
- [ ] Backend: `server.js` routes
- [ ] Backend: upload — `getPublicUploadUrl`
- [ ] Frontend: `pages/EventsManager.jsx`

## Phase 3 — Social Trends
- [ ] Backend: `handlers/socialTrends.js` (list, create, update, delete, toggle)
- [ ] Backend: `server.js` routes
- [ ] Frontend: `pages/SocialTrendsManager.jsx`

## Phase 4 — Experts
- [ ] Backend: `handlers/experts.js` (list, create, update, delete, toggle)
- [ ] Backend: `server.js` routes
- [ ] Frontend: `pages/ExpertsManager.jsx`

## Phase 5 — Media
- [ ] Backend: install `@ffmpeg-installer/ffmpeg`, `fluent-ffmpeg`
- [ ] Backend: `handlers/media.js` (list, create, update, delete)
- [ ] Backend: `handlers/videoUpload.js` (HLS segmentation pipeline)
- [ ] Backend: `server.js` routes
- [ ] Frontend: `pages/MediaManager.jsx`

## Phase 6 — Analytical Articles
- [ ] Backend: `handlers/analyticalArticles.js` (list, get, create, update, delete)
- [ ] Backend: `server.js` routes
- [ ] Frontend: `pages/AnalyticalManager.jsx`

## Phase 7 — CMS Users
- [ ] Backend: `handlers/users.js` (list, create, update, resetPassword, delete)
- [ ] Backend: `server.js` routes
- [ ] Frontend: `pages/UsersManager.jsx`

## Phase 8 — Airlines
- [ ] Backend: `handlers/airlines.js` (list, create, update, delete)
- [ ] Backend: `server.js` routes
- [ ] Frontend: `pages/AirlinesManager.jsx`

## Phase 9 — Flight Reviews
- [ ] Backend: `handlers/flightReviews.js` (list, read-only)
- [ ] Backend: `server.js` routes
- [ ] Frontend: `pages/FlightReviewsPanel.jsx`

## Phase 10 — Frontend Nav + Routing
- [ ] `App.jsx` — add all new routes, nest under ProtectedRoute
- [ ] `Navbar.jsx` — convert to sidebar nav
- [ ] `styles/Managers.css` — shared manager styles
- [ ] `services/api.js` — service helpers for all resources
- [ ] `services/s3.js` — `uploadPublicFile()`, `uploadVideoFile()`
