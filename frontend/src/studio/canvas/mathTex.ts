type MathJaxGlobal = any;

let loader: Promise<MathJaxGlobal> | null = null;

function mathjax(): Promise<MathJaxGlobal> {
  if (!loader) {
    (window as unknown as { MathJax?: unknown }).MathJax = {
      tex: { packages: { '[+]': ['ams'] } },
      svg: { fontCache: 'none' },
      startup: { typeset: false },
    };
    loader = import('mathjax/es5/tex-svg.js').then(() => {
      const MJ = (window as unknown as { MathJax: MathJaxGlobal }).MathJax;
      return MJ.startup.promise.then(() => MJ);
    });
  }
  return loader;
}

const PX_PER_EX = 10;

export interface RenderedTex {
  dataURL: string;
  width: number;
  height: number;
}

export async function texToSvgDataUrl(tex: string, color = '#1e1e2e'): Promise<RenderedTex> {
  const MJ = await mathjax();
  const container = MJ.tex2svg(tex, { display: true });
  const svg = container.querySelector('svg') as SVGSVGElement | null;
  if (!svg || svg.querySelector('[data-mjx-error]')) {
    throw new Error('MathJax could not render this LaTeX.');
  }
  const width = (parseFloat(svg.getAttribute('width') ?? '8') || 8) * PX_PER_EX;
  const height = (parseFloat(svg.getAttribute('height') ?? '3') || 3) * PX_PER_EX;
  svg.setAttribute('width', `${width}px`);
  svg.setAttribute('height', `${height}px`);
  svg.setAttribute('color', color);
  const xml = new XMLSerializer().serializeToString(svg);
  const dataURL = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
  return { dataURL, width, height };
}
