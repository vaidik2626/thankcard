import type { SectionLayout } from "@/lib/card/layout";

const INK = "#000000";
const PLACEHOLDER = "#a3a3a3";

/** Renders a positioned section. Every card section component delegates here. */
export function SectionPrimitives({ section, name }: { section?: SectionLayout; name: string }) {
  if (!section) return null;
  return (
    <g data-section={name}>
      {section.images.map((img, i) => (
        <image
          key={`i${i}`}
          x={img.x}
          y={img.y}
          width={img.w}
          height={img.h}
          href={img.href}
          preserveAspectRatio="xMidYMid meet"
        />
      ))}
      {section.rects.map((r, i) => (
        <rect
          key={`r${i}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx={r.r}
          ry={r.r}
          fill="none"
          stroke={r.dashed ? PLACEHOLDER : INK}
          strokeWidth={r.strokeWidth}
          strokeDasharray={r.dashed ? `${r.strokeWidth * 4} ${r.strokeWidth * 3}` : undefined}
        />
      ))}
      {section.qrs.map((q) =>
        q.path ? (
          <g
            key={q.kind}
            data-qr={q.kind}
            transform={`translate(${q.x} ${q.y}) scale(${q.size / q.viewSize})`}
          >
            <rect x={0} y={0} width={q.viewSize} height={q.viewSize} fill="#ffffff" />
            <path d={q.path} fill={INK} shapeRendering="crispEdges" />
          </g>
        ) : null,
      )}
      {section.runs.map((t, i) => (
        <text
          key={`t${i}`}
          x={t.x}
          y={t.y}
          fontFamily={t.family}
          fontSize={t.size}
          fontWeight={t.bold ? "bold" : "normal"}
          fontStyle={t.italic ? "italic" : "normal"}
          fill={t.placeholder ? PLACEHOLDER : INK}
        >
          {t.text}
        </text>
      ))}
      {section.lines.map((l, i) => (
        <rect
          key={`u${i}`}
          x={l.x1}
          y={l.y - l.thickness / 2}
          width={l.x2 - l.x1}
          height={l.thickness}
          fill={INK}
        />
      ))}
    </g>
  );
}
