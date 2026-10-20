// Client-facing estimate PDF (English, A4, Coralsoft style).

import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Estimate, Hours } from "@/lib/domain/estimate";
import { FONT_FAMILY, FONT_FILES, formatHoursEn, formatUsd, pdfModel, WORDMARK } from "./common";

let registered = false;
function registerFonts() {
  if (registered) return;
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: FONT_FILES.regular, fontWeight: 400 },
      { src: FONT_FILES.bold, fontWeight: 700 },
    ],
  });
  // Keep words whole; the default hyphenation is English-only.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

const CORAL = "#f47b55";
const INK = "#16181d";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const PHASE_BG = "#fdf0eb";
const TOTAL_BG = "#e8f6ee";
const TOTAL_INK = "#17803d";

const COL = { feature: "28%", notes: "33%", hours: "13%" } as const;
/** Feature + Notes, for rows that span both. */
const WIDE = "61%";

const s = StyleSheet.create({
  page: { fontFamily: FONT_FAMILY, fontSize: 9.5, color: INK, backgroundColor: "#fff", paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: CORAL },
  wordmark: { fontSize: 13, fontWeight: 700, letterSpacing: 2 },
  wordmarkDot: { color: CORAL },
  docType: { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: MUTED },
  intro: { marginTop: 22, flexDirection: "row", justifyContent: "space-between" },
  client: { fontSize: 20, fontWeight: 700, lineHeight: 1.25 },
  project: { fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.3 },
  jobTitle: { fontSize: 9.5, marginTop: 8, maxWidth: 340 },
  metaLabel: { fontSize: 7.5, color: MUTED, letterSpacing: 1, textAlign: "right" },
  metaValue: { fontSize: 10, fontWeight: 700, textAlign: "right", marginTop: 2, marginBottom: 8 },
  summary: { flexDirection: "row", marginTop: 22, gap: 10 },
  card: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 12 },
  cardMain: { borderColor: CORAL, backgroundColor: PHASE_BG },
  cardLabel: { fontSize: 7.5, letterSpacing: 1, color: MUTED, fontWeight: 700 },
  cardHours: { fontSize: 17, fontWeight: 700, marginTop: 6, lineHeight: 1.2 },
  cardCost: { fontSize: 10, marginTop: 4, color: MUTED },
  table: { marginTop: 24 },
  headRow: { flexDirection: "row", backgroundColor: INK, color: "#fff", fontWeight: 700, fontSize: 7.5, letterSpacing: 0.3 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  phaseRow: { flexDirection: "row", backgroundColor: PHASE_BG, borderBottomWidth: 1, borderBottomColor: LINE },
  totalRow: { flexDirection: "row", backgroundColor: TOTAL_BG, color: TOTAL_INK, fontWeight: 700 },
  costRow: { flexDirection: "row", backgroundColor: TOTAL_BG, color: TOTAL_INK, borderTopWidth: 1, borderTopColor: "#cfe9d9" },
  cell: { paddingVertical: 6, paddingHorizontal: 7 },
  num: { textAlign: "right" },
  phaseText: { fontSize: 11, fontWeight: 700, lineHeight: 1.3 },
  notes: { color: MUTED },
  note: { marginTop: 18, fontSize: 8, color: MUTED },
  footer: { position: "absolute", bottom: 26, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED },
});

function HoursCells({ h, bold }: { h: { optimistic: number | null; pessimistic: number | null; realistic: number | null }; bold?: boolean }) {
  const style = [s.cell, s.num, { width: COL.hours }, ...(bold ? [{ fontWeight: 700 }] : [])];
  return (
    <>
      <Text style={style}>{formatHoursEn(h.optimistic)}</Text>
      <Text style={style}>{formatHoursEn(h.pessimistic)}</Text>
      <Text style={style}>{formatHoursEn(h.realistic)}</Text>
    </>
  );
}

function SummaryCard({ label, hours, cost, main }: { label: string; hours: number; cost: number | null; main?: boolean }) {
  return (
    <View style={main ? [s.card, s.cardMain] : s.card}>
      <Text style={s.cardLabel}>{label}</Text>
      <Text style={s.cardHours}>{formatHoursEn(hours)} h</Text>
      {cost !== null && <Text style={s.cardCost}>{formatUsd(cost)}</Text>}
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
        <View style={s.header} fixed>
          <Text style={s.wordmark}>
            CORALSOFT<Text style={s.wordmarkDot}>.</Text>
          </Text>
          <Text style={s.docType}>PROJECT ESTIMATE</Text>
        </View>

        <View style={s.intro}>
          <View>
            <Text style={s.client}>{m.client}</Text>
            {m.project && <Text style={s.project}>{m.project}</Text>}
            {m.jobTitle && <Text style={s.jobTitle}>{m.jobTitle}</Text>}
          </View>
          <View>
            <Text style={s.metaLabel}>DATE</Text>
            <Text style={s.metaValue}>{m.date}</Text>
            {m.rate !== null && (
              <>
                <Text style={s.metaLabel}>HOURLY RATE</Text>
                <Text style={s.metaValue}>{formatUsd(m.rate)}/h</Text>
              </>
            )}
          </View>
        </View>

        <View style={s.summary}>
          <SummaryCard label="OPTIMISTIC" hours={m.total.optimistic} cost={cost("optimistic")} />
          <SummaryCard label="REALISTIC" hours={m.total.realistic} cost={cost("realistic")} main />
          <SummaryCard label="PESSIMISTIC" hours={m.total.pessimistic} cost={cost("pessimistic")} />
        </View>

        <View style={s.table}>
          <View style={s.headRow} fixed>
            <Text style={[s.cell, { width: COL.feature }]}>FEATURE</Text>
            <Text style={[s.cell, { width: COL.notes }]}>NOTES</Text>
            <Text style={[s.cell, s.num, { width: COL.hours }]}>OPTIMISTIC (H)</Text>
            <Text style={[s.cell, s.num, { width: COL.hours }]}>PESSIMISTIC (H)</Text>
            <Text style={[s.cell, s.num, { width: COL.hours }]}>REALISTIC (H)</Text>
          </View>

          {m.lines.map((line, i) =>
            line.kind === "phase" ? (
              <View key={i} style={s.phaseRow} wrap={false} minPresenceAhead={40}>
                <Text style={[s.cell, s.phaseText, { width: WIDE }]}>{line.feature}</Text>
                <HoursCells h={line.subtotal} bold />
              </View>
            ) : (
              <View key={i} style={s.row} wrap={false}>
                <Text style={[s.cell, { width: COL.feature }]}>{line.feature || "—"}</Text>
                <Text style={[s.cell, s.notes, { width: COL.notes }]}>{line.notes}</Text>
                <HoursCells h={line} />
              </View>
            ),
          )}

          <View wrap={false}>
            <View style={s.totalRow}>
              <Text style={[s.cell, { width: WIDE, fontSize: 11 }]}>Total</Text>
              <HoursCells h={m.total} bold />
            </View>
            {m.cost && (
              <View style={s.costRow}>
                <Text style={[s.cell, { width: WIDE }]}>Cost at {formatUsd(m.rate)}/h</Text>
                <Text style={[s.cell, s.num, { width: COL.hours, fontWeight: 700 }]}>{formatUsd(m.cost.optimistic)}</Text>
                <Text style={[s.cell, s.num, { width: COL.hours, fontWeight: 700 }]}>{formatUsd(m.cost.pessimistic)}</Text>
                <Text style={[s.cell, s.num, { width: COL.hours, fontWeight: 700 }]}>{formatUsd(m.cost.realistic)}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={s.note}>
          Hours are estimates based on the information available at the time of writing. The final scope and timeline are
          confirmed after a discovery call.
        </Text>

        <View style={s.footer} fixed>
          <Text>Coralsoft · Project estimate · {m.client}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function buildEstimatePdf(estimate: Estimate): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<EstimatePdf estimate={estimate} />);
}
