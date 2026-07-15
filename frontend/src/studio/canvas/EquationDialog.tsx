import { useState } from 'react';
import { Loader2, Sigma, X } from 'lucide-react';
import { texToSvgDataUrl, type RenderedTex } from './mathTex';

interface Props {
  onInsert: (r: RenderedTex) => void;
  onClose: () => void;
}

export function EquationDialog({ onInsert, onClose }: Props) {
  const [tex, setTex] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insert = () => {
    if (!tex.trim() || busy) return;
    setBusy(true);
    setError(null);
    texToSvgDataUrl(tex.trim()).then(
      (r) => {
        setBusy(false);
        onInsert(r);
      },
      () => {
        setBusy(false);
        setError('Could not render that LaTeX. Check the syntax and try again.');
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30" onClick={onClose}>
      <div
        className="w-[440px] rounded-xl border border-hairline bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Sigma size={16} className="text-brand" />
          <h2 className="font-display text-title-md text-ink">Insert an equation</h2>
          <button onClick={onClose} aria-label="Close" className="ml-auto text-fg-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <textarea
          autoFocus
          rows={3}
          value={tex}
          onChange={(e) => setTex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) insert();
          }}
          placeholder={'LaTeX, e.g.  \\frac{d}{dx} e^{x} = e^{x}'}
          className="mt-3 w-full resize-none rounded-lg border border-hairline bg-canvas px-3 py-2 font-mono text-body-sm text-body outline-none focus:border-brand/50"
        />
        {error && <p className="mt-2 text-caption text-error">{error}</p>}
        <p className="mt-2 text-caption text-fg-soft">
          Rendered as an image you can move, resize, rotate, and reveal like any other element.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-pill border border-hairline px-4 text-button text-body hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={insert}
            disabled={busy || !tex.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand px-4 text-button text-white disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Insert
          </button>
        </div>
      </div>
    </div>
  );
}
