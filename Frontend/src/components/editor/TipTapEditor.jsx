import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import EditorToolbar from './EditorToolbar';
import '../../styles/editor.css';

const TipTapEditor = forwardRef(({ content, onUpdate, onImageUploadRequest }, ref) => {
    const isReady = useRef(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Markdown.configure({
                html: false,
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
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-accent underline hover:text-accent-hover',
                },
            }),
        ],
        content: content || '',
        onUpdate: ({ editor }) => {
            const markdown = editor.storage.markdown.getMarkdown();
            onUpdate(markdown);
        },
        editorProps: {
            attributes: {
                class: 'tiptap-content prose prose-invert max-w-none focus:outline-none',
            },
        },
    });

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

    useEffect(() => {
        if (editor && !isReady.current && content) {
            editor.commands.setContent(content);
            isReady.current = true;
        }
    }, [editor, content]);

    return (
        <div className="border border-border rounded-xl flex flex-col bg-bg-secondary w-full">
            <EditorToolbar editor={editor} onImageUploadRequest={onImageUploadRequest} />
            <div className="relative flex-1 bg-bg-secondary rounded-b-xl overflow-hidden min-h-[500px]">
                <EditorContent 
                    editor={editor} 
                    className="absolute inset-0 overflow-y-auto px-6 py-6"
                />
            </div>
        </div>
    );
});

TipTapEditor.displayName = 'TipTapEditor';

export default TipTapEditor;
