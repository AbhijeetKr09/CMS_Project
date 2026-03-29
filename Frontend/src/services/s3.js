import api from './api';

// ── Convert any image file to WebP blob ───────────────────────────────────────
const convertToWebp = async (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
                (blob) => { if (blob) resolve(blob); else reject(new Error('WebP conversion failed')); },
                'image/webp', 0.85
            );
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
};

/**
 * Upload a file to S3 via the backend proxy (avoids S3 CORS requirements).
 * Returns the S3 key (e.g. "articleimage/article-146/article-146-main.webp").
 */
export const uploadFile = async (file, { type, order, articleId }) => {
    const webpBlob = await convertToWebp(file);
    const arrayBuffer = await webpBlob.arrayBuffer();

    const res = await api.post('/api/upload', arrayBuffer, {
        params: { type, order, articleId: articleId || 'new' },
        headers: { 'Content-Type': 'image/webp' },
    });

    return res.data.key; // e.g. "articleimage/article-146/article-146-main.webp"
};

/**
 * Convert an S3 key (or already-signed URL) to a display URL.
 * If the key starts with http or blob:, return as-is.
 * Otherwise fetch a fresh signed GET URL from the backend.
 */
export const getSignedUrl = async (key) => {
    if (!key) return null;
    if (key.startsWith('http') || key.startsWith('blob:')) return key;
    try {
        const res = await api.get('/api/signed-url', { params: { key } });
        return res.data.url;
    } catch {
        return key;
    }
};

/**
 * Scan a body string (Markdown or HTML) for any embedded S3 key image references
 * and replace them with signed GET URLs.
 * Handles both:
 *  - Markdown: ![alt](s3key)
 *  - HTML: <img src="s3key" ...>
 */
export const signBodyImageSrcs = async (body) => {
    if (!body) return body;

    // Collect all unique image src/key values from the body
    const keysToSign = new Set();

    // Markdown image syntax: ![alt](src)
    const mdRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
    let match;
    while ((match = mdRegex.exec(body)) !== null) {
        const src = match[1].split('?')[0]; // strip existing query params
        // Only process if it looks like an S3 key (not already signed, not blob)
        if (!src.startsWith('blob:') && !src.startsWith('data:')) {
            keysToSign.add(src);
        }
    }

    // HTML img src: <img src="..." ...>
    const htmlRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    while ((match = htmlRegex.exec(body)) !== null) {
        const src = match[1].split('?')[0];
        if (!src.startsWith('blob:') && !src.startsWith('data:')) {
            keysToSign.add(src);
        }
    }

    if (keysToSign.size === 0) return body;

    // Sign all keys in parallel
    const signedMap = {};
    await Promise.all([...keysToSign].map(async (key) => {
        signedMap[key] = await getSignedUrl(key);
    }));

    // Replace all occurrences in the body
    let result = body;
    Object.entries(signedMap).forEach(([key, signed]) => {
        if (signed && signed !== key) {
            // Replace the key (and any URL-encoded variants)
            result = result.split(key).join(signed);
        }
    });

    return result;
};

/**
 * Given an array of image objects with { src: 's3key', previewUrl: 'blob:' },
 * resolve each key to a signed URL and update previewUrl.
 */
export const signImagePreviews = async (images = []) => {
    return Promise.all(
        images.map(async (img) => {
            const signed = await getSignedUrl(img.src);
            return { ...img, previewUrl: signed };
        })
    );
};

/**
 * Given an HTML string (TipTap output), replace any temporary URLs (blob: or signed https)
 * with the permanent S3 key, so only keys are stored in the DB.
 * images: [{ src: 's3key', previewUrl: 'blob:...' or 'https://...signed...' }]
 */
export const replaceBlobsWithKeys = (html, images) => {
    if (!html || !images?.length) return html;
    let result = html;
    images.forEach(({ src, previewUrl }) => {
        if (previewUrl && src) {
            // Replace both blob: and signed https URLs
            if (previewUrl.startsWith('blob:') || previewUrl.startsWith('http')) {
                // For signed URLs: the base URL (without query params) may appear in body
                // Try full URL first, then base URL without query params
                result = result.split(previewUrl).join(src);
                try {
                    const baseUrl = previewUrl.split('?')[0];
                    if (baseUrl !== previewUrl) result = result.split(baseUrl).join(src);
                } catch { /* ignore */ }
            }
        }
    });
    return result;
};
