// Client-facing estimate PDF: English, A4 portrait, in the style of the Coralsoft
// presentations (dark page, coral accents, mono labels, every table row in a box).

import { readFileSync } from "node:fs";
import {
  Circle,
  Defs,
  Document,
  Font,
  Image,
  LinearGradient,
  Page,
  Polygon,
  RadialGradient,
  Rect,
  renderToBuffer,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Estimate, Hours } from "@/lib/domain/estimate";
import { ASSETS, formatHoursEn, formatUsd, pdfModel, WORDMARK, type PdfLine } from "./common";

// A Buffer, not a path: on Windows react-pdf takes `D:\…` for a URL and tries to fetch it.
let logo: { data: Buffer; format: "png" } | null = null;

let registered = false;
function registerFonts() {
  if (registered) return;
  Font.register({
    family: "Onest",
    fonts: [
      { src: ASSETS.onestRegular, fontWeight: 400 },
      { src: ASSETS.onestMedium, fontWeight: 500 },
      { src: ASSETS.onestSemiBold, fontWeight: 600 },
    ],
  });
  Font.register({
    family: "Mono",
    fonts: [
      { src: ASSETS.monoRegular, fontWeight: 400 },
      { src: ASSETS.monoMedium, fontWeight: 500 },
    ],
  });
  // Keep words whole; the default hyphenation is English-only.
  Font.registerHyphenationCallback((word) => [word]);
  logo = { data: readFileSync(ASSETS.logo), format: "png" };
  registered = true;
}

// Sampled from the presentation template.
const C = {
  bg: "#1d1d1d",
  coral: "#fe754e",
  peach: "#ffba9e",
  white: "#f4f4f2",
  text2: "#a3a3a0",
  muted: "#7c7c79",
  line: "#363636",
  box: "#242424",
  boxLine: "#323232",
  phaseBox: "#2c2220",
  phaseLine: "#5b3a2f",
  phaseNum: "#f2b7a1",
};

const W = 595.28;
const H = 841.89;
const PAD_X = 44;
const HOURS_COL = 68;
const LOGO_HEIGHT = 17;
const LOGO_WIDTH = (LOGO_HEIGHT * 242) / 68;

const label = { fontFamily: "Mono", fontSize: 7, letterSpacing: 1.6, lineHeight: 1.2 } as const;

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, color: C.white, fontFamily: "Onest", fontSize: 9.5, paddingTop: 92, paddingBottom: 78, paddingHorizontal: PAD_X },
  header: { position: "absolute", top: 34, left: PAD_X, right: PAD_X, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLabel: { ...label, color: C.coral },
  footer: { position: "absolute", top: H - 58, left: PAD_X, right: PAD_X, borderTopWidth: 0.75, borderTopColor: C.line, paddingTop: 12, flexDirection: "row", justifyContent: "space-between" },
  footerText: { ...label, fontSize: 6.5, color: C.muted },

  eyebrow: { ...label, color: C.coral, fontSize: 7.5 },
  client: { fontSize: 34, fontWeight: 500, lineHeight: 1.15, marginTop: 10, letterSpacing: -0.6 },
  project: { fontSize: 15, color: C.text2, lineHeight: 1.3, marginTop: 6 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 18 },
  pill: { borderWidth: 0.75, borderColor: "#3d3d3d", borderRadius: 11, paddingVertical: 4.5, paddingHorizontal: 10 },
  pillAccent: { borderColor: "#7a3f2e", backgroundColor: "#33231e" },
  pillText: { ...label, fontSize: 6.5, color: "#c2c2bf" },

  scope: { marginTop: 20, backgroundColor: C.box, borderWidth: 0.75, borderColor: C.boxLine, borderLeftWidth: 2, borderLeftColor: C.coral, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
  scopeText: { fontSize: 11.5, lineHeight: 1.5, marginTop: 6 },

  cards: { flexDirection: "row", gap: 10, marginTop: 22 },
  card: { flex: 1, backgroundColor: C.box, borderWidth: 0.75, borderColor: C.boxLine, borderRadius: 10, padding: 14 },
  cardMain: { backgroundColor: "#2e221e", borderColor: C.coral },
  cardLabel: { ...label, fontSize: 6.5, color: C.muted },
  cardHours: { fontSize: 24, fontWeight: 500, lineHeight: 1.15, marginTop: 10 },
  cardUnit: { fontSize: 11, color: C.text2, fontWeight: 400 },
  cardCost: { fontSize: 11.5, fontWeight: 500, color: C.coral, marginTop: 6, lineHeight: 1.2 },
  cardHint: { ...label, fontSize: 5.8, color: C.muted, marginTop: 8 },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 500, lineHeight: 1.2 },
  colHead: { flexDirection: "row", paddingHorizontal: 12, marginBottom: 6 },
  colHeadText: { ...label, fontSize: 6, color: C.muted },

  row: { flexDirection: "row", alignItems: "center", backgroundColor: C.box, borderWidth: 0.75, borderColor: C.boxLine, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 5 },
  phase: { flexDirection: "row", alignItems: "center", backgroundColor: C.phaseBox, borderWidth: 0.75, borderColor: C.phaseLine, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginTop: 7, marginBottom: 5 },
  phaseNum: { ...label, fontSize: 7.5, color: C.coral, width: 22 },
  phaseName: { fontSize: 13, fontWeight: 600, lineHeight: 1.25 },
  feature: { fontSize: 10, fontWeight: 500, lineHeight: 1.35 },
  notes: { fontSize: 8.5, color: C.text2, lineHeight: 1.4, marginTop: 2 },
  hours: { width: HOURS_COL, textAlign: "right", fontFamily: "Mono", fontSize: 9, lineHeight: 1.2 },

  total: { marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: C.coral, backgroundColor: "#33231e", paddingHorizontal: 12 },
  totalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  costRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 0.75, borderTopColor: "#5b3a2f" },
  totalLabel: { fontSize: 14, fontWeight: 600, lineHeight: 1.2 },
  costLabel: { fontSize: 9.5, color: C.text2, lineHeight: 1.2 },
  costValue: { width: HOURS_COL, textAlign: "right", fontSize: 10, fontWeight: 600, color: C.coral, lineHeight: 1.2 },

  note: { fontSize: 8, color: C.muted, lineHeight: 1.5, marginTop: 18 },

  steps: { marginTop: 30, flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 16 },
  // Three per row; more steps wrap onto the next row.
  step: { width: (W - 2 * PAD_X - 20) / 3, borderTopWidth: 0.75, borderTopColor: C.line, paddingTop: 12 },
  stepNum: { ...label, color: C.coral, fontSize: 7.5 },
  stepTitle: { fontSize: 11.5, fontWeight: 500, lineHeight: 1.3, marginTop: 8 },
  stepText: { fontSize: 8.5, color: C.text2, lineHeight: 1.45, marginTop: 3 },
});

const hexagon = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

/** Page background: gradient strip, warm glows and faint line art. */
function Backdrop() {
  const dots = [];
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 9; col++) dots.push({ x: W - PAD_X - col * 11, y: 120 + row * 11 });
  return (
    <View fixed style={{ position: "absolute", top: 0, left: 0, width: W, height: H }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="strip" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={C.coral} />
            <Stop offset="0.35" stopColor={C.peach} />
            <Stop offset="0.7" stopColor="#593f37" />
            <Stop offset="1" stopColor={C.bg} />
          </LinearGradient>
          <RadialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={C.coral} stopOpacity={0.2} />
            <Stop offset="1" stopColor={C.coral} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glowSoft" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={C.coral} stopOpacity={0.09} />
            <Stop offset="1" stopColor={C.coral} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={C.bg} />
        <Circle cx={W - 30} cy={20} r={280} fill="url(#glow)" />
        <Circle cx={-20} cy={H - 40} r={260} fill="url(#glowSoft)" />
        {/* Hexagons echo the logo mark. */}
        <Polygon points={hexagon(W - 40, 250, 150)} stroke={C.coral} strokeOpacity={0.09} strokeWidth={1} fill="none" />
        <Polygon points={hexagon(W - 40, 250, 105)} stroke={C.coral} strokeOpacity={0.06} strokeWidth={1} fill="none" />
        <Circle cx={36} cy={H - 140} r={70} stroke="#ffffff" strokeOpacity={0.04} strokeWidth={0.75} fill="none" />
        <Circle cx={36} cy={H - 140} r={110} stroke="#ffffff" strokeOpacity={0.035} strokeWidth={0.75} fill="none" />
        <Circle cx={36} cy={H - 140} r={150} stroke="#ffffff" strokeOpacity={0.03} strokeWidth={0.75} fill="none" />
        {dots.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={0.9} fill="#ffffff" fillOpacity={0.14} />
        ))}
        <Rect x={0} y={0} width={W} height={4} fill="url(#strip)" />
      </Svg>
    </View>
  );
}

function Pill({ children, accent }: { children: string; accent?: boolean }) {
  return (
    <View style={accent ? [s.pill, s.pillAccent] : s.pill}>
      <Text style={accent ? [s.pillText, { color: C.coral }] : s.pillText}>{children.toUpperCase()}</Text>
    </View>
  );
}

function SummaryCard({ title, hours, cost, main, hint }: { title: string; hours: number; cost: number | null; main?: boolean; hint: string }) {
  return (
    <View style={main ? [s.card, s.cardMain] : s.card}>
      <Text style={main ? [s.cardLabel, { color: C.coral }] : s.cardLabel}>{title}</Text>
      <Text style={s.cardHours}>
        {formatHoursEn(hours)}
        <Text style={s.cardUnit}> h</Text>
      </Text>
      {cost !== null && <Text style={s.cardCost}>{formatUsd(cost)}</Text>}
      <Text style={s.cardHint}>{hint}</Text>
    </View>
  );
}

function HoursCells({ h, strong }: { h: { optimistic: number | null; pessimistic: number | null; realistic: number | null }; strong?: boolean }) {
  const dim = { color: strong ? C.phaseNum : C.text2 };
  const main = { color: strong ? C.white : C.white, fontWeight: 500 };
  return (
    <>
      <Text style={[s.hours, dim]}>{formatHoursEn(h.optimistic)}</Text>
      <Text style={[s.hours, dim]}>{formatHoursEn(h.pessimistic)}</Text>
      <Text style={[s.hours, main]}>{formatHoursEn(h.realistic)}</Text>
    </>
  );
}

function Line({ line }: { line: PdfLine }) {
  if (line.kind === "phase") {
    return (
      <View style={s.phase} wrap={false} minPresenceAhead={60}>
        <Text style={s.phaseNum}>{String(line.number).padStart(2, "0")}</Text>
        <Text style={[s.phaseName, { flex: 1 }]}>{line.feature}</Text>
        <HoursCells h={line.subtotal} strong />
      </View>
    );
  }
  return (
    <View style={s.row} wrap={false}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={s.feature}>{line.feature || "—"}</Text>
        {line.notes.trim() !== "" && <Text style={s.notes}>{line.notes}</Text>}
      </View>
      <HoursCells h={line} />
    </View>
  );
}

function EstimatePdf({ estimate }: { estimate: Estimate }) {
  const m = pdfModel(estimate);
  const cost = (k: keyof Hours) => (m.cost ? m.cost[k] : null);
  const title = [m.client, m.project].filter(Boolean).join(" — ");

  return (
    <Document title={`Estimate — ${title}`} author={WORDMARK} creator={WORDMARK} producer={WORDMARK}>
      <Page size="A4" style={s.page}>
        <Backdrop />

        <View style={s.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image src={logo!} style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }} />
          <Text style={s.headerLabel}>PROJECT ESTIMATE</Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>CORALSOFT · ESTIMATE FOR {m.client.toUpperCase()}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
            }
          />
        </View>

        <Text style={s.eyebrow}>ESTIMATE FOR</Text>
        <Text style={s.client}>{m.client}</Text>
        {m.project && <Text style={s.project}>{m.project}</Text>}

        <View style={s.pills}>
          <Pill accent>{m.date}</Pill>
          {m.rate !== null && <Pill>{`Rate ${formatUsd(m.rate)}/h`}</Pill>}
          <Pill>{`${m.featureCount} ${m.featureCount === 1 ? "feature" : "features"}`}</Pill>
          <Pill>{`${formatHoursEn(m.total.realistic)} h realistic`}</Pill>
        </View>

        {m.jobTitle && (
          <View style={s.scope}>
            <Text style={[label, { color: C.coral, fontSize: 6.5 }]}>SCOPE</Text>
            <Text style={s.scopeText}>{m.jobTitle}</Text>
          </View>
        )}

        <View style={s.cards}>
          <SummaryCard title="OPTIMISTIC" hours={m.total.optimistic} cost={cost("optimistic")} hint="BEST CASE" />
          <SummaryCard title="REALISTIC" hours={m.total.realistic} cost={cost("realistic")} hint="MOST LIKELY" main />
          <SummaryCard title="PESSIMISTIC" hours={m.total.pessimistic} cost={cost("pessimistic")} hint="WITH RISKS" />
        </View>

        <View style={s.sectionHead} minPresenceAhead={120}>
          <Text style={s.sectionTitle}>Scope breakdown</Text>
          <Text style={[label, { color: C.coral, fontSize: 6.5 }]}>HOURS PER FEATURE</Text>
        </View>
        <View style={s.colHead}>
          <Text style={[s.colHeadText, { flex: 1 }]}>FEATURE</Text>
          <Text style={[s.colHeadText, { width: HOURS_COL, textAlign: "right" }]}>OPTIMISTIC</Text>
          <Text style={[s.colHeadText, { width: HOURS_COL, textAlign: "right" }]}>PESSIMISTIC</Text>
          <Text style={[s.colHeadText, { width: HOURS_COL, textAlign: "right" }]}>REALISTIC</Text>
        </View>

        {m.lines.map((line, i) => (
          <Line key={i} line={line} />
        ))}

        <View style={s.total} wrap={false}>
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { flex: 1 }]}>Total</Text>
            <Text style={[s.hours, { fontSize: 10.5, fontWeight: 500 }]}>{formatHoursEn(m.total.optimistic)}</Text>
            <Text style={[s.hours, { fontSize: 10.5, fontWeight: 500 }]}>{formatHoursEn(m.total.pessimistic)}</Text>
            <Text style={[s.hours, { fontSize: 10.5, fontWeight: 500 }]}>{formatHoursEn(m.total.realistic)}</Text>
          </View>
          {m.cost && (
            <View style={s.costRow}>
              <Text style={[s.costLabel, { flex: 1 }]}>Cost at {formatUsd(m.rate)}/h</Text>
              <Text style={s.costValue}>{formatUsd(m.cost.optimistic)}</Text>
              <Text style={s.costValue}>{formatUsd(m.cost.pessimistic)}</Text>
              <Text style={s.costValue}>{formatUsd(m.cost.realistic)}</Text>
            </View>
          )}
        </View>

        <Text style={s.note}>
          Hours are estimates based on the information available at the time of writing. The final scope and timeline
          are confirmed after a discovery call.
        </Text>

        <View wrap={false} minPresenceAhead={100}>
          <View style={[s.sectionHead, { marginTop: 34 }]}>
            <Text style={s.sectionTitle}>Next steps</Text>
            <Text style={[label, { color: C.coral, fontSize: 6.5 }]}>HOW WE START</Text>
          </View>
          <View style={[s.steps, { marginTop: 4 }]}>
            {m.nextSteps.map((step, i) => (
              <View key={step.id} style={s.step}>
                <Text style={s.stepNum}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={s.stepTitle}>{step.title}</Text>
                {step.text !== "" && <Text style={s.stepText}>{step.text}</Text>}
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function buildEstimatePdf(estimate: Estimate): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<EstimatePdf estimate={estimate} />);
}
