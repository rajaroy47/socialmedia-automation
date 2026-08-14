# Social Automation Server

Auto-generates a 9:16 short video every day and posts it to YouTube (and
optionally Instagram) via Zernio:

```
topic queue (MongoDB) → Gemini script → HuggingFace images → ElevenLabs
narration → FFmpeg render (Ken Burns zoom + bg music) → Zernio post
```

## Directory structure

```
social-automation/
  server/
    src/
      config/          zernio.config.js, db.config.js, gemini.config.js, paths.config.js
      models/          videoTopic.model.js, post.model.js
      controllers/     instagram.controller.js, youtube.controller.js
      routes/          instagram.routes.js, youtube.routes.js
      services/        zernio.service.js, gemini.service.js, huggingface.service.js,
                        elevenlabs.service.js, ffmpeg.service.js, pipeline.service.js,
                        topic.service.js
      jobs/            dailyVideo.job.js (4pm cron), postWorker.job.js (posting worker)
      utils/           keyRotator.js, logger.js, publicUrl.js
    public/uploads/bg-music/    bg1.mp3, bg2.mp3, bg3.mp3 (yours, copied over)
    generatedOutput/   images/ audios/ videos/ thumbnails/
    server.js
    package.json
    .env.example
```

## Setup

```bash
cd server
cp .env.example .env      # fill in your keys
npm install
npm run dev                # nodemon, or `npm start`
```

You need MongoDB reachable at `MONGO_URI` (topics + post queue live there).

## Admin login (Topics Manager UI)

The Topics Manager at `http://localhost:4000/` (`public/index.html`) is
behind an admin login (`public/login.html`). Credentials live in MongoDB
(`Admin` collection, password stored as a bcrypt hash) — nothing is
hardcoded in the frontend.

On first boot, if the `Admin` collection is empty, the server seeds one
account from `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.
If `ADMIN_PASSWORD` is left blank, a random password is generated and
printed once to the server console — copy it from there. After that first
run, `.env` is no longer read for credentials; the account lives in the DB
from then on (change the password by updating the `Admin` document's
`passwordHash`, or add a small admin-management endpoint later if you need
self-service password changes).

All `/api/topics/*` endpoints require `Authorization: Bearer <token>`,
where the token comes from `POST /api/auth/login`:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin", "password": "your-password"}'
```

Set a real `JWT_SECRET` in `.env` for production — without it, sessions are
signed with a random secret that changes (and invalidates all logins) on
every server restart.

## Seeding topics

The daily job always works through the `VideoTopic` collection in `order`.
Seed it via the API instead of touching Mongo directly:

```bash
curl -X POST http://localhost:4000/api/topics/seed \
  -H "Content-Type: application/json" \
  -d '{"topics": ["Ocean mysteries", "Space facts", "Ancient Rome"]}'
```

## Multi-key quota rotation (ElevenLabs + HuggingFace)

`src/utils/keyRotator.js` is what makes "try key 1, on quota error try key 2,
then key 3... recursively" work. Both `elevenlabs.service.js` and
`huggingface.service.js` read up to 10 keys each
(`ELEVENLABS_API_KEY_1..10`, `HUGGINGFACE_API_KEY_1..10`) from `.env` and
call `runWithKeyRotation`. It:

- Remembers the last key that worked per provider, so it doesn't always
  hammer key #1 first.
- Only rotates to the next key on a genuine quota/rate-limit/auth error
  (429/402/403, "rate limit", "quota", "exceeded", etc.) — a real error like
  a bad prompt fails immediately instead of burning through 10 keys for
  nothing.
- Throws a combined error only once every configured key has failed.

Add as many keys as you have free-tier accounts for; leave the rest blank.

## Daily scheduling & the posting worker

Two independent cron jobs, both started from `server.js`:

- **`dailyVideo.job.js`** — `DAILY_VIDEO_CRON` (default `0 16 * * *`, 4:00 PM
  daily). Pulls the next pending topic, runs the full pipeline, and
  **enqueues** a `PostQueue` document per target platform (YouTube always;
  Instagram too if `POST_TO_INSTAGRAM=true`). It does not post directly.
- **`postWorker.job.js`** — `POST_WORKER_CRON` (default `*/5 * * * *`).
  Drains `PostQueue`, posts each item through `zernio.service.js`, retries a
  couple of times in-process, and marks it `posted`/`failed` with the error
  saved on the document (up to `maxAttempts`, default 5, after which a
  failed item stops being retried until you requeue it).

Keeping generation and posting on separate schedules means a slow or
rate-limited Zernio call never blocks tomorrow's video, and a stuck post
gets its own retry cadence instead of one shot.

Trigger either job on demand while testing:

```bash
curl -X POST http://localhost:4000/api/jobs/run-daily-video
curl -X POST http://localhost:4000/api/jobs/run-post-worker
```

## Manual endpoints

| Method | Path | What it does |
|---|---|---|
| POST | `/api/generate-video` | Runs the pipeline only (no posting), body `{ "topic": "..." }` |
| POST | `/api/youtube` | Post a video you already have a URL for (title/description/videoUrl/...) |
| POST | `/api/youtube/generate-and-post` | Full pipeline + immediate YouTube post, body `{ "topic": "..." }` optional |
| GET | `/api/youtube/accounts` / `/test` | List Zernio accounts / connection check |
| POST | `/api/instagram/reel` | Post a reel you already have a URL for |
| POST | `/api/instagram/share-story` | Post an Instagram story from a mediaUrl |
| POST | `/api/instagram/generate-and-post` | Full pipeline + immediate Instagram reel post |
| POST | `/api/topics/seed` | Add topics to the queue |
| GET | `/api/topics/next` | Peek at the next pending topic |

## Public media URLs (Cloudinary)

Zernio needs a URL it can fetch itself — it explicitly rejects `localhost`
and private-network addresses (you'll see `"Invalid media URL: ... points to
a local or private network address"` if this isn't set up). So right after
FFmpeg renders the video and thumbnail, `pipeline.service.js` uploads both to
Cloudinary via `src/services/cloudinary.service.js` and returns the public
`secure_url`s (`result.videoUrl`, `result.thumbnailUrl`) — those are what get
posted, never the local disk path.

Set these in `.env` (from your Cloudinary dashboard):

```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

`generatedOutput/` is still served statically at `/generatedOutput` for local
debugging/preview, but it's no longer what gets posted to Zernio.

## Notes / things to double check before going live

- `@zernio/node`, `@elevenlabs/elevenlabs-js`, `@google/genai`, and
  `@huggingface/inference` version numbers in `package.json` are carried
  over from your original project — run `npm install` and let npm resolve
  whatever's actually current, and re-check the Gemini model name
  (`GEMINI_MODEL` in `.env`) against Google's current model list.
- `YOUTUBE_ACCOUNT_ID` / `INSTAGRAM_ACCOUNT_ID` must be Zernio's internal
  account IDs (from `/api/youtube/accounts`), not your platform usernames.
- Category `22` (used as the YouTube default) is "People & Blogs" — change
  `categoryId` per request if you want a different default.
