// Renders model-generated SVG SAFELY: as an <img> data-URI. Browsers do not
// execute scripts or load external resources for SVG referenced via <img>, so
// this avoids the XSS risk of injecting untrusted SVG into the DOM directly.
export function SvgFigure({ svg }: { svg?: string | null }) {
  const trimmed = svg?.trim();
  if (!trimmed || !trimmed.toLowerCase().includes("<svg")) return null;
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`;
  return (
    <div className="my-3 flex justify-center rounded-lg border border-[#444748]/30 bg-white p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Question figure" className="max-h-72 w-auto" />
    </div>
  );
}
