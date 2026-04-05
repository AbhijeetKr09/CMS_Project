import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineCloudUpload, HiOutlineTrash, HiOutlinePlus, HiOutlineX, HiOutlineExclamationCircle, HiOutlinePaperAirplane } from 'react-icons/hi';
import api from '../services/api';
import TipTapEditor from '../components/editor/TipTapEditor';
import { uploadFile, uploadStagedFile, replaceBlobsWithKeys, getSignedUrl, signImagePreviews, signBodyImageSrcs } from '../services/s3';

const ARTICLE_TYPES = ['Headline', 'Business', 'News', 'Trending', 'Aerospace', 'Breaking'];

const ArticleEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;
    const editorRef = useRef(null); // ref to TipTapEditor imperative API

    // State
    const [title, setTitle] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [body, setBody] = useState('');
    const [type, setType] = useState('');
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [timestampDate, setTimestampDate] = useState(new Date().toISOString().substring(0, 16));
    const [readTime, setReadTime] = useState('');

    // Media
    const [mainImage, setMainImage] = useState(null);
    const [mainImagePreview, setMainImagePreview] = useState(null);
    const [images, setImages] = useState([]);
    
    // Draft ID for new articles before they are saved
    const [draftId, setDraftId] = useState(null);
    // Numeric article ID (e.g. 'article-146') — only used for legacy direct-publish S3 folder naming
    const [draftNumericId, setDraftNumericId] = useState(null);
    // Stable UUID used as the S3 folder for ALL staged article image uploads.
    // For edit mode: use the staged article's own UUID (id from URL).
    // For new articles: generate a fresh UUID on mount so two journalists simultaneously
    // creating articles never share the same S3 folder (no key collision).
    const [stagedFolderId] = useState(() => id || crypto.randomUUID());

    // Relations
    const [keyInsights, setKeyInsights] = useState([]);
    // Up to 4 internal related article IDs (matches StagedArticle.relatedArticle1–4Id)
    const [relatedArticleIds, setRelatedArticleIds] = useState(['', '', '', '']);

    // Status
    const [currentTimestamp, setCurrentTimestamp] = useState(null);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState('');
    const [statusType, setStatusType] = useState(''); // 'success' | 'error' | ''

    // Staged article workflow state
    const [stagedArticleStatus, setStagedArticleStatus] = useState(null); // null = publishing directly to main DB
    const [editorNote, setEditorNote] = useState(null);
    const [submitting, setSubmitting] = useState(false); // for Submit for Review button

    const [initialLoadDone, setInitialLoadDone] = useState(false);
    const [lastAutoSavedAt, setLastAutoSavedAt] = useState(null);
    const [lastSavedData, setLastSavedData] = useState(null);

    useEffect(() => {
        if (isEditMode) {
            fetchArticle().finally(() => setInitialLoadDone(true));
        } else {
            fetchDraftId().finally(() => setInitialLoadDone(true));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchDraftId = async () => {
        try {
            const res = await api.get('/api/articles/draft/next-id');
            setDraftId(res.data.nextId);
            setDraftNumericId(res.data.nextId); // same for new articles
        } catch (err) {
            console.error('Failed to get draft id', err);
        }
    };

    // Auto-clear status
    useEffect(() => {
        if (status) {
            const timer = setTimeout(() => { setStatus(''); setStatusType(''); }, 4000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const fetchArticle = async () => {
        try {
            // First try to load as a staged article (CMS workflow)
            const res = await api.get(`/cms/staged/${id}`);
            const data = res.data;
            setTitle(data.title || '');
            setShortDescription(data.shortDescription || '');
            const signedBody = await signBodyImageSrcs(data.body || '');
            setBody(signedBody);
            setType(data.type || '');
            setTags(data.tags || []);
            setReadTime(data.readTime || '');
            // Resolve main image key to signed URL for preview
            if (data.mainImage) {
                setMainImage(data.mainImage);
                const signed = await getSignedUrl(data.mainImage);
                setMainImagePreview(signed);
            }
            setStagedArticleStatus(data.status);
            setEditorNote(data.editorNote || null);
            // Load key insights from staged article
            setKeyInsights(data.keyInsights || []);
            // Load related article IDs (up to 4)
            setRelatedArticleIds([
                data.relatedArticle1Id || '',
                data.relatedArticle2Id || '',
                data.relatedArticle3Id || '',
                data.relatedArticle4Id || '',
            ]);
            // Resolve gallery image keys to signed URLs for preview
            if (data.images?.length) {
                const signed = await signImagePreviews(data.images.map(img => ({ 
                    src: img.src, 
                    alt: img.alt || '', 
                    caption: img.caption || '',
                    link: img.link || ''
                })));
                setImages(signed);
            }
            // (stagedFolderId is already set to `id` via useState initialiser — no fetch needed)
            
            // Set initial lastSavedData to avoid immediate auto-save after load
            setLastSavedData(JSON.stringify({
                title: data.title || '',
                body: data.body || '',
                shortDescription: data.shortDescription || '',
                mainImage: data.mainImage || null,
                readTime: data.readTime || '',
                tags: data.tags || [],
                type: data.type || '',
                images: (data.images || []).map(img => ({ src: img.src, alt: img.alt || '', caption: img.caption || '', link: img.link || '' })),
                keyInsights: (data.keyInsights || []).map(ki => ({ insightText: ki.insightText })),
                relatedArticleIds: [data.relatedArticle1Id || '', data.relatedArticle2Id || '', data.relatedArticle3Id || '', data.relatedArticle4Id || '']
            }));
        } catch {
            // Fallback: load from published articles table (for direct edits by admin)
            try {
                const res = await api.get(`/api/articles/${id}`);
                const data = res.data;
                setTitle(data.title || '');
                setShortDescription(data.shortDescription || '');
                // Sign body image srcs before TipTap renders
                const signedBody = await signBodyImageSrcs(data.body || '');
                setBody(signedBody);
                setType(data.type || '');
                setTags(data.tags || []);
                setReadTime(data.readTime || '');
                // Resolve main image key to signed URL for preview
                if (data.mainImage) {
                    setMainImage(data.mainImage);
                    const signed = await getSignedUrl(data.mainImage);
                    setMainImagePreview(signed);
                }
                if (data.timestampDate) {
                    setTimestampDate(new Date(data.timestampDate).toISOString().substring(0, 16));
                    setCurrentTimestamp(data.timestampDate);
                }
                if (data.images?.length) {
                    const signed = await signImagePreviews(data.images.map(img => ({ 
                        src: img.src, 
                        alt: img.alt || '', 
                        caption: img.caption || '',
                        link: img.link || ''
                    })));
                    setImages(signed);
                }
                setKeyInsights(data.keyInsights || []);
                // Load related article IDs (up to 4)
                setRelatedArticleIds([
                    data.relatedArticle1Id || '',
                    data.relatedArticle2Id || '',
                    data.relatedArticle3Id || '',
                    data.relatedArticle4Id || '',
                ]);

                // Set initial lastSavedData for published articles (though auto-save is usually disabled for them)
                setLastSavedData(JSON.stringify({
                    title: data.title || '',
                    body: data.body || '',
                    shortDescription: data.shortDescription || '',
                    mainImage: data.mainImage || null,
                    readTime: data.readTime || '',
                    tags: data.tags || [],
                    type: data.type || '',
                    images: (data.images || []).map(img => ({ src: img.src, alt: img.alt || '', caption: img.caption || '', link: img.link || '' })),
                    keyInsights: (data.keyInsights || []).map(ki => ({ insightText: ki.insightText })),
                    relatedArticleIds: [data.relatedArticle1Id || '', data.relatedArticle2Id || '', data.relatedArticle3Id || '', data.relatedArticle4Id || '']
                }));

                // (legacy direct-publish path — numeric ID needed for S3 folder)
                try {
                    const nextIdRes = await api.get('/api/articles/draft/next-id');
                    setDraftNumericId(nextIdRes.data.nextId);
                } catch { /* ignore */ }
            } catch (err) {
                console.error('Failed to load article', err);
                setStatus('Error loading article');
                setStatusType('error');
            }
        }
    };

    // Image handlers
    const handleMainImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            setStatus('Uploading main image...');
            setStatusType('');
            // Always use the staged-specific upload endpoint with a UUID-based folder.
            // This ensures every journalist's draft has its own isolated S3 folder
            // and uploading a cover image never overwrites another journalist's image.
            const key = await uploadStagedFile(file, { type: 'main', stagedId: stagedFolderId });
            setMainImage(key);
            setMainImagePreview(URL.createObjectURL(file));
            setStatus('Main image uploaded');
            setStatusType('success');
        } catch (error) {
            console.error('Upload failed', error);
            setStatus('Upload failed');
            setStatusType('error');
        }
    };

    const handleTipTapImageUpload = async (file) => {
        try {
            setStatus('Uploading image...');
            setStatusType('');
            const newOrder = images.length + 1;
            // Use staged-specific upload so gallery images are also isolated per draft.
            const key = await uploadStagedFile(file, { type: 'gallery', order: newOrder, stagedId: stagedFolderId });

            // Get a signed GET URL so TipTap renders the image immediately (even after reload)
            const signedUrl = await getSignedUrl(key);
            // Blob URL used for replaceBlobsWithKeys matching on save
            const blobUrl = URL.createObjectURL(file);
            const newImage = { src: key, previewUrl: signedUrl || blobUrl, alt: file.name || '', caption: '', link: '' };
            setImages(prev => [...prev, newImage]);

            setStatus('Image uploaded');
            setStatusType('success');
            // Return the signed URL so TipTap shows the real image from S3
            return signedUrl || blobUrl;
        } catch (err) {
            console.error('Upload failed', err);
            setStatus('Upload failed');
            setStatusType('error');
            throw err;
        }
    };

    // Auto-save logic
    useEffect(() => {
        // Only auto-save if initial load is done and we are in edit mode of a STAGED article.
        // We don't auto-save direct edits to published articles (stagedArticleStatus === null)
        // because those edits are live and should be intentional.
        if (!initialLoadDone || saving || submitting || !isEditMode || !stagedArticleStatus) return;
        if (stagedArticleStatus === 'SUBMITTED' || stagedArticleStatus === 'PUBLISHED') return;

        const timer = setTimeout(() => {
            const cleanBody = replaceBlobsWithKeys(body, images);
            const currentData = {
                title, body: cleanBody, shortDescription, mainImage, readTime, tags, type,
                images: images.map(({ src, alt, caption, link }) => ({ src, alt: alt || '', caption: caption || '', link: link || '' })),
                keyInsights: keyInsights.map(({ insightText }) => ({ insightText })),
                relatedArticleIds
            };
            const currentDataStr = JSON.stringify(currentData);

            if (currentDataStr !== lastSavedData) {
                autoSave(currentData, currentDataStr);
            }
        }, 30000); // 30 second debounce

        return () => clearTimeout(timer);
    }, [title, body, shortDescription, mainImage, readTime, tags, type, images, keyInsights, relatedArticleIds, initialLoadDone, isEditMode, saving, submitting, stagedArticleStatus, lastSavedData]);

    const autoSave = async (payload, payloadStr) => {
        try {
            // Simplified payload for backend structure (mapping related IDs to flat fields)
            const backendPayload = {
                ...payload,
                relatedArticle1Id: payload.relatedArticleIds[0] || null,
                relatedArticle2Id: payload.relatedArticleIds[1] || null,
                relatedArticle3Id: payload.relatedArticleIds[2] || null,
                relatedArticle4Id: payload.relatedArticleIds[3] || null,
            };
            delete backendPayload.relatedArticleIds;

            await api.put(`/cms/staged/${id}`, backendPayload);
            setLastSavedData(payloadStr);
            setLastAutoSavedAt(new Date());
        } catch (err) {
            console.error('Auto-save failed', err);
        }
    };


    // Tag handlers
    const handleAddTag = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };


    // Save draft to staged articles table
    const handleSaveDraft = async () => {
        setSaving(true);
        setStatus('Saving draft...');
        setStatusType('');
        // Replace any blob: URLs in the TipTap HTML with the real S3 keys
        const cleanBody = replaceBlobsWithKeys(body, images);
        const payload = {
            title, body: cleanBody, shortDescription, mainImage, readTime, tags, type,
            images: images.map(({ src, alt, caption, link }) => ({ 
                src, 
                alt: alt || '', 
                caption: caption || '',
                link: link || ''
            })),
            keyInsights: keyInsights.map(({ insightText }) => ({ insightText })),
            relatedArticle1Id: relatedArticleIds[0] || null,
            relatedArticle2Id: relatedArticleIds[1] || null,
            relatedArticle3Id: relatedArticleIds[2] || null,
            relatedArticle4Id: relatedArticleIds[3] || null,
        };
        try {
            if (isEditMode && stagedArticleStatus !== null) {
                await api.put(`/cms/staged/${id}`, payload);
                setStatus('Draft saved');
                setStatusType('success');
            } else {
                const res = await api.post('/cms/staged', payload);
                navigate(`/editor/${res.data.id}`, { replace: true });
                setStatus('Draft created');
                setStatusType('success');
                setLastSavedData(JSON.stringify({
                    title, body: cleanBody, shortDescription, mainImage, readTime, tags, type,
                    images: images.map(({ src, alt, caption, link }) => ({ src, alt: alt || '', caption: caption || '', link: link || '' })),
                    keyInsights: keyInsights.map(({ insightText }) => ({ insightText })),
                    relatedArticleIds
                }));
            }
            if (isEditMode) {
                setLastSavedData(JSON.stringify({
                    title, body: cleanBody, shortDescription, mainImage, readTime, tags, type,
                    images: images.map(({ src, alt, caption, link }) => ({ src, alt: alt || '', caption: caption || '', link: link || '' })),
                    keyInsights: keyInsights.map(({ insightText }) => ({ insightText })),
                    relatedArticleIds
                }));
            }
        } catch (err) {
            console.error(err);
            setStatus('Error saving draft');
            setStatusType('error');
        } finally {
            setSaving(false);
        }
    };

    // Submit staged article for editor review
    const handleSubmitForReview = async () => {
        if (!title.trim()) {
            setStatus('Title is required before submitting.');
            setStatusType('error');
            return;
        }
        setSubmitting(true);
        setStatus('Submitting...');
        setStatusType('');
        try {
            const cleanBody = replaceBlobsWithKeys(body, images);
            const payload = {
                title, body: cleanBody, shortDescription, mainImage, readTime, tags, type,
                images: images.map(({ src, alt, caption, link }) => ({ 
                    src, 
                    alt: alt || '', 
                    caption: caption || '',
                    link: link || ''
                })),
                keyInsights: keyInsights.map(({ insightText }) => ({ insightText })),
                relatedArticle1Id: relatedArticleIds[0] || null,
                relatedArticle2Id: relatedArticleIds[1] || null,
                relatedArticle3Id: relatedArticleIds[2] || null,
                relatedArticle4Id: relatedArticleIds[3] || null,
            };
            let articleId = id;

            if (!isEditMode || stagedArticleStatus === null) {
                const res = await api.post('/cms/staged', payload);
                articleId = res.data.id;
                await api.put(`/cms/staged/${articleId}/submit`);
                navigate(`/editor/${articleId}`, { replace: true });
            } else if (['DRAFT', 'NEEDS_CHANGES'].includes(stagedArticleStatus)) {
                await api.put(`/cms/staged/${id}`, payload);
                await api.put(`/cms/staged/${id}/submit`);
            } else {
                await api.put(`/cms/staged/${id}/submit`);
            }

            setStagedArticleStatus('SUBMITTED');
            setEditorNote(null);
            setStatus('Submitted for review ✓');
            setStatusType('success');
        } catch (err) {
            console.error(err);
            setStatus(err.response?.data?.message || 'Error submitting');
            setStatusType('error');
        } finally {
            setSubmitting(false);
        }
    };

    // Legacy: direct save to published articles table (kept for admin use)
    const handleSave = async () => {
        if (!title.trim()) {
            setStatus('Title is required');
            setStatusType('error');
            return;
        }
        setSaving(true);
        setStatus('Saving...');
        setStatusType('');
        const payload = {
            id: isEditMode ? id : draftId,
            title, shortDescription, body, type, tags,
            timestampDate, readTime, mainImage,
            images: images.map(({ src, alt, caption, link }) => ({ 
                src, 
                alt: alt || '', 
                caption: caption || '',
                link: link || ''
            })),
            keyInsights, relatedNews,
            currentTimestamp: isEditMode ? currentTimestamp : undefined
        };

        try {
            if (isEditMode) {
                const res = await api.put(`/api/articles/${id}`, payload);
                setCurrentTimestamp(res.data.timestampDate);
                setStatus('Saved successfully');
                setStatusType('success');
            } else {
                const res = await api.post('/api/articles', payload);
                navigate(`/editor/${res.data.id}`);
                setStatus('Created successfully');
                setStatusType('success');
            }
        } catch (err) {
            console.error(err);
            if (err.response?.status === 409) {
                setStatus('Conflict: Article modified elsewhere. Refresh.');
                setStatusType('error');
            } else {
                setStatus('Error saving');
                setStatusType('error');
            }
        } finally {
            setSaving(false);
        }
    };

    if (!isEditMode && !draftId) {
        return (
            <div className="min-h-screen bg-bg-primary flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
                    <p className="text-text-secondary font-medium">Initializing new article...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg-primary">
            {/* Top bar */}
            <header className="sticky top-0 z-40 bg-bg-secondary/80 backdrop-blur-xl border-b border-border">
                <div className="max-w-screen-2xl mx-auto px-6 flex items-center justify-between h-14">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors bg-transparent border-none cursor-pointer text-sm"
                    >
                        <HiOutlineArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>

                    <div className="flex items-center gap-3">
                        {lastAutoSavedAt && !status && (
                            <span className="text-[10px] text-text-tertiary bg-bg-tertiary/50 px-2 py-1 rounded-md border border-border/50">
                                Auto-saved at {lastAutoSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        )}

                        {status && (
                            <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                                statusType === 'success' ? 'bg-success/10 text-success' :
                                statusType === 'error' ? 'bg-danger/10 text-danger' :
                                'bg-bg-tertiary text-text-secondary'
                            }`}>
                                {status}
                            </span>
                        )}

                        {/* Staged workflow buttons */}
                        <button
                            onClick={handleSaveDraft}
                            disabled={saving || stagedArticleStatus === 'SUBMITTED' || stagedArticleStatus === 'PUBLISHED'}
                            className="flex items-center gap-2 border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 px-4 py-2 rounded-full font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <><div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />Saving...</>
                            ) : (
                                <><HiOutlineCloudUpload className="w-4 h-4" />Save Draft</>
                            )}
                        </button>

                        <button
                            onClick={handleSubmitForReview}
                            disabled={submitting || stagedArticleStatus === 'SUBMITTED' || stagedArticleStatus === 'PUBLISHED'}
                            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded-full font-semibold text-sm transition-all shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
                            ) : (
                                <><HiOutlinePaperAirplane className="w-4 h-4" />
                                {stagedArticleStatus === 'SUBMITTED' ? 'Awaiting Review' : 'Submit for Review'}</>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Editor Note Banner — shown when editor sent feedback */}
            {editorNote && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4">
                    <div className="max-w-screen-2xl mx-auto flex items-start gap-3">
                        <HiOutlineExclamationCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-amber-400 font-semibold text-sm">Editor Feedback — Changes Requested</p>
                            <p className="text-amber-300/80 text-sm mt-0.5 leading-relaxed">{editorNote}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-screen-2xl mx-auto flex">
                {/* Main Editor */}
                <div className="flex-1 min-w-0 px-6 lg:px-12 py-8 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 56px)' }}>
                    {/* Title */}
                    <input
                        type="text"
                        placeholder="Article Headline..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full text-4xl font-extrabold bg-transparent border-none outline-none text-text-primary placeholder-text-tertiary mb-4 leading-tight"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                    />

                    {/* Short Description */}
                    <textarea
                        placeholder="Write a short description for this article..."
                        value={shortDescription}
                        onChange={(e) => setShortDescription(e.target.value)}
                        rows={2}
                        className="w-full text-lg bg-transparent border-none outline-none text-text-secondary placeholder-text-tertiary resize-none mb-8 leading-relaxed"
                    />

                    {/* WYSIWYG Editor */}
                    <div className="flex flex-col gap-2 mb-8">
                        <label className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                            Article Body
                        </label>
                        <div className="border border-border rounded-xl">
                            {initialLoadDone ? (
                                <TipTapEditor key={id} ref={editorRef} content={body} onUpdate={(html) => setBody(html)} onImageUploadRequest={handleTipTapImageUpload} />
                            ) : (
                                <div className="min-h-[500px] flex items-center justify-center text-text-tertiary">Loading editor...</div>
                            )}
                        </div>
                    </div>

                    {/* Image sections */}
                    <div className="mt-10 space-y-8">
                        {/* Main Image */}
                        <div className="border border-border rounded-xl p-6 bg-bg-secondary/30">
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
                                Cover Image
                            </h3>
                            <div className="relative">
                                {mainImagePreview ? (
                                    <div className="relative group">
                                        <img
                                            src={mainImagePreview}
                                            alt="Main"
                                            className="w-full max-h-80 object-cover rounded-lg border border-border"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                            <label className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg cursor-pointer text-sm font-medium hover:bg-white/30 transition-colors border border-white/20">
                                                Replace Image
                                                <input type="file" hidden accept="image/*" onChange={handleMainImageUpload} />
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent/50 transition-colors group">
                                        <HiOutlineCloudUpload className="w-10 h-10 text-text-tertiary group-hover:text-accent transition-colors mb-3" />
                                        <span className="text-sm text-text-tertiary group-hover:text-text-secondary transition-colors font-medium">
                                            Click to upload cover image
                                        </span>
                                        <span className="text-xs text-text-tertiary mt-1">JPG, PNG, WebP supported</span>
                                        <input type="file" hidden accept="image/*" onChange={handleMainImageUpload} />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Gallery */}
                        <div className="border border-border rounded-xl p-6 bg-bg-secondary/30">
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
                                Gallery Images (Added via Editor)
                            </h3>
                            {images.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                                    {images.map((img, idx) => (
                                        <div key={idx} className="bg-bg-secondary border border-border rounded-lg p-3 space-y-2">
                                            {img.previewUrl || img.src ? (
                                                <img src={img.previewUrl || img.src} alt="" className="w-full h-24 object-cover rounded-md" />
                                            ) : (
                                                <div className="w-full h-24 bg-bg-tertiary rounded-md flex items-center justify-center text-text-tertiary text-xs">Waiting for sync</div>
                                            )}
                                            <input
                                                placeholder="Caption"
                                                value={img.caption || ''}
                                                onChange={(e) => {
                                                    const copy = [...images]; copy[idx].caption = e.target.value; setImages(copy);
                                                }}
                                                className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
                                            />
                                            <input
                                                placeholder="Alt Text"
                                                value={img.alt || ''}
                                                onChange={(e) => {
                                                    const copy = [...images]; copy[idx].alt = e.target.value; setImages(copy);
                                                }}
                                                className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
                                            />
                                            <input
                                                placeholder="Link"
                                                value={img.link || ''}
                                                onChange={(e) => {
                                                    const copy = [...images]; copy[idx].link = e.target.value; setImages(copy);
                                                }}
                                                className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent mb-1"
                                            />
                                            <button
                                                onClick={() => {
                                                    // Remove from TipTap editor body
                                                    if (editorRef.current && img.previewUrl) {
                                                        editorRef.current.removeImageBySrc(img.previewUrl);
                                                    }
                                                    // Remove from gallery state
                                                    const c = [...images];
                                                    c.splice(idx, 1);
                                                    setImages(c);
                                                }}
                                                className="w-full py-1.5 text-xs text-danger bg-transparent border border-border rounded-md hover:bg-danger/10 hover:border-danger/30 transition-colors"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-text-tertiary">All images uploaded inside your article body will automatically appear here to modify definitions.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <aside className="hidden lg:block w-80 xl:w-96 border-l border-border bg-bg-secondary/40 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 56px)' }}>
                    <div className="p-6 space-y-6">
                        {/* Type */}
                        <div>
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                                Article Type
                            </label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full px-4 py-3 bg-bg-tertiary border border-transparent rounded-xl text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all cursor-pointer"
                            >
                                <option value="">Select Type</option>
                                {ARTICLE_TYPES.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                                Tags
                            </label>
                            {tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {tags.map(t => (
                                        <span
                                            key={t}
                                            onClick={() => setTags(tags.filter(tag => tag !== t))}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-bg-tertiary text-text-secondary border border-transparent hover:border-danger/30 hover:text-danger hover:bg-danger/5 cursor-pointer transition-all"
                                        >
                                            {t}
                                            <HiOutlineX className="w-3 h-3" />
                                        </span>
                                    ))}
                                </div>
                            )}
                            <input
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                placeholder="Type tag & press Enter"
                                className="w-full px-4 py-3 bg-bg-tertiary border border-transparent rounded-xl text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                            />
                        </div>

                        {/* Publish Date */}
                        <div>
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                                Publish Date
                            </label>
                            <input
                                type="datetime-local"
                                value={timestampDate}
                                onChange={(e) => setTimestampDate(e.target.value)}
                                className="w-full px-4 py-3 bg-bg-tertiary border border-transparent rounded-xl text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                            />
                        </div>

                        {/* Read Time */}
                        <div>
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                                Read Time
                            </label>
                            <input
                                value={readTime}
                                onChange={(e) => setReadTime(e.target.value)}
                                placeholder="e.g. 5 min"
                                className="w-full px-4 py-3 bg-bg-tertiary border border-transparent rounded-xl text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                            />
                        </div>

                        {/* Key Insights */}
                        <div>
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                                Key Insights
                            </label>
                            <div className="space-y-2">
                                {keyInsights.map((k, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center mt-2.5 flex-shrink-0">
                                            {i + 1}
                                        </span>
                                        <input
                                            value={k.insightText}
                                            onChange={(e) => {
                                                const copy = [...keyInsights];
                                                copy[i].insightText = e.target.value;
                                                setKeyInsights(copy);
                                            }}
                                            placeholder={`Insight ${i + 1}`}
                                            className="flex-1 px-4 py-2.5 bg-bg-tertiary border border-transparent rounded-lg text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-accent transition-all"
                                        />
                                        <button
                                            onClick={() => {
                                                const c = [...keyInsights]; c.splice(i, 1); setKeyInsights(c);
                                            }}
                                            className="mt-2.5 p-1 text-text-tertiary hover:text-danger transition-colors bg-transparent border-none"
                                        >
                                            <HiOutlineTrash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => setKeyInsights([...keyInsights, { insightText: '' }])}
                                className="mt-2 w-full py-2.5 text-xs font-medium text-text-tertiary border border-dashed border-border rounded-lg hover:text-text-secondary hover:border-accent/50 transition-colors bg-transparent"
                            >
                                + Add Insight
                            </button>
                        </div>

                        {/* Related Articles */}
                        <div>
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                                Related Articles (up to 4)
                            </label>
                            <p className="text-xs text-text-tertiary mb-3 leading-relaxed">
                                Paste a published article ID (e.g. <code className="bg-bg-tertiary px-1 rounded">article-42</code>) for each slot.
                            </p>
                            <div className="space-y-2">
                                {relatedArticleIds.map((articleId, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0">
                                            {i + 1}
                                        </span>
                                        <input
                                            value={articleId}
                                            onChange={(e) => {
                                                const copy = [...relatedArticleIds];
                                                copy[i] = e.target.value.trim();
                                                setRelatedArticleIds(copy);
                                            }}
                                            placeholder={`Article ID (slot ${i + 1})`}
                                            className="flex-1 px-3 py-2 bg-bg-tertiary border border-transparent rounded-lg text-text-primary text-xs placeholder-text-tertiary focus:outline-none focus:border-accent transition-all font-mono"
                                        />
                                        {articleId && (
                                            <button
                                                onClick={() => {
                                                    const copy = [...relatedArticleIds];
                                                    copy[i] = '';
                                                    setRelatedArticleIds(copy);
                                                }}
                                                className="p-1 text-text-tertiary hover:text-danger transition-colors bg-transparent border-none"
                                            >
                                                <HiOutlineX className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default ArticleEditor;
