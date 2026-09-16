'use client';

import { useEffect, useRef } from 'react';

// A minimal contentEditable-based editor rather than a full WYSIWYG
// library — this only ever needs to produce bold/italic/links/lists for
// two branding fields, which document.execCommand still handles fine
// despite being a "deprecated" API (every major browser keeps it working
// for exactly this kind of basic case). The HTML it produces is
// re-sanitized server-side before it's ever stored (see
// apps/api/src/settings/rich-text.util.ts) — this component doesn't need
// to be trusted on its own.
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  // Only push external value changes into the DOM while NOT focused —
  // otherwise every keystroke's onChange->prop->effect round trip would
  // reset the cursor to the start of the field.
  useEffect(() => {
    if (ref.current && !focused.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    onChange(ref.current?.innerHTML ?? '');
  }

  function onLink() {
    const url = window.prompt('Link URL (https://…)');
    if (!url) return;
    exec('createLink', url);
  }

  return (
    <div className="rounded border border-slate-300 focus-within:border-slate-400">
      <div className="flex gap-1 border-b border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('bold')}
          className="rounded px-2 py-1 text-sm font-bold hover:bg-slate-200"
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('italic')}
          className="rounded px-2 py-1 text-sm italic hover:bg-slate-200"
          title="Italic"
        >
          i
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onLink}
          className="rounded px-2 py-1 text-sm underline hover:bg-slate-200"
          title="Insert link"
        >
          Link
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('insertUnorderedList')}
          className="rounded px-2 py-1 text-sm hover:bg-slate-200"
          title="Bullet list"
        >
          • List
        </button>
        <span className="mx-1 w-px bg-slate-200" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('justifyLeft')}
          className="rounded px-2 py-1 text-sm hover:bg-slate-200"
          title="Align left"
        >
          ⟸
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('justifyCenter')}
          className="rounded px-2 py-1 text-sm hover:bg-slate-200"
          title="Align center"
        >
          ⟺
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('justifyRight')}
          className="rounded px-2 py-1 text-sm hover:bg-slate-200"
          title="Align right"
        >
          ⟹
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        data-placeholder={placeholder}
        className="min-h-[70px] px-3 py-1.5 text-sm outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
