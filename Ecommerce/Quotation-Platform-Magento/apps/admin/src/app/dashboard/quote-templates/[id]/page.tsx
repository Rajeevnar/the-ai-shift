'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '../../../../lib/api';
import { useDialog } from '../../../../lib/dialog';
import { ItemLibraryItem, QuoteTemplateFull, QuoteTemplateLineItem } from '../../../../lib/types';
import { ItemPickerModal } from '../../../../components/ItemPickerModal';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function QuoteTemplateBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const { confirmDialog } = useDialog();
  const [template, setTemplate] = useState<QuoteTemplateFull | null>(null);
  const [itemLibrary, setItemLibrary] = useState<ItemLibraryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // Which section's "add from library" modal is open, if any — one shared
  // piece of state rather than per-section local state, since sections are
  // rendered inline in a .map() here (unlike the quote builder, which has
  // a dedicated SectionCard component to hold that state itself).
  const [pickerOpenForSection, setPickerOpenForSection] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<QuoteTemplateFull>(`/quote-templates/${id}`)
      .then(setTemplate)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, [id]);

  useEffect(() => {
    load();
    api.get<ItemLibraryItem[]>('/item-library').then(setItemLibrary).catch(() => setItemLibrary([]));
  }, [load]);

  async function withSaveState(fn: () => Promise<void>) {
    setSaveState('saving');
    setError(null);
    try {
      await fn();
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch (err) {
      setSaveState('error');
      setError(err instanceof ApiError ? err.message : 'Something went wrong — change may not have saved.');
    }
  }

  function renameTemplate(name: string) {
    return withSaveState(async () => {
      await api.patch(`/quote-templates/${id}`, { name });
      load();
    });
  }

  function addSection() {
    return withSaveState(async () => {
      await api.post(`/quote-templates/${id}/sections`, { title: 'New section' });
      load();
    });
  }

  function updateSectionTitle(sectionId: string, title: string) {
    return withSaveState(async () => {
      await api.patch(`/quote-templates/${id}/sections/${sectionId}`, { title });
      load();
    });
  }

  async function removeSection(sectionId: string) {
    const ok = await confirmDialog('Remove this section and all its line items?', { confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    return withSaveState(async () => {
      await api.delete(`/quote-templates/${id}/sections/${sectionId}`);
      load();
    });
  }

  function addLineItem(sectionId: string, itemLibraryItemId?: string) {
    return withSaveState(async () => {
      await api.post(
        `/quote-templates/${id}/sections/${sectionId}/line-items`,
        itemLibraryItemId ? { itemLibraryItemId } : { description: 'New item', quantity: 1, unitPrice: 0, vatRate: 20 },
      );
      load();
    });
  }

  function commitLineItem(sectionId: string, lineItemId: string, patch: Record<string, unknown>) {
    return withSaveState(async () => {
      await api.patch(`/quote-templates/${id}/sections/${sectionId}/line-items/${lineItemId}`, patch);
      load();
    });
  }

  async function removeLineItem(sectionId: string, lineItemId: string) {
    const ok = await confirmDialog('Remove this line item?', { confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    return withSaveState(async () => {
      await api.delete(`/quote-templates/${id}/sections/${sectionId}/line-items/${lineItemId}`);
      load();
    });
  }

  if (error && !template) return <p className="text-red-700">{error}</p>;
  if (!template) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/quote-templates" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Back to Templates
      </Link>
      <div className="mb-1 flex items-center justify-between">
        <TitleField value={template.name} onCommit={renameTemplate} />
        <SaveIndicator state={saveState} />
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Reference prices here are defaults — every quote created from this template recalculates its own totals.
      </p>
      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-6">
        {template.sections.map((section) => (
          <div key={section.id} className="rounded-lg border border-slate-200 bg-white p-4">
            {pickerOpenForSection === section.id && (
              <ItemPickerModal
                items={itemLibrary}
                onSelect={(item) => {
                  addLineItem(section.id, item.id);
                  setPickerOpenForSection(null);
                }}
                onClose={() => setPickerOpenForSection(null)}
              />
            )}
            <div className="mb-3 flex items-center justify-between">
              <TitleField
                value={section.title}
                onCommit={(title) => updateSectionTitle(section.id, title)}
                className="font-medium"
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => removeSection(section.id)}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                Remove section
              </button>
            </div>

            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400">
                <tr>
                  <th className="pb-1 font-medium">Description</th>
                  <th className="w-16 pb-1 font-medium">Qty</th>
                  <th className="w-24 pb-1 font-medium">Price</th>
                  <th className="w-16 pb-1 font-medium">VAT %</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {section.lineItems.map((li) => (
                  <TemplateLineItemRow
                    key={li.id}
                    lineItem={li}
                    onCommit={(patch) => commitLineItem(section.id, li.id, patch)}
                    onRemove={() => removeLineItem(section.id, li.id)}
                  />
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-2">
              <button type="button" onClick={() => addLineItem(section.id)} className="text-sm text-slate-500 hover:text-slate-800">
                + Add line
              </button>
              {itemLibrary.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPickerOpenForSection(section.id)}
                  className="text-sm text-slate-500 hover:text-slate-800"
                >
                  + Add from library…
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSection}
        className="mt-4 rounded border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        + Add section
      </button>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  const text = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : 'Not saved';
  const color = state === 'error' ? 'text-red-600' : 'text-slate-400';
  return <span className={`text-xs ${color}`}>{text}</span>;
}

function TitleField({ value, onCommit, className = 'text-2xl font-semibold' }: { value: string; onCommit: (v: string) => void; className?: string }) {
  const [local, setLocal] = useState(value);
  return (
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && local.trim() && onCommit(local)}
      className={`w-full rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-400 focus:outline-none ${className}`}
    />
  );
}

function TemplateLineItemRow({
  lineItem,
  onCommit,
  onRemove,
}: {
  lineItem: QuoteTemplateLineItem;
  onCommit: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const [local, setLocal] = useState({
    description: lineItem.description,
    quantity: lineItem.quantity,
    unitPrice: lineItem.unitPrice,
    vatRate: lineItem.vatRate,
  });

  function field(name: keyof typeof local, numeric = false) {
    return {
      value: local[name],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLocal((l) => ({ ...l, [name]: e.target.value })),
      onBlur: () => {
        const value = local[name];
        if (value === String((lineItem as unknown as Record<string, unknown>)[name])) return;
        onCommit({ [name]: numeric ? Number(value) : value });
      },
    };
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="py-1 pr-2">
        <input {...field('description')} className="w-full rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-400 focus:outline-none" />
      </td>
      <td className="py-1 pr-2">
        <input type="number" step="1" {...field('quantity', true)} className="w-16 rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-400 focus:outline-none" />
      </td>
      <td className="py-1 pr-2">
        <input type="number" step="0.1" {...field('unitPrice', true)} className="w-24 rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-400 focus:outline-none" />
      </td>
      <td className="py-1 pr-2">
        <input type="number" step="0.1" {...field('vatRate', true)} className="w-16 rounded border border-transparent px-1 py-0.5 hover:border-slate-200 focus:border-slate-400 focus:outline-none" />
      </td>
      <td className="py-1 text-right">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onRemove} className="text-xs text-slate-300 hover:text-red-600">
          ✕
        </button>
      </td>
    </tr>
  );
}
