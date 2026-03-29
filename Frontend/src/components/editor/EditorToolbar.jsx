import React from 'react';
import {
    LuBold,
    LuItalic,
    LuUnderline,
    LuStrikethrough,
    LuHeading1,
    LuHeading2,
    LuHeading3,
    LuList,
    LuListOrdered,
    LuQuote,
    LuUndo2,
    LuRedo2,
    LuMinus,
    LuLink,
    LuImage,
} from 'react-icons/lu';

const ToolButton = ({ onClick, isActive, title, children }) => (
    <button
        type="button"
        onClick={(e) => { e.preventDefault(); onClick(); }}
        title={title}
        className={`p-2 rounded-lg transition-all border-none cursor-pointer ${
            isActive
                ? 'bg-accent/15 text-accent'
                : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60'
        }`}
    >
        {children}
    </button>
);

const Divider = () => (
    <div className="w-px h-6 bg-border mx-1" />
);

const EditorToolbar = ({ editor, onImageUploadRequest }) => {
    const fileInputRef = React.useRef(null);

    if (!editor) return null;

    const handleLinkToggle = () => {
        if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
        } else {
            const url = window.prompt('Enter URL:');
            if (url) {
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }
        }
    };

    const handleImageInsert = () => {
        if (onImageUploadRequest) {
            fileInputRef.current?.click();
        } else {
            const url = window.prompt('Enter Image URL:');
            if (url) {
                editor.chain().focus().setImage({ src: url }).run();
            }
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (file && onImageUploadRequest) {
            try {
                const url = await onImageUploadRequest(file);
                if (url) {
                    editor.chain().focus().setImage({ src: url }).run();
                }
            } catch (err) {
                console.error(err);
            }
        }
        if (e.target) e.target.value = '';
    };

    return (
        <div className="flex flex-wrap items-center gap-0.5 px-4 py-2.5 border-b border-border bg-bg-secondary/60 rounded-t-xl">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{display: 'none'}} />
            {/* Text formatting */}
            <ToolButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Bold (Ctrl+B)"
            >
                <LuBold className="w-4 h-4" />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Italic (Ctrl+I)"
            >
                <LuItalic className="w-4 h-4" />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
                title="Strikethrough"
            >
                <LuStrikethrough className="w-4 h-4" />
            </ToolButton>

            <Divider />

            {/* Headings */}
            <ToolButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Heading 1"
            >
                <LuHeading1 className="w-4 h-4" />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Heading 2"
            >
                <LuHeading2 className="w-4 h-4" />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="Heading 3"
            >
                <LuHeading3 className="w-4 h-4" />
            </ToolButton>

            <Divider />

            {/* Lists */}
            <ToolButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet List"
            >
                <LuList className="w-4 h-4" />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Numbered List"
            >
                <LuListOrdered className="w-4 h-4" />
            </ToolButton>

            <Divider />

            {/* Block elements */}
            <ToolButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Blockquote"
            >
                <LuQuote className="w-4 h-4" />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                isActive={false}
                title="Horizontal Rule"
            >
                <LuMinus className="w-4 h-4" />
            </ToolButton>
            <ToolButton
                onClick={handleLinkToggle}
                isActive={editor.isActive('link')}
                title="Insert Link"
            >
                <LuLink className="w-4 h-4" />
            </ToolButton>

            <Divider />

            {/* Image Insertion */}
            <ToolButton
                onClick={handleImageInsert}
                isActive={false}
                title="Insert Image (from URL)"
            >
                <LuImage className="w-4 h-4" />
            </ToolButton>

            <Divider />

            {/* Undo/Redo */}
            <ToolButton
                onClick={() => editor.chain().focus().undo().run()}
                isActive={false}
                title="Undo (Ctrl+Z)"
            >
                <LuUndo2 className="w-4 h-4" />
            </ToolButton>
            <ToolButton
                onClick={() => editor.chain().focus().redo().run()}
                isActive={false}
                title="Redo (Ctrl+Y)"
            >
                <LuRedo2 className="w-4 h-4" />
            </ToolButton>
        </div>
    );
};

export default EditorToolbar;
