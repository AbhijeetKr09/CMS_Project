import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import EditorToolbar from './EditorToolbar';
import '../../styles/editor.css';

const TipTapEditor = forwardRef(({ content, onUpdate = () => {}, onImageUploadRequest, editable = true }, ref) => {
    const editor = useEditor({
        editable: editable,
        extensions: [
            StarterKit.configure({
                link: {
                    openOnClick: false,
                    HTMLAttributes: {
                        class: 'text-accent underline hover:text-accent-hover',
                    },
                },
            }),
            Markdown.configure({
                html: true,
                transformPastedText: true,
                transformCopiedText: true,
            }),
            Image.configure({
                inline: false,
                allowBase64: true,
            }),
            Placeholder.configure({
                placeholder: 'Start writing your article here...',
            }),
        ],
        content: content || '',
        onUpdate: ({ editor }) => {
            if (typeof onUpdate === 'function') {
                const markdown = editor.storage.markdown?.getMarkdown() || '';
                onUpdate(markdown);
            }
        },
        editorProps: {
            attributes: {
                class: 'tiptap-content prose prose-invert max-w-none focus:outline-none',
            },
            handlePaste: (view, event, slice) => {
                if (!editable || !onImageUploadRequest) return false;
                const items = Array.from(event.clipboardData?.items || []);
                for (const item of items) {
                    if (item.type.indexOf('image') === 0) {
                        const file = item.getAsFile();
                        if (file) {
                            event.preventDefault();
                            onImageUploadRequest(file).then(url => {
                                if (url) {
                                    const { schema } = view.state;
                                    const node = schema.nodes.image.create({ src: url });
                                    const transaction = view.state.tr.replaceSelectionWith(node);
                                    view.dispatch(transaction);
                                }
                            }).catch(err => console.error(err));
                            return true;
                        }
                    }
                }
                return false;
            },
            handleDrop: (view, event, slice, moved) => {
                if (!editable || !onImageUploadRequest || moved) return false;
                if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                    const file = event.dataTransfer.files[0];
                    if (file.type.indexOf('image') === 0) {
                        event.preventDefault();
                        const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                        if (!coordinates) return false;
                        
                        onImageUploadRequest(file).then(url => {
                            if (url) {
                                const { schema } = view.state;
                                const node = schema.nodes.image.create({ src: url });
                                const transaction = view.state.tr.insert(coordinates.pos, node);
                                view.dispatch(transaction);
                            }
                        }).catch(err => console.error(err));
                        return true;
                    }
                }
                return false;
            }
        },
    });

    const isReady = useRef(false);

    useEffect(() => {
        if (editor && !isReady.current && content) {
            try {
                // Determine if content is HTML or Markdown
                // If it contains tags like <p, <h, <img etc, it's likely HTML
                const isHtml = /<[a-z][\s\S]*>/i.test(content);
                
                if (isHtml) {
                    // Load as HTML
                    editor.commands.setContent(content, false);
                } else {
                    // Load as Markdown
                    let parsedContent = content;
                    if (editor.storage.markdown && editor.storage.markdown.parser) {
                        parsedContent = editor.storage.markdown.parser.parse(content);
                    }
                    editor.commands.setContent(parsedContent, false);
                }
            } catch (err) {
                editor.commands.setContent(content, false);
            }
            isReady.current = true;
        }
    }, [editor, content]);

    // Expose imperative methods to parent via ref
    useImperativeHandle(ref, () => ({
        /**
         * Remove all image nodes whose src matches the given URL/key.
         * Handles both exact match and base-URL match (for signed URLs with query params).
         */
        removeImageBySrc(srcToRemove) {
            if (!editor || !srcToRemove) return;
            const { state, dispatch } = editor.view;
            const { tr, doc } = state;
            const positions = [];

            doc.descendants((node, pos) => {
                if (node.type.name === 'image') {
                    const nodeSrc = node.attrs.src || '';
                    // Match by full URL, or by S3 key substring (strip query params)
                    const baseNodeSrc = nodeSrc.split('?')[0];
                    const baseSrc = srcToRemove.split('?')[0];
                    if (nodeSrc === srcToRemove || baseNodeSrc === baseSrc || nodeSrc === baseSrc) {
                        positions.push({ pos, size: node.nodeSize });
                    }
                }
            });

            // Delete in reverse order so positions remain valid
            let transaction = tr;
            positions.reverse().forEach(({ pos, size }) => {
                transaction = transaction.delete(pos, pos + size);
            });

            if (positions.length > 0) {
                dispatch(transaction);
            }
        },
    }), [editor]);

    return (
        <div className={`border border-border rounded-xl flex flex-col bg-bg-secondary w-full ${!editable ? 'border-none bg-transparent' : ''}`}>
            {editable && <EditorToolbar editor={editor} onImageUploadRequest={onImageUploadRequest} />}
            <div className={`relative flex-1 bg-bg-secondary ${editable ? 'rounded-b-xl min-h-[800px]' : 'bg-transparent h-auto'} overflow-hidden`}>
                <EditorContent 
                    editor={editor} 
                    className={`${editable ? 'absolute inset-0 overflow-y-auto px-6 py-6' : 'px-0 py-2'} min-h-full`}
                />
            </div>
        </div>
    );
});

TipTapEditor.displayName = 'TipTapEditor';

export default TipTapEditor;
