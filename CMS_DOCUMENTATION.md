# Avionyz CMS Documentation

> **Purpose**: This document describes how the Avionyz website loads content, how the backend fetches and serves it, and exactly what a CMS must be able to do to manage the four target features: **Image Uploads**, **Events**, **Social Media Trends**, and **Expert of the Week**.

---

## Table of Contents

1. [Infrastructure Overview](#1-infrastructure-overview)
2. [Key URLs & Environment Variables](#2-key-urls--environment-variables)
3. [S3 Image Strategy](#3-s3-image-strategy)
4. [Backend — Active API Routes](#4-backend--active-api-routes)
5. [Frontend Data Flow](#5-frontend-data-flow)
6. [Database Models (Prisma Schema)](#6-database-models-prisma-schema)
7. [Feature: Image Uploads](#7-feature-image-uploads)
8. [Feature: Events](#8-feature-events)
9. [Feature: Social Media Trends](#9-feature-social-media-trends)
10. [Feature: Expert of the Week](#10-feature-expert-of-the-week)
11. [CMS Implementation Guide](#11-cms-implementation-guide)

---

## 1. Infrastructure Overview

```
Browser / React SPA
      |
      |  HTTP requests via Axios
      v
AWS API Gateway  ->  AWS Lambda (handler.js)  ->  Express server (server.js)
                                                        |
                              +-------------------------+
                              |                         |
                   PostgreSQL (RDS)              AWS S3 Storage
                   (Prisma ORM)          +--------------------------+
                                         | avionyz-storage          |
                                         |   (private / signed URL) |
                                         | avionyz-public-data      |
                                         |   (public / direct URL)  |
                                         +--------------------------+
```

- **Backend Runtime**: Node.js + Express, deployed as AWS Lambda via Serverless Framework
- **Database**: PostgreSQL on AWS RDS, accessed via Prisma ORM
- **Frontend**: React + Vite SPA, deployed on AWS CloudFront (CDN)
- **Auth**: AWS Cognito JWT tokens

---

## 2. Key URLs & Environment Variables

### Backend Variables (`Avionyz-backend/.env`)

| Variable | Value | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://...rds.amazonaws.com.../avionyz` | PostgreSQL connection string |
| `S3_BUCKET_NAME` | `avionyz-storage` | Private S3 bucket (article images, feed images) |
| `S3_PUBLIC_DATA` | `avionyz-public-data` | Public S3 bucket (events, experts, media) |
| `AWS_REGION` | `ap-south-1` | AWS region for all services |
| `COGNITO_USER_POOL_ID` | `ap-south-1_WLngA2Wtl` | Cognito user pool |
| `COGNITO_CLIENT_ID` | `38ioqpmjsras8locs9q6spi4sm` | Cognito app client |

### Frontend URLs

| Item | Value |
|---|---|
| **API Base URL (prod)** | `https://6elx1wdud5.execute-api.ap-south-1.amazonaws.com/api` |
| **API Base URL (local dev)** | `http://localhost:3000/api` |
| **Public S3 Base URL** | `https://avionyz-public-data.s3.ap-south-1.amazonaws.com/` |
| **Frontend CloudFront URL** | `https://d3pzwyp4bt0ugb.cloudfront.net` |

### Frontend Constant (hardcoded in `HomePage.jsx` and `EventPage.jsx`)

```js
const S3_BASE_URL = "https://avionyz-public-data.s3.ap-south-1.amazonaws.com/";
```

---

## 3. S3 Image Strategy

The project uses **two S3 buckets** with different access patterns.

### Public Bucket: `avionyz-public-data`

Used for: **Events, Experts, Media (videos/thumbnails)**

- Images are stored as a **relative S3 key** in the DB (e.g., `events/my-event.jpg`)
- Backend constructs the full URL at response time by prepending the base URL
- Frontend does the same independently via `getImageUrl()`
- **No expiry** — images are permanently accessible

**Backend constant** (used in `articles.js`, `media.js`, `experts.js`):
```js
const S3_PUBLIC = `https://${process.env.S3_PUBLIC_DATA}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
// resolves to: https://avionyz-public-data.s3.ap-south-1.amazonaws.com/
```

**Frontend helper** (in `HomePage.jsx` and `EventPage.jsx`):
```js
const S3_BASE_URL = "https://avionyz-public-data.s3.ap-south-1.amazonaws.com/";

const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;  // already a full URL
    return `${S3_BASE_URL}${imagePath}`;                 // prepend base
};
```

### Private Bucket: `avionyz-storage`

Used for: **Article main images, Article body images, Feed post images**

- Images stored as S3 keys (e.g., `articles/abc123.jpg`)
- Backend generates **presigned URLs** via `generateSignedUrl()` — expire in **2 hours**
- Frontend receives the signed URL directly; cannot build one itself

**S3 utility functions** (`Avionyz-backend/src/lib/s3.js`):

| Function | Purpose |
|---|---|
| `generateSignedUrl(key)` | Returns a 2-hour presigned GET URL for the private bucket |
| `uploadFile(key, body, contentType)` | Uploads a file to the private bucket |
| `checkFileExists(key)` | HeadObject check on private bucket |
| `getFileStream(key)` | Streams file from private bucket |

---

## 4. Backend — Active API Routes

All routes are mounted under `/api` in `server.js`.

### Route Mount Table (`server.js`)

| Router File | Mount Path | Examples |
|---|---|---|
| `articles.js` | `/api` | `/api/articles/home`, `/api/articles/:id` |
| `events.js` | `/api` | `/api/events` |
| `experts.js` | `/api/experts` | `/api/experts/latest` |
| `trending.js` | `/api/trending` | `/api/trending/twitter`, `/api/trending/linkedin` |
| `media.js` | `/api` | `/api/media`, `/api/media/stream` |
| `analyticalArticles.js` | `/api/analytical-articles` | `/api/analytical-articles/:id` |
| `auth.js` | `/api/auth` | Cognito login/register |
| `review.js` | `/api` | Flight reviews |
| `stock.js` | `/api` | Stock tags |
| `user.js` | `/api/user` | User profile |
| `comments.js` | `/api` | Article comments |
| `feed.js` | `/api/feed` | Community posts |

---

### 4.1 Articles (`src/routes/articles.js`)

#### `GET /api/articles/home`
**The single most important route — powers the entire homepage in one request.**

Returns one JSON object with every homepage section:

| Key | Type | Description |
|---|---|---|
| `news` | `ArticleCard[]` | Latest general news articles (max 7, trending-excluded) |
| `business` | `ArticleCard[]` | Latest business articles (max 6, trending-excluded) |
| `aerospace` | `ArticleCard[]` | Latest aerospace articles (max 5, trending-excluded) |
| `trending` | `ArticleCard[]` | Top 5 most-viewed articles from the past 2 weeks |
| `analytics` | `AnalyticsCard[]` | Latest 5 analytical/insight articles |
| `events` | `Event[]` | Next 6 upcoming events (date >= today, sorted soonest first) |
| `experts` | `Expert[]` | Up to 4 active experts (sorted newest first) |
| `videos` | `VideoCard[]` | Latest 4 video media items |
| `socialTrends` | `{ linkedin, twitter, youtube }` | Up to 10 active social trends per platform |
| `airlines` | `Airline[]` | All airlines (for the review form dropdown) |
| `randomPoll` | `{ airline, question }` | Random airline for feedback widget |

Cache: `Cache-Control: no-store` — always fresh on each page load.

**`ArticleCard` shape** (used everywhere articles appear as cards):
```json
{
  "id": "uuid",
  "title": "string",
  "timestampDate": "ISO8601 string",
  "mainImage": "presigned-s3-url (expires in 2hr)",
  "shortDescription": "string",
  "category": "string  <-- this is the article.type field"
}
```

**`Expert` shape** (inside this response):
```json
{
  "id": "uuid",
  "name": "string",
  "role": "string",
  "company": "string",
  "image": "https://avionyz-public-data.s3.ap-south-1.amazonaws.com/{s3-key}",
  "quote": "string",
  "highlight": "string",
  "url": "string or null",
  "isActive": true,
  "createdAt": "ISO8601"
}
```

**`Event` shape** (inside this response — image is full URL):
```json
{
  "id": "uuid",
  "eventName": "string",
  "eventLink": "string",
  "venue": "string",
  "date": "ISO8601",
  "image": "https://avionyz-public-data.s3.ap-south-1.amazonaws.com/{s3-key}",
  "region": "string",
  "freeOrPaid": "string",
  "onlineOrOffline": "string"
}
```

**`SocialTrend` shape** (inside `socialTrends.linkedin`, etc.):
```json
{
  "id": "uuid",
  "type": "linkedin | twitter | youtube",
  "label": "post title or content text",
  "subtext": "25k likes  OR  @authorName  OR  Trending",
  "url": "https://...",
  "image": "thumbnail url or null",
  "author": "string"
}
```

---

#### `GET /api/articles/paginated?types=news&skip=0&take=5`
Paginated article list for category pages.

| Param | Type | Notes |
|---|---|---|
| `types` | string | `news`, `business`, `breaking`, comma-separated for multiple |
| `skip` | number | Offset (default 0) |
| `take` | number | Page size (default 5) |

Returns: `{ articles: ArticleCard[], totalCount: number }`

---

#### `GET /api/articles/:id`
Full article detail. **Increments `views` counter on every call.**
Returns the full article including signed image URLs, `keyInsights[]`, `relatedNews[]`, `comments[]`.

---

#### `GET /api/articles/search?q=<query>`
Full-text search on `title`, `shortDescription`, `body`. Returns: `ArticleCard[]` (max 10)

---

#### `GET /api/articles/trending`
Top 5 articles from last 7 days by `timestampDate`. Returns: `ArticleCard[]`

---

#### `GET /api/articles/category-summary`
Returns grouped counts + preview for breaking/business/news.

---

#### `POST /api/articles/:id/comments` *(requires JWT auth)*
Body: `{ text: string }` — posts a comment on an article.

---

### 4.2 Events (`src/routes/events.js`)

#### `GET /api/events`
Powers the full `/events` page (the homepage gets events from `/articles/home` instead).

| Param | Type | Default | Description |
|---|---|---|---|
| `region` | string | — | `Asia`, `Gulf/Middle East`, `North America`, `South America`, `Europe`, `Africa`, `Oceania` |
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page |
| `status` | string | — | `upcoming` (date >= today) or `past` (date < today) |

Returns:
```json
{
  "events": [],
  "total": 42,
  "page": 1,
  "totalPages": 5
}
```

> **Important**: This route returns `image` as a **raw S3 key** (e.g., `events/foo.jpg`), NOT a full URL. The frontend's `getImageUrl()` function prepends the base URL. The `/articles/home` route does prepend the URL server-side — so both patterns are in use.

---

### 4.3 Experts (`src/routes/experts.js`)

#### `GET /api/experts/latest`
Returns 4 most recently created experts where `isActive = true`.
The `image` field is converted to a full public S3 URL server-side before responding.

---

### 4.4 Social Trends (`src/routes/trending.js`)

Three separate endpoints, all backed by the same DB helper:

#### `GET /api/trending/linkedin`
#### `GET /api/trending/twitter`
#### `GET /api/trending/youtube`

All return `SocialTrend[]` (max 10, most recent first, `isActive = true` only).

DB field → Response field mapping:
| DB Column | Response Field | Notes |
|---|---|---|
| `platform` | `type` | |
| `content` | `label` | The post title/text shown on the card |
| `likes` or `author` | `subtext` | Prefers likes string if set |
| `url` | `url` | Link to source post |
| `imageUrl` | `image` | Optional thumbnail |
| `author` | `author` | |

---

### 4.5 Media (`src/routes/media.js`)

#### `GET /api/media?page=1&limit=10&type=video`
Returns paginated media. `url` and `thumbnail` fields get public S3 base URL prepended if they aren't already full URLs.

Returns: `{ media: MediaItem[], pagination: { totalCount, currentPage, totalPages } }`

#### `GET /api/media/stream?key=<m3u8-key>`
HLS video streaming. Rewrites the `.m3u8` playlist so all `.ts` chunk URLs are presigned.

#### `GET /api/media/download?key=<url-or-key>`
Proxy download — forces browser download instead of inline display.

#### `POST /api/upload` — **Currently DISABLED (returns 403)**

---

### 4.6 Analytical Articles (`src/routes/analyticalArticles.js`)

| Endpoint | Description |
|---|---|
| `GET /api/analytical-articles` | All insight articles |
| `GET /api/analytical-articles/latest` | Most recent insight article |
| `GET /api/analytical-articles/:id` | Full article + `dataUrl` for chart data |
| `GET /api/analytical-articles/:id/data` | Streams the raw JSON data file |

---

## 5. Frontend Data Flow

### 5.1 Axios API Client (`src/lib/api.js`)

```js
const api = axios.create({
    baseURL: 'https://6elx1wdud5.execute-api.ap-south-1.amazonaws.com/api'
});
// Interceptor: auto-injects JWT from localStorage
//   Authorization: Bearer <token>
```

### 5.2 Service Functions (`src/services/`)

| File | Function | HTTP Call |
|---|---|---|
| `articleService.js` | `getHomeData()` | `GET /articles/home` |
| `articleService.js` | `getPaginatedArticles({types, skip, take})` | `GET /articles/paginated` |
| `articleService.js` | `getArticleById(id)` | `GET /articles/:id` |
| `articleService.js` | `searchArticles(query)` | `GET /articles/search?q=...` |
| `articleService.js` | `getAllAnalyticalArticles()` | `GET /analytical-articles` |
| `articleService.js` | `getAnalyticalArticleById(id)` | `GET /analytical-articles/:id` |
| `eventService.js` | `getEvents({region, page, limit, status})` | `GET /events` |
| `homeService.js` | `getLatestExpert()` | `GET /experts/latest` *(legacy, unused by homepage)* |
| `homeService.js` | `getSocialTrends(platform)` | `GET /trending/:platform` *(legacy, unused by homepage)* |
| `mediaService.js` | `getMedia({page, limit, type})` | `GET /media` |

### 5.3 DataContext — Global State (`src/context/DataContext.jsx`)

`DataProvider` wraps the entire app. On first mount it fires **4 parallel requests**:

```js
await Promise.all([
  getHomeData(),                                               // /api/articles/home
  getPaginatedArticles({ types: 'breaking', skip: 0, take: 9 }), // category page pre-fetch
  getPaginatedArticles({ types: 'business', skip: 0, take: 8 }),
  getPaginatedArticles({ types: 'news',     skip: 0, take: 8 }),
]);
```

**What components read via `useData()`**:

| Context Key | Data Source | Consumed By |
|---|---|---|
| `articles.news` | `/articles/home` → `news` | HomePage hero + Top Stories |
| `articles.business` | `/articles/home` → `business` | HomePage business grid |
| `articles.aerospace` | `/articles/home` → `aerospace` | HomePage aerospace carousel |
| `articles.trending` | `/articles/home` → `trending` | HomePage trending sidebar |
| `articles.analytics` | `/articles/home` → `analytics` | HomePage insights section |
| `articles.events` | `/articles/home` → `events` | HomePage events grid |
| `articles.experts` | `/articles/home` → `experts` | `<ExpertWidget>` carousel |
| `articles.videos` | `/articles/home` → `videos` | HomePage video grid |
| `articles.socialTrends` | `/articles/home` → `socialTrends` | HomePage social trends widget |
| `homeVideos` | alias of `articles.videos` | HomePage |
| `socialTrends` | alias of `articles.socialTrends` | HomePage |
| `breakingArticles` | `/articles/paginated?types=breaking` | CategoryPage |
| `summaryBusiness` | `/articles/paginated?types=business` | CategoryPage |
| `summaryRecentNews` | `/articles/paginated?types=news` | CategoryPage |

### 5.4 Frontend Routes (`src/main.jsx`)

| URL | Component | Backend Dependency |
|---|---|---|
| `/` | `HomePage` | DataContext (pre-fetched) |
| `/events` | `EventPage` | `GET /api/events` (on mount) |
| `/article/:id` | `ArticlePage` | `GET /api/articles/:id` |
| `/news/:category` | `CategoryPage` | `GET /api/articles/paginated` |
| `/articles` | `PaginatedArticlePage` | `GET /api/articles/paginated` |
| `/insights` | `PaginatedAnalyticArticlePage` | `GET /api/analytical-articles` |
| `/analytic-page/:id` | `AnalyticPage` | `GET /api/analytical-articles/:id` |
| `/media` | `MediaPage` | `GET /api/media` |
| `/auth` | `AuthPage` | Cognito |
| `/dashboard` | `DashboardPage` | User-specific |

---

## 6. Database Models (Prisma Schema)

### 6.1 `Event` → table `events`

| Field | Type | CMS Notes |
|---|---|---|
| `id` | `String (uuid)` | Auto-generated PK |
| `eventName` | `String` | Display title |
| `eventLink` | `String` | Registration/info URL |
| `venue` | `String` | Venue name |
| `onlineOrOffline` | `String` | `"Online"` or `"Offline"` |
| `freeOrPaid` | `String` | `"Free"` or `"Paid"` |
| `date` | `DateTime` | Controls upcoming/past filter |
| `time` | `String` | Display time (e.g. `"9:00 AM GST"`) |
| `eventType` | `String` | e.g. `"Conference"`, `"Webinar"` |
| `region` | `String` | Must match filter values below |
| `image` | `String` | **S3 key in `avionyz-public-data`** |
| `lat` | `Float` | Latitude for map |
| `lng` | `Float` | Longitude for map |
| `country` | `String` | Country name |
| `description` | `String?` | Optional description |
| `organizedBy` | `String?` | Organizer name |
| `images` | `String[]` | Additional gallery image S3 keys |

**Valid `region` values** (must match exactly):
`Asia`, `Gulf/Middle East`, `North America`, `South America`, `Europe`, `Africa`, `Oceania`

---

### 6.2 `Expert` → table `experts`

| Field | Type | CMS Notes |
|---|---|---|
| `id` | `String (uuid)` | Auto-generated PK |
| `name` | `String` | Full name |
| `role` | `String` | Job title |
| `company` | `String` | Company name |
| `image` | `String?` | **S3 key in `avionyz-public-data`** |
| `quote` | `String` | Featured quote (shown in carousel) |
| `highlight` | `String?` | Badge label e.g. `"Expert of the Week"` |
| `url` | `String?` | Profile/company link (wraps widget in `<a>`) |
| `isActive` | `Boolean` | `true` = visible on site |
| `createdAt` | `DateTime` | Auto-set; controls carousel order (newest first) |
| `updatedAt` | `DateTime` | Auto-updated |

---

### 6.3 `SocialTrend` → table `social_trends`

| Field | Type | CMS Notes |
|---|---|---|
| `id` | `String (uuid)` | Auto-generated PK |
| `platform` | `String` | **Must be exactly**: `linkedin`, `twitter`, or `youtube` |
| `content` | `String?` | Post title/text — shown as `label` on frontend |
| `url` | `String` | Link to original post (required) |
| `imageUrl` | `String?` | Thumbnail — shown as `image` on frontend |
| `author` | `String?` | Handle or channel name |
| `authorImage` | `String?` | Profile picture URL |
| `date` | `DateTime` | Display date (defaults to now) |
| `likes` | `String?` | Human-readable: `"25k"`, `"1.2M"` |
| `comments` | `String?` | Comment count string |
| `shares` | `String?` | Share count string |
| `isActive` | `Boolean` | `true` = shown on frontend |

---

### 6.4 `Media` → table `media`

| Field | Type | CMS Notes |
|---|---|---|
| `id` | `String (uuid)` | Auto-generated PK |
| `type` | `String` | `video`, `image`, `podcast`, `magazine`, `advertisement` |
| `title` | `String` | Display title |
| `description` | `String?` | Description text |
| `url` | `String?` | **S3 key in `avionyz-public-data`** (video/podcast file) |
| `thumbnail` | `String?` | **S3 key in `avionyz-public-data`** (cover image) |
| `tags` | `String[]` | Tag strings |
| `date` | `DateTime?` | Upload/publish date |
| `views` | `Int` | View counter (auto-incremented) |
| `downloads` | `Int` | Download counter |

---

### 6.5 `Article` → table `articles`

| Field | Type | CMS Notes |
|---|---|---|
| `id` | `String (uuid)` | Auto-generated PK |
| `title` | `String` | Headline |
| `timestampDate` | `DateTime` | Publication date |
| `readTime` | `String?` | e.g. `"5 min read"` |
| `mainImage` | `String?` | **S3 key in `avionyz-storage`** (private bucket) |
| `shortDescription` | `String?` | Summary / subtitle |
| `body` | `String?` | Full HTML or markdown body |
| `tags` | `String[]` | Include `STOCK_XXX` for stock tracking |
| `type` | `String?` | `news`, `business`, `aerospace`, `breaking` |
| `views` | `Int` | Auto-incremented on each article page load |

---

### 6.6 Existing CMS Models

#### `CmsUser` → table `cms_users`
| Field | Type | Notes |
|---|---|---|
| `id` | `String (uuid)` | PK |
| `email` | `String` | Login email |
| `passwordHash` | `String` | Bcrypt hash |
| `name` | `String` | Display name |
| `role` | `CmsRole` | `JOURNALIST`, `EDITOR`, `ADMIN` |

#### `StagedArticle` → table `staged_articles`
| Field | Type | Notes |
|---|---|---|
| `id` | `String (uuid)` | PK |
| `title` | `String` | Draft title |
| `status` | `StagedArticleStatus` | `DRAFT`, `SUBMITTED`, `NEEDS_CHANGES`, `PUBLISHED` |
| `submittedById` | `String` | CmsUser FK |
| `publishedArticleId` | `String?` | Links to live Article once published |

---

## 7. Feature: Image Uploads

### Bucket Assignment by Content Type

| Content Type | Bucket | Access Method |
|---|---|---|
| Article `mainImage` / body images | `avionyz-storage` | Presigned URL (expires 2hr) |
| Event `image` / `images[]` | `avionyz-public-data` | Direct permanent URL |
| Expert `image` | `avionyz-public-data` | Direct permanent URL |
| Video file (`media.url`) | `avionyz-public-data` | Direct URL or HLS stream |
| Video thumbnail (`media.thumbnail`) | `avionyz-public-data` | Direct permanent URL |
| Feed post images | `avionyz-storage` | Presigned URL (expires 2hr) |

### CMS Upload Flow

```
1. CMS user picks a file in the UI
2. CMS calls POST /api/cms/upload with { fileBase64, folder: "events", contentType: "image/jpeg" }
3. Backend uploads to the correct S3 bucket
4. Backend returns: { key: "events/uuid.jpg" }
5. CMS stores the KEY (not the URL) in the database field
6. Frontend/backend constructs the full URL when serving
```

### Recommended S3 Key Convention
```
events/{uuid}.{ext}          → avionyz-public-data
experts/{uuid}.{ext}         → avionyz-public-data
articles/main/{uuid}.{ext}   → avionyz-storage
articles/body/{uuid}.{ext}   → avionyz-storage
media/videos/{uuid}.m3u8     → avionyz-public-data
media/thumbnails/{uuid}.{ext} → avionyz-public-data
```

---

## 8. Feature: Events

### Homepage Loading Flow

```
App starts → DataProvider mounts → getHomeData() → GET /api/articles/home

Backend:
  prisma.event.findMany({
    where: { date: { gte: now } },
    orderBy: { date: 'asc' },
    take: 6
  })
  → prepends S3_PUBLIC base URL to event.image
  → returns as articles.events[]

HomePage.jsx:
  const selectedEvents = safeArticles.events || []
  selectedEvents.slice(0, 6).map(event =>
    <Events event={{ ...event, image: getImageUrl(event.image) }} />
  )
  // Note: getImageUrl() is a no-op here since /articles/home already
  //       returns the full URL
```

### Events Page Loading Flow

```
EventPage.jsx mounts
  → getEvents({ region, page, limit: 10, status: 'upcoming' })
  → GET /api/events?region=...&page=1&limit=10&status=upcoming

Backend:
  prisma.event.findMany({ where, orderBy, skip, take })
  → returns event.image as raw S3 key (e.g. "events/foo.jpg")

EventPage.jsx:
  events.map(event =>
    <Events event={{ ...event, image: getImageUrl(event.image) }} />
  )
  // getImageUrl() prepends "https://avionyz-public-data.s3.ap-south-1.amazonaws.com/"
```

### CMS Endpoints Needed

```
GET    /api/cms/events           → List all events (including past)
POST   /api/cms/events           → Create new event
PUT    /api/cms/events/:id       → Update event
DELETE /api/cms/events/:id       → Delete event
```

**Request body for POST / PUT**:
```json
{
  "eventName": "Aviation Summit 2026",
  "eventLink": "https://register.example.com",
  "venue": "Dubai World Trade Centre",
  "onlineOrOffline": "Offline",
  "freeOrPaid": "Paid",
  "date": "2026-09-15T09:00:00.000Z",
  "time": "9:00 AM GST",
  "eventType": "Conference",
  "region": "Gulf/Middle East",
  "image": "events/uploaded-uuid.jpg",
  "lat": 25.2285,
  "lng": 55.3273,
  "country": "UAE",
  "description": "Optional longer description",
  "organizedBy": "Organizer Name"
}
```

---

## 9. Feature: Social Media Trends

### Frontend Rendering Flow

```
DataProvider → getHomeData() → GET /api/articles/home
  → socialTrends: {
      linkedin: SocialTrend[max 10],
      twitter:  SocialTrend[max 10],
      youtube:  SocialTrend[max 10]
    }

HomePage.jsx:
  const { socialTrends } = useData()
  const SOCIAL_PLATFORMS = ['linkedin', 'twitter', 'youtube']
  const [activeSocialTab, setActiveSocialTab] = useState(0)

  socialTrends[SOCIAL_PLATFORMS[activeSocialTab]].slice(0, 4).map(trend =>
    <a href={trend.url}>
      <span>{trend.label}</span>    ← DB: content
      <span>{trend.subtext}</span>  ← DB: likes || author || "Trending"
      <img src={trend.image} />     ← DB: imageUrl
    </a>
  )
```

### Backend Query (inside `/articles/home`)

```js
// Three queries run in parallel:
prisma.socialTrend.findMany({ where: { platform: 'linkedin', isActive: true }, take: 10, orderBy: { date: 'desc' } }),
prisma.socialTrend.findMany({ where: { platform: 'twitter',  isActive: true }, take: 10, orderBy: { date: 'desc' } }),
prisma.socialTrend.findMany({ where: { platform: 'youtube',  isActive: true }, take: 10, orderBy: { date: 'desc' } }),

// Each trend is formatted via:
const formatTrend = (t) => ({
  id:      t.id,
  type:    t.platform,
  label:   t.content,
  subtext: t.likes ? `${t.likes} likes` : (t.author || 'Trending'),
  url:     t.url,
  image:   t.imageUrl,
  author:  t.author,
});
```

### CMS Endpoints Needed

```
GET    /api/cms/social-trends                → List all (any isActive)
GET    /api/cms/social-trends/:platform      → Filter by platform
POST   /api/cms/social-trends                → Create new trend
PUT    /api/cms/social-trends/:id            → Update trend
DELETE /api/cms/social-trends/:id            → Delete trend
PATCH  /api/cms/social-trends/:id/toggle     → Toggle isActive on/off
```

**Request body for POST / PUT**:
```json
{
  "platform": "linkedin",
  "content": "Avionyz named Top Aviation Media Brand 2026",
  "url": "https://www.linkedin.com/posts/avionyz/...",
  "imageUrl": "https://media.licdn.com/.../image.jpg",
  "author": "Avionyz",
  "date": "2026-03-31T10:00:00.000Z",
  "likes": "1.2k",
  "isActive": true
}
```

> `platform` **must** be exactly one of: `linkedin`, `twitter`, `youtube` (all lowercase).

---

## 10. Feature: Expert of the Week

### Frontend Rendering Flow

```
DataProvider → getHomeData() → GET /api/articles/home
  → experts: Expert[max 4]  (isActive=true, sorted newest createdAt first)
             image field = full public S3 URL

HomePage.jsx:
  <ExpertWidget />

ExpertWidget.jsx:
  const { articles } = useData()
  const experts = articles.experts || []
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentExpert = experts[currentIndex]

  Renders:
    currentExpert.image    → <img> profile photo
    currentExpert.name     → name heading
    currentExpert.role     → job title
    currentExpert.company  → company (displayed as "role • company")
    currentExpert.quote    → quote block
    currentExpert.url      → if set, wraps whole widget in <a href>
  
  Dot navigation to cycle through all active experts
```

### Backend Query (inside `/articles/home`)

```js
prisma.expert.findMany({
  where: { isActive: true },
  orderBy: { createdAt: 'desc' },
  take: 4,
})

// Image URL construction:
image: e.image
  ? (e.image.startsWith('http') ? e.image : `${S3_PUBLIC}${e.image}`)
  : null
```

Standalone expert endpoint (`GET /api/experts/latest`) does the same query but is only called by the legacy `homeService.js` which is no longer used by the homepage.

### CMS Endpoints Needed

```
GET    /api/cms/experts            → List all experts (include inactive)
POST   /api/cms/experts            → Create new expert
PUT    /api/cms/experts/:id        → Update expert info
DELETE /api/cms/experts/:id        → Delete expert
PATCH  /api/cms/experts/:id/toggle → Toggle isActive
```

**Request body for POST / PUT**:
```json
{
  "name": "Dr. Sarah Ahmed",
  "role": "Chief Aviation Officer",
  "company": "Emirates Group",
  "image": "experts/sarah-ahmed-uuid.jpg",
  "quote": "Safety is not just a priority, it is a value we live by.",
  "highlight": "Expert of the Week",
  "url": "https://linkedin.com/in/sarah-ahmed",
  "isActive": true
}
```

> `image` must be the **S3 key** after uploading to `avionyz-public-data`.
> The widget shows up to **4 active experts**. To feature a specific person first, their record should have the most recent `createdAt` and `isActive = true`.

---

## 11. CMS Implementation Guide

### Recommended Express Mount

```js
// server.js
app.use('/api/cms', cmsAuthMiddleware, require('./src/routes/cms'));
```

### Full Endpoint Checklist

```
# Image Upload
POST   /api/cms/upload

# Events (4 endpoints)
GET    /api/cms/events
POST   /api/cms/events
PUT    /api/cms/events/:id
DELETE /api/cms/events/:id

# Social Trends (6 endpoints)
GET    /api/cms/social-trends
GET    /api/cms/social-trends/:platform
POST   /api/cms/social-trends
PUT    /api/cms/social-trends/:id
DELETE /api/cms/social-trends/:id
PATCH  /api/cms/social-trends/:id/toggle

# Experts (5 endpoints)
GET    /api/cms/experts
POST   /api/cms/experts
PUT    /api/cms/experts/:id
DELETE /api/cms/experts/:id
PATCH  /api/cms/experts/:id/toggle
```

### Cache Timing — When Do Changes Go Live?

| Feature | Loaded Via | Cache Policy | Live After |
|---|---|---|---|
| Events (homepage) | `/articles/home` | `no-store` | **Immediately** on next page load |
| Events (events page) | `/events` | `5min browser / 1hr CDN` | Up to 1 hour on CDN |
| Expert of the Week | `/articles/home` | `no-store` | **Immediately** on next page load |
| Social Trends (homepage) | `/articles/home` | `no-store` | **Immediately** on next page load |
| Social Trends (standalone) | `/trending/:platform` | `5min browser / 1hr CDN` | Up to 1 hour on CDN |

---

*Last updated: March 31, 2026 · Avionyz Backend v1 · Avionyz Frontend (Vite + React)*
