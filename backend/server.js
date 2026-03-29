import express from 'express';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// S3 Configuration
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Middleware
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin '${origin}' not allowed`));
        }
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static paths
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/', express.static(path.join(__dirname, 'public'))); // For test.html

// S3 Upload Proxy Route
// The browser sends the webp blob to this Express endpoint.
// Express then PUTs it directly to S3 using server-side credentials — no CORS needed.
app.post('/api/upload', express.raw({ type: 'image/webp', limit: '20mb' }), async (req, res) => {
    try {
        const { type, order, articleId } = req.query;
        // articleId arrives as e.g. 'article-146', strip prefix so key isn't doubled
        const rawId = articleId ? articleId.replace(/^article-/, '') : 'new';
        const suffix = type === 'main' ? 'main' : (order !== undefined ? order : Date.now());
        const key = `articleimage/article-${rawId}/article-${rawId}-${suffix}.webp`;

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: req.body,
            ContentType: 'image/webp'
        });

        await s3Client.send(command);

        res.json({ key });
    } catch (error) {
        console.error('Error uploading to S3:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

// Signed URL — given a key, return a pre-signed GET URL (1 hour expiry)
app.get('/api/signed-url', async (req, res) => {
    const { key } = req.query;
    if (!key) return res.status(400).json({ message: 'key is required' });
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ url });
    } catch (error) {
        console.error('Signed URL error:', error);
        res.status(500).json({ message: 'Failed to generate signed URL' });
    }
});

// Presigned PUT URL — frontend uploads directly to S3 with this URL
app.get('/api/upload-url', async (req, res) => {
    const { type, order, articleId } = req.query;
    const rawId = articleId ? articleId.replace(/^article-/, '') : 'new';
    const suffix = type === 'main' ? 'main' : (order !== undefined ? order : Date.now());
    const key = `articleimage/article-${rawId}/article-${rawId}-${suffix}.webp`;
    try {
        const command = new PutCmd({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            ContentType: 'image/webp',
        });
        const uploadUrl = await getPutSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 min
        res.json({ uploadUrl, key });
    } catch (error) {
        console.error('Presigned PUT error:', error);
        res.status(500).json({ message: 'Failed to generate upload URL' });
    }
});

// Routes
import articleRoutes from './routes/articleRoutes.js';
import cmsAuthRoutes from './routes/cmsAuthRoutes.js';
import stagedArticleRoutes from './routes/stagedArticleRoutes.js';
import commentModerationRoutes from './routes/commentModerationRoutes.js';

app.use('/api/articles', articleRoutes);
app.use('/cms/auth', cmsAuthRoutes);
app.use('/cms/staged', stagedArticleRoutes);
app.use('/cms/comments', commentModerationRoutes);

// Health check
app.get('/health', (req, res) => {
    res.send('API is running successfully on EC2 setup...');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
