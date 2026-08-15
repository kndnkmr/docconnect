// ============================================
// Reusable Modal Component
// ============================================
// Replaces window.confirm and window.prompt with a styled modal.
//
// USAGE:
//   <ConfirmModal open={show} title="Cancel?" message="Are you sure?" onConfirm={fn} onCancel={fn} />
//   <PromptModal open={show} title="Rate" fields={[{name:'rating',label:'Stars',type:'number'}]} onSubmit={fn} onCancel={fn} />

import { useState, useEffect } from 'react';

// ---- Backdrop + wrapper shared by all modals ----
function ModalWrapper({ open, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal content */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in">
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
//   fields: [{ name, label, type ('text'|'number'|'textarea'|'select'), placeholder, required, options (for select), min, max }]
//   submitText, cancelText
//   onSubmit(values), onCancel()

export function PromptModal({
  open,
  title = 'Input',
  description = '',
  extraContent = null,
  fields = [],
  submitText = 'Submit',
  cancelText = 'Cancel',
  onSubmit,
  onCancel
}) {
  const [values, setValues] = useState({});

  // Reset values when modal opens
  useEffect(() => {
    if (open) {
      const initial = {};
      fields.forEach(f => { initial[f.name] = f.defaultValue || ''; });
      setValues(initial);
    }
  }, [open]);

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <ModalWrapper open={open} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
        {description && <p className="text-gray-500 text-sm mb-4">{description}</p>}

        {/* Optional reference/context block above the form fields — e.g.
            a patient's previous prescriptions when writing a new one. */}
        {extraContent}

        <div className="space-y-4 mb-6">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}{field.required && ' *'}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  value={values[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder || ''}
                  required={field.required}
                  rows={field.rows || 3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none text-sm"
                />
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

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
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
