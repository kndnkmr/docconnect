// ============================================
// LoadingBlock - Centered loading state for page/tab content
// ============================================
// A small, consistent "content is loading" block to replace the bare
//   <div className="text-center py-8 text-gray-600">Loading...</div>
// scattered across dashboard sub-components. It reuses the existing Spinner
// (same visual language as the login/signup buttons) so loading states look
// consistent app-wide, and reads as polished rather than plain grey text.
//
// Purely presentational — no state, no logic. Drop it in anywhere a section
// is waiting on data.

import Spinner from './Spinner';

function LoadingBlock({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-gray-500 ${className}`}>
      <Spinner size={28} className="text-primary-500" />
      {label && <p className="mt-3 text-sm">{label}</p>}
    </div>
  );
}

export default LoadingBlock;
