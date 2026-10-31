// ============================================
// Reusable Modal Component
// ============================================
// Replaces window.confirm and window.prompt with a styled modal.
//
// USAGE:
//   <ConfirmModal open={show} title="Cancel?" message="Are you sure?" onConfirm={fn} onCancel={fn} />
//   <PromptModal open={show} title="Rate" fields={[{name:'rating',label:'Stars',type:'number'}]} onSubmit={fn} onCancel={fn} />

import { useState, useEffect, useRef } from 'react';
import { loadDraft, saveDraft, clearDraft, savedAgo, DRAFT_TTL } from '../utils/drafts';
import useAutoDraft from '../utils/useAutoDraft';

// ---- Backdrop + wrapper shared by all modals ----
function ModalWrapper({ open, children, onClose, wide = false }) {
  if (!open) return null;

  return (
    // z-[60]: above the sticky navbar, bottom tab bar and WhatsApp button (z-50).
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal content */}
      <div className={`relative bg-white rounded-xl shadow-2xl w-full ${wide ? 'max-w-xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto animate-fade-in`}>
        {children}
      </div>
    </div>
  );
}

// ============================================
// ConfirmModal — replaces window.confirm
// ============================================
// Props:
//   open, title, message, confirmText, cancelText, variant ('danger'|'primary')
//   onConfirm(), onCancel()

export function ConfirmModal({
  open,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel
}) {
  const btnColor = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-primary-600 hover:bg-primary-700';

  return (
    <ModalWrapper open={open} onClose={onCancel}>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${btnColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ============================================
// PromptModal — replaces window.prompt (supports multiple fields)
// ============================================
// Props:
//   open, title, description
//   fields: [{ name, label, type ('text'|'number'|'textarea'|'select'|'custom'), placeholder, required, options (for select), min, max }]
//     type 'custom': render(value, setValue) draws the field; defaultValue can be any value (e.g. an array)
//   submitText, cancelText, wide (wider modal)
//   onSubmit(values), onCancel()

export function PromptModal({
  open,
  title = 'Input',
  description = '',
  extraContent = null,
  fields = [],
  submitText = 'Submit',
  cancelText = 'Cancel',
  wide = false,
  onSubmit,
  onCancel,
  // Optional: keep a draft on this device (e.g. "rx:<appointmentId>") so
  // closing by mistake or a refresh doesn't lose what was typed.
  draftKey = '',
  draftUserId = '',
  draftTtl = DRAFT_TTL.rx,
}) {
  const [values, setValues] = useState({});
  const initialRef = useRef({});
  const [restoredAt, setRestoredAt] = useState(null);
  const [askClose, setAskClose] = useState(false);

  // Reset values when modal opens (from a saved draft, if there is one)
  useEffect(() => {
    if (open) {
      const initial = {};
      fields.forEach(f => { initial[f.name] = f.defaultValue || ''; });
      initialRef.current = initial;
      const d = draftKey ? loadDraft(draftKey, draftUserId, draftTtl) : null;
      setValues(d ? { ...initial, ...d.data } : initial);
      setRestoredAt(d ? d.savedAt : null);
      setAskClose(false);
    }
  }, [open]);

  const dirty = JSON.stringify(values) !== JSON.stringify(initialRef.current);
  useAutoDraft(draftKey, values, { userId: draftUserId, enabled: !!(open && draftKey && dirty) });

  // Backdrop tap / Cancel with unsaved typing: ask instead of throwing it away.
  const requestClose = () => {
    if (draftKey && dirty) setAskClose(true);
    else onCancel();
  };
  const discardDraft = () => {
    if (draftKey) clearDraft(draftKey, draftUserId);
    setRestoredAt(null);
    setAskClose(false);
  };

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <ModalWrapper open={open} onClose={requestClose} wide={wide}>
      <form onSubmit={handleSubmit} className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
        {description && <p className="text-gray-500 text-sm mb-4">{description}</p>}

        {draftKey && restoredAt && (
          <div className="mb-4 p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between gap-3 text-sm" role="status">
            <span className="text-green-800">✓ Draft restored from {savedAgo(restoredAt)}</span>
            <button type="button" onClick={() => { discardDraft(); setValues(initialRef.current); }} className="text-xs text-gray-600 hover:underline whitespace-nowrap">Discard draft</button>
          </div>
        )}

        {/* Optional reference/context block above the form fields — e.g.
            a patient's previous prescriptions when writing a new one. */}
        {extraContent}

        <div className="space-y-4 mb-6">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}{field.required && ' *'}
              </label>

              {field.type === 'custom' ? (
                field.render(values[field.name], (v) => handleChange(field.name, v))
              ) : field.type === 'textarea' ? (
                <>
                  <textarea
                    value={values[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder || ''}
                    required={field.required}
                    rows={field.rows || 3}
                    maxLength={field.maxLength || undefined}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none text-sm"
                  />
                  {field.maxLength && (
                    <p className="text-[11px] text-gray-500 text-right mt-0.5" aria-live="polite">{String(values[field.name] || '').length}/{field.maxLength}</p>
                  )}
                </>
              ) : field.type === 'select' ? (
                <select
                  value={values[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  required={field.required}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                >
                  <option value="">{field.placeholder || 'Select...'}</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  value={values[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder || ''}
                  required={field.required}
                  min={field.min}
                  max={field.max}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                />
              )}
            </div>
          ))}
        </div>

        {askClose && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg" role="alert">
            <p className="text-sm font-medium text-orange-900 mb-2">Keep this draft for later?</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { saveDraft(draftKey, values, draftUserId); setAskClose(false); onCancel(); }} className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">Keep draft</button>
              <button type="button" onClick={() => { discardDraft(); onCancel(); }} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Discard</button>
              <button type="button" onClick={() => setAskClose(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:underline">Keep editing</button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={requestClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            {submitText}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
