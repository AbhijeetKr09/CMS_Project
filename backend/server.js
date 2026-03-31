import express from 'express';
import cors from 'cors';
import path from 'path';
import { promises as fs } from 'fs';
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

// ── Multer — memory storage for CMS uploads ───────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 600 * 1024 * 1024 }, // 600 MB max (large enough for raw MP4)
});

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static paths
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
app.post('/api/cms/upload-video', authenticate, upload.single('video'), async (req, res) => {
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
                message: 'ffmpeg not installed on server. Run: npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg',
            });
        }

        const videoId = uuidv4();
        const tmpDir  = path.join(__dirname, 'uploads', 'tmp');
        tmpInput      = path.join(tmpDir, `${videoId}_input.mp4`);
        tmpOutDir     = path.join(tmpDir, videoId);

        await fs.mkdir(tmpDir,    { recursive: true });
        await fs.mkdir(tmpOutDir, { recursive: true });
        await fs.writeFile(tmpInput, req.file.buffer);

        const m3u8Name = `${videoId}.m3u8`;
        const m3u8Path = path.join(tmpOutDir, m3u8Name);
        const hlsKey   = `videos/${m3u8Name}`;

        // Run ffmpeg to segment the video into HLS
        await new Promise((resolve, reject) => {
            ffmpeg(tmpInput)
                .outputOptions([
                    '-codec: copy',
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

        // Upload all .ts segment files in parallel
        const segments = (await fs.readdir(tmpOutDir)).filter(f => f.endsWith('.ts'));
        await Promise.all(segments.map(async seg => {
            const buf = await fs.readFile(path.join(tmpOutDir, seg));
            await s3Client.send(new PutObjectCommand({
                Bucket:      S3_PUBLIC_BUCKET,
                Key:         `videos/${seg}`,
                Body:        buf,
                ContentType: 'video/MP2T',
            }));
        }));

        res.json({
            key: hlsKey,
            url: `https://${S3_PUBLIC_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${hlsKey}`,
        });
    } catch (err) {
        console.error('[UploadVideo] error:', err);
        res.status(500).json({ message: 'Video processing failed.', error: err.message });
    } finally {
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
