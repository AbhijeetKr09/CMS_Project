import express          from 'express';
import cors             from 'cors';
import path             from 'path';
import { promises as fs, createReadStream, mkdirSync } from 'fs';
import 'dotenv/config';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl }  from '@aws-sdk/s3-request-presigner';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import multer            from 'multer';

// Route imports
import articleRoutes               from './routes/articleRoutes.js';
import cmsAuthRoutes               from './routes/cmsAuthRoutes.js';
import stagedArticleRoutes         from './routes/stagedArticleRoutes.js';
import commentModerationRoutes     from './routes/commentModerationRoutes.js';
import eventCmsRoutes              from './routes/eventCmsRoutes.js';
import socialTrendRoutes           from './routes/socialTrendRoutes.js';
import expertCmsRoutes             from './routes/expertCmsRoutes.js';
import mediaCmsRoutes              from './routes/mediaCmsRoutes.js';
import analyticalArticleCmsRoutes  from './routes/analyticalArticleCmsRoutes.js';
import airlineCmsRoutes            from './routes/airlineCmsRoutes.js';
import { authenticate }            from './middleware/cmsAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 5000;

// ── S3 ────────────────────────────────────────────────────────────────────────
const s3 = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const S3_PUBLIC  = process.env.S3_PUBLIC_DATA;
const S3_PRIVATE = process.env.S3_BUCKET_NAME;
const REGION     = process.env.AWS_REGION || 'ap-south-1';

// ── Temp directory ─────────────────────────────────────────────────────────────
// All uploaded files land here first; everything is deleted after S3 upload.
const TMP_DIR = path.join(__dirname, 'uploads', 'tmp');
try { mkdirSync(TMP_DIR, { recursive: true }); } catch {}

// ── Disk-based Multer (zero RAM buffering) ─────────────────────────────────────
// Every upload — images, xlsx, video — is written to disk before touching S3.
// req.file.buffer is NEVER used anywhere in this file.
const diskUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, TMP_DIR),
        filename:    (_req, _file, cb) => {
            const ext = _file.originalname.split('.').pop().toLowerCase();
            cb(null, `${uuidv4()}.${ext}`);
        },
    }),
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB hard cap (disk, not RAM)
});

// ── Stream a local file → S3, then delete it from disk ────────────────────────
const streamToS3 = async (localPath, bucket, key, contentType) => {
    await s3.send(new PutObjectCommand({
        Bucket:      bucket,
        Key:         key,
        Body:        createReadStream(localPath), // stream — never read into RAM
        ContentType: contentType,
    }));
    await fs.unlink(localPath).catch(() => {}); // clean disk immediately
};

// ── In-process Video Job Queue ─────────────────────────────────────────────────
// Decouples HTTP request from long-running ffmpeg + S3 work.
// Client gets a jobId immediately; polls /api/cms/video-status/:jobId for progress.
const VIDEO_CONCURRENCY = parseInt(process.env.VIDEO_CONCURRENCY || '1', 10); // default 1
const jobStore   = new Map(); // jobId → { status, progress, key, url, error }
const jobQueue   = [];
let   activeJobs = 0;

const log = (jobId, msg) =>
    console.log(`[Video:${jobId.slice(0, 8)}] ${msg} | mem: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);

// ── Auto-incrementing S3 video folder: video_1, video_2, video_3 … ────────────
// Queries S3 to find the highest existing video_N folder, returns video_{N+1}.
// This is safe even after server restarts since it reads from S3 directly.
const getNextVideoFolderId = async () => {
    let maxN = 0;
    let token;
    do {
        const res = await s3.send(new ListObjectsV2Command({
            Bucket:            S3_PUBLIC,
            Prefix:            'videos/video_',
            Delimiter:         '/',
            ContinuationToken: token,
        }));
        for (const p of (res.CommonPrefixes || [])) {
            // p.Prefix looks like 'videos/video_3/'
            const match = p.Prefix.match(/video_(\d+)\/$/);
            if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
        }
        token = res.NextContinuationToken;
    } while (token);
    return `video_${maxN + 1}`;
};

const processVideo = async (jobId, rawPath) => {
    let tmpOutDir = null;
    const t0 = Date.now();
    try {
        jobStore.set(jobId, { status: 'processing', progress: 5 });
        log(jobId, `Starting. file=${rawPath}`);

        // Dynamic import — handles missing fluent-ffmpeg gracefully
        let ffmpeg;
        try { ffmpeg = (await import('fluent-ffmpeg')).default; }
        catch { throw new Error('ffmpeg not installed on server.'); }

        // ── Resolve folder name from S3 (video_1, video_2 …) ─────────────────
        const videoId  = await getNextVideoFolderId(); // e.g. 'video_2'
        const s3Folder = `videos/${videoId}`;          // 'videos/video_2'
        tmpOutDir      = path.join(TMP_DIR, videoId);
        await fs.mkdir(tmpOutDir, { recursive: true });

        const m3u8Name = `${videoId}.m3u8`;            // 'video_2.m3u8'
        const m3u8Path = path.join(tmpOutDir, m3u8Name);
        const hlsKey   = `${s3Folder}/${m3u8Name}`;   // 'videos/video_2/video_2.m3u8'

        // ── Step 1: ffmpeg → HLS segments on disk ─────────────────────────────
        log(jobId, `ffmpeg started → folder=${s3Folder}`);
        await new Promise((resolve, reject) => {
            ffmpeg(rawPath)
                .outputOptions([
                    '-codec copy',
                    '-start_number 0',
                    '-hls_time 6',
                    '-hls_list_size 0',
                    // Segments named: video_2_000.ts, video_2_001.ts …
                    `-hls_segment_filename ${path.join(tmpOutDir, `${videoId}_%03d.ts`)}`,
                    '-f hls',
                ])
                .output(m3u8Path)
                .on('end',   resolve)
                .on('error', reject)
                .run();
        });
        log(jobId, `ffmpeg done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        jobStore.set(jobId, { status: 'processing', progress: 40 });

        // ── Step 2: Delete raw MP4 — no longer needed ─────────────────────────
        await fs.unlink(rawPath).catch(() => {});
        log(jobId, 'Raw MP4 deleted');

        // ── Step 3: Patch .m3u8 — replace bare segment names with full S3 URLs ─
        // Segments live at videos/video_2/video_2_000.ts etc.
        const segBase   = `https://${S3_PUBLIC}.s3.${REGION}.amazonaws.com/${s3Folder}/`;
        let m3u8Content = await fs.readFile(m3u8Path, 'utf8');
        m3u8Content     = m3u8Content.replace(/^([^#].+\.ts)$/gm, `${segBase}$1`);

        // Upload .m3u8 playlist
        await s3.send(new PutObjectCommand({
            Bucket:      S3_PUBLIC,
            Key:         hlsKey,
            Body:        m3u8Content,
            ContentType: 'application/vnd.apple.mpegurl',
        }));

        // ── Step 4: Upload segments SEQUENTIALLY — stream each, delete after ──
        const segments = (await fs.readdir(tmpOutDir)).filter(f => f.endsWith('.ts'));
        log(jobId, `Uploading ${segments.length} segments → ${s3Folder}/`);

        for (let i = 0; i < segments.length; i++) {
            const seg     = segments[i];
            const segPath = path.join(tmpOutDir, seg);
            // Upload to videos/video_2/video_2_000.ts
            await streamToS3(segPath, S3_PUBLIC, `${s3Folder}/${seg}`, 'video/MP2T');
            const progress = 40 + Math.round(((i + 1) / segments.length) * 58);
            jobStore.set(jobId, { status: 'processing', progress });
        }

        const resultUrl = `https://${S3_PUBLIC}.s3.${REGION}.amazonaws.com/${hlsKey}`;
        jobStore.set(jobId, { status: 'done', progress: 100, key: hlsKey, url: resultUrl });
        log(jobId, `Done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${hlsKey}`);

    } catch (err) {
        log(jobId, `FAILED: ${err.message}`);
        jobStore.set(jobId, { status: 'failed', progress: 0, error: err.message });
        await fs.unlink(rawPath).catch(() => {}); // cleanup raw input on failure
    } finally {
        // Safety net — remove entire tmpOutDir (should already be empty, but just in case)
        if (tmpOutDir) await fs.rm(tmpOutDir, { recursive: true, force: true }).catch(() => {});
        activeJobs--;
        drainQueue(); // pick up next job
    }
};

// ── Queue drain — respects MAX_CONCURRENT_VIDEOS ───────────────────────────────
const drainQueue = () => {
    while (activeJobs < VIDEO_CONCURRENCY && jobQueue.length > 0) {
        const { jobId, filePath } = jobQueue.shift();
        activeJobs++;
        processVideo(jobId, filePath); // fire and forget — non-blocking
    }
};

const enqueueVideo = (filePath) => {
    const jobId = uuidv4();
    jobStore.set(jobId, { status: 'queued', progress: 0 });
    jobQueue.push({ jobId, filePath });
    log(jobId, `Queued. Queue depth: ${jobQueue.length}. Active: ${activeJobs}`);
    drainQueue();
    return jobId;
};

// ── CORS & Middleware ──────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',').map(o => o.trim());

app.use(cors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
    credentials: true,
}));
// Origin guard — sends 403 after CORS headers are already set (browser sees real error, not CORS block)
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin))
        return res.status(403).json({ message: `Origin '${origin}' not allowed.` });
    next();
});

// ⚠️ Body limits kept small — file uploads must use multer (disk), not JSON body
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use('/', express.static(path.join(__dirname, 'public')));

// ── Article image upload (webp, private bucket) ───────────────────────────────
// Uses express.raw (streams request body directly) — no multer, no disk, no buffer
app.post('/api/upload', express.raw({ type: 'image/webp', limit: '20mb' }), async (req, res) => {
    try {
        const { type, order, articleId } = req.query;
        const rawId  = articleId ? articleId.replace(/^article-/, '') : 'new';
        const suffix = type === 'main' ? 'main' : (order !== undefined ? order : Date.now());
        const key    = `articleimage/article-${rawId}/article-${rawId}-${suffix}.webp`;
        await s3.send(new PutObjectCommand({ Bucket: S3_PRIVATE, Key: key, Body: req.body, ContentType: 'image/webp' }));
        res.json({ key });
    } catch (err) {
        console.error('[Upload/webp]', err.message);
        res.status(500).json({ message: 'Upload failed', error: err.message });
    }
});

// ── Staged article image upload (webp, private bucket) ────────────────────────
// Uses a UUID-based path so each staged draft has its own isolated S3 folder.
// This prevents S3 key collisions between journalists writing concurrently.
// Path: staged/<stagedId>/<suffix>.webp
app.post('/api/upload/staged', authenticate, express.raw({ type: 'image/webp', limit: '20mb' }), async (req, res) => {
    try {
        const { type, order, stagedId } = req.query;
        if (!stagedId) return res.status(400).json({ message: 'stagedId is required' });
        const suffix = type === 'main' ? 'main' : (order !== undefined ? order : Date.now());
        const key    = `staged/${stagedId}/${suffix}.webp`;
        await s3.send(new PutObjectCommand({ Bucket: S3_PRIVATE, Key: key, Body: req.body, ContentType: 'image/webp' }));
        res.json({ key });
    } catch (err) {
        console.error('[Upload/staged]', err.message);
        res.status(500).json({ message: 'Upload failed', error: err.message });
    }
});

// ── Presigned URL for private bucket items ────────────────────────────────────
app.get('/api/signed-url', async (req, res) => {
    const { key } = req.query;
    if (!key) return res.status(400).json({ message: 'key is required' });
    try {
        const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: S3_PRIVATE, Key: key }), { expiresIn: 3600 });
        res.json({ url });
    } catch (err) {
        console.error('[SignedUrl]', err.message);
        res.status(500).json({ message: 'Failed to generate signed URL' });
    }
});

// ── CMS: Public bucket upload (events, experts, media images/thumbnails) ───────
// File lands on disk via multer → streamed to S3 → disk file deleted
app.post('/api/cms/upload-public', authenticate, diskUpload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const localPath = req.file.path;
    try {
        const folder = req.query.folder || 'uploads';
        const ext    = req.file.originalname.split('.').pop().toLowerCase();
        const key    = `${folder}/${uuidv4()}.${ext}`;
        await streamToS3(localPath, S3_PUBLIC, key, req.file.mimetype);
        // streamToS3 already deletes localPath ✅
        const url = `https://${S3_PUBLIC}.s3.${REGION}.amazonaws.com/${key}`;
        res.json({ key, url });
    } catch (err) {
        await fs.unlink(localPath).catch(() => {}); // cleanup on error
        console.error('[UploadPublic]', err.message);
        res.status(500).json({ message: 'Upload failed.', error: err.message });
    }
});

// ── CMS: Private bucket upload (analytical article xlsx, private images) ───────
// Same pattern: disk → stream → S3 → delete
app.post('/api/cms/upload-private', authenticate, diskUpload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const localPath = req.file.path;
    try {
        const folder   = req.query.folder   || 'uploads';
        const filename = req.query.filename || `${uuidv4()}.${req.file.originalname.split('.').pop().toLowerCase()}`;
        const key      = `${folder}/${filename}`;
        await streamToS3(localPath, S3_PRIVATE, key, req.file.mimetype);
        // streamToS3 already deletes localPath ✅
        res.json({ key });
    } catch (err) {
        await fs.unlink(localPath).catch(() => {}); // cleanup on error
        console.error('[UploadPrivate]', err.message);
        res.status(500).json({ message: 'Upload failed.', error: err.message });
    }
});

// ── CMS: Video upload — accepts file, queues job, returns IMMEDIATELY ──────────
// No long-running work inside the request cycle.
// Client polls /api/cms/video-status/:jobId for progress.
app.post('/api/cms/upload-video', authenticate, diskUpload.single('video'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No video file uploaded.' });
    const jobId = enqueueVideo(req.file.path);
    res.json({
        jobId,
        status:  'queued',
        message: 'Video queued for processing. Poll /api/cms/video-status/:jobId for progress.',
    });
});

// ── CMS: Video job status polling ─────────────────────────────────────────────
app.get('/api/cms/video-status/:jobId', authenticate, (req, res) => {
    const job = jobStore.get(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found.' });
    res.json({ jobId: req.params.jobId, ...job });
});

// ── Route mounts ──────────────────────────────────────────────────────────────
app.use('/api/articles',            articleRoutes);
app.use('/cms/auth',                cmsAuthRoutes);
app.use('/cms/staged',              stagedArticleRoutes);
app.use('/cms/comments',            commentModerationRoutes);
app.use('/cms/events',              eventCmsRoutes);
app.use('/cms/social-trends',       socialTrendRoutes);
app.use('/cms/experts',             expertCmsRoutes);
app.use('/cms/media',               mediaCmsRoutes);
app.use('/cms/analytical-articles', analyticalArticleCmsRoutes);
app.use('/cms/users',               cmsAuthRoutes);
app.use('/cms',                     airlineCmsRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.send('API is running.'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
