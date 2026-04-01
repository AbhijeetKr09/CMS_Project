import express from 'express';
import cors from 'cors';
import path from 'path';
import { promises as fs } from 'fs';
import { mkdirSync } from 'fs';          // sync version for multer destination
import 'dotenv/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';

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

// ── S3 Configuration ──────────────────────────────────────────────────────────
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const S3_PUBLIC_BUCKET  = process.env.S3_PUBLIC_DATA;
const S3_PRIVATE_BUCKET = process.env.S3_BUCKET_NAME;
const AWS_REGION        = process.env.AWS_REGION || 'ap-south-1';

// ── Multer — memory storage for small CMS uploads (images, xlsx, etc.) ──────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB cap for memory uploads
});

// ── Multer — DISK storage for video uploads (avoids OOM on large MP4s) ───────
// Memory storage would hold the entire video in RAM → exit code 137 (SIGKILL)
const tmpUploadDir = path.join(__dirname, 'uploads', 'tmp');
try { mkdirSync(tmpUploadDir, { recursive: true }); } catch {} // ensure dir exists at startup
const videoUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, tmpUploadDir), // dir already exists
        filename:    (_req, _file, cb) => cb(null, `${uuidv4()}_input.mp4`),
    }),
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB disk limit
});

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim());

// Always send CORS headers so browser gets a real 403, not a cryptic CORS block.
// When origin is not allowed, the app.use below intercepts and returns 403.
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(null, false); // don't reject — let the guard below send a clean 403
    },
    credentials: true,
}));

// Origin guard — runs after CORS headers are set, sends clean 403 for unknown origins
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
        return res.status(403).json({ message: `Origin '${origin}' not allowed.` });
    }
    next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Note: /uploads is a temp-only dir for video processing; all files go to S3.
// Not served as static to avoid exposing temp files.
app.use('/', express.static(path.join(__dirname, 'public')));

// ── Existing article image upload (private bucket, webp only) ─────────────────
app.post('/api/upload', express.raw({ type: 'image/webp', limit: '20mb' }), async (req, res) => {
    try {
        const { type, order, articleId } = req.query;
        const rawId  = articleId ? articleId.replace(/^article-/, '') : 'new';
        const suffix = type === 'main' ? 'main' : (order !== undefined ? order : Date.now());
        const key    = `articleimage/article-${rawId}/article-${rawId}-${suffix}.webp`;

        await s3Client.send(new PutObjectCommand({
            Bucket:      S3_PRIVATE_BUCKET,
            Key:         key,
            Body:        req.body,
            ContentType: 'image/webp',
        }));
        res.json({ key });
    } catch (err) {
        console.error('Error uploading to S3:', err);
        res.status(500).json({ message: 'Upload failed', error: err.message });
    }
});

// ── Signed URL — GET presigned URL for private bucket item ────────────────────
app.get('/api/signed-url', async (req, res) => {
    const { key } = req.query;
    if (!key) return res.status(400).json({ message: 'key is required' });
    try {
        const url = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: S3_PRIVATE_BUCKET, Key: key }), { expiresIn: 3600 });
        res.json({ url });
    } catch (err) {
        console.error('Signed URL error:', err);
        res.status(500).json({ message: 'Failed to generate signed URL' });
    }
});

// ── CMS Upload: public bucket (events, experts, media images/thumbnails) ───────
app.post('/api/cms/upload-public', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
        const folder = req.query.folder || 'uploads';
        const ext    = req.file.originalname.split('.').pop().toLowerCase();
        const key    = `${folder}/${uuidv4()}.${ext}`;

        await s3Client.send(new PutObjectCommand({
            Bucket:      S3_PUBLIC_BUCKET,
            Key:         key,
            Body:        req.file.buffer,
            ContentType: req.file.mimetype,
        }));
        const url = `https://${S3_PUBLIC_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
        res.json({ key, url });
    } catch (err) {
        console.error('[UploadPublic] error:', err);
        res.status(500).json({ message: 'Upload failed.', error: err.message });
    }
});

// ── CMS Upload: private bucket (analytical article xlsx, private images) ───────
app.post('/api/cms/upload-private', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
        const folder   = req.query.folder   || 'uploads';
        const filename = req.query.filename || `${uuidv4()}.${req.file.originalname.split('.').pop().toLowerCase()}`;
        const key      = `${folder}/${filename}`;

        await s3Client.send(new PutObjectCommand({
            Bucket:      S3_PRIVATE_BUCKET,
            Key:         key,
            Body:        req.file.buffer,
            ContentType: req.file.mimetype,
        }));
        res.json({ key });
    } catch (err) {
        console.error('[UploadPrivate] error:', err);
        res.status(500).json({ message: 'Upload failed.', error: err.message });
    }
});

// ── CMS Upload: video MP4 → ffmpeg HLS segments → public bucket ───────────────
// Uses disk-based multer (videoUpload) — never loads video into RAM
app.post('/api/cms/upload-video', authenticate, videoUpload.single('video'), async (req, res) => {
    let tmpInput  = null;
    let tmpOutDir = null;
    try {
        if (!req.file) return res.status(400).json({ message: 'No video file uploaded.' });

        // Dynamic import — graceful failure if fluent-ffmpeg is not installed
        let ffmpeg;
        try {
            const mod = await import('fluent-ffmpeg');
            ffmpeg = mod.default;
        } catch {
            return res.status(501).json({
                message: 'ffmpeg not installed on server.',
            });
        }

        // req.file.path is the disk path written by multer — no RAM buffer needed
        tmpInput  = req.file.path;
        tmpOutDir = path.join(tmpUploadDir, path.basename(tmpInput, '_input.mp4'));
        await fs.mkdir(tmpOutDir, { recursive: true });

        const videoId  = path.basename(tmpInput).replace('_input.mp4', '');
        const m3u8Name = `${videoId}.m3u8`;
        const m3u8Path = path.join(tmpOutDir, m3u8Name);
        const hlsKey   = `videos/${m3u8Name}`;

        // Run ffmpeg to segment the video into HLS
        await new Promise((resolve, reject) => {
            ffmpeg(tmpInput)
                .outputOptions([
                    '-codec copy',
                    '-start_number 0',
                    '-hls_time 6',
                    '-hls_list_size 0',
                    `-hls_segment_filename ${path.join(tmpOutDir, `${videoId}_%03d.ts`)}`,
                    '-f hls',
                ])
                .output(m3u8Path)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        // ffmpeg is done — raw input MP4 no longer needed, delete it immediately
        await fs.unlink(tmpInput).catch(() => {});
        tmpInput = null; // prevent double-delete in finally

        // Patch the .m3u8 playlist so segment filenames become full S3 URLs
        const segBaseUrl = `https://${S3_PUBLIC_BUCKET}.s3.${AWS_REGION}.amazonaws.com/videos/`;
        let m3u8Content  = await fs.readFile(m3u8Path, 'utf8');
        m3u8Content      = m3u8Content.replace(/^([^#].+\.ts)$/gm, `${segBaseUrl}$1`);

        // Upload .m3u8 playlist
        await s3Client.send(new PutObjectCommand({
            Bucket:      S3_PUBLIC_BUCKET,
            Key:         hlsKey,
            Body:        m3u8Content,
            ContentType: 'application/vnd.apple.mpegurl',
        }));

        // Upload each .ts segment then delete it from disk immediately — keeps disk clean
        const segments = (await fs.readdir(tmpOutDir)).filter(f => f.endsWith('.ts'));
        await Promise.all(segments.map(async seg => {
            const segPath = path.join(tmpOutDir, seg);
            const buf = await fs.readFile(segPath);
            await s3Client.send(new PutObjectCommand({
                Bucket:      S3_PUBLIC_BUCKET,
                Key:         `videos/${seg}`,
                Body:        buf,
                ContentType: 'video/MP2T',
            }));
            // ✅ Delete from disk immediately after S3 confirms the upload
            await fs.unlink(segPath).catch(() => {});
        }));

        res.json({
            key: hlsKey,
            url: `https://${S3_PUBLIC_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${hlsKey}`,
        });
    } catch (err) {
        console.error('[UploadVideo] error:', err);
        res.status(500).json({ message: 'Video processing failed.', error: err.message });
    } finally {
        // Clean up disk temp files regardless of success or failure
        if (tmpInput)  fs.unlink(tmpInput).catch(() => {});
        if (tmpOutDir) fs.rm(tmpOutDir, { recursive: true, force: true }).catch(() => {});
    }
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
app.use('/cms',                     airlineCmsRoutes); // /cms/airlines + /cms/flight-reviews
app.use('/cms/users',               cmsAuthRoutes);    // user management

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.send('API is running.'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
