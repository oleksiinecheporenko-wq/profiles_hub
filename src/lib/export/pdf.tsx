import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ContractDetail } from "@/lib/domain/types";
import { exportModel, FONT_FAMILY, FONT_FILES, WORDMARK } from "./common";

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

const styles = StyleSheet.create({
  page: { fontFamily: FONT_FAMILY, fontSize: 10.5, color: "#000", backgroundColor: "#fff", padding: 56, lineHeight: 1.45 },
  wordmark: { fontSize: 8, fontWeight: 700, letterSpacing: 1, marginBottom: 24 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 12 },
  metaRow: { flexDirection: "row", marginBottom: 3 },
  metaLabel: { fontWeight: 700, width: 130 },
  metaValue: { flex: 1 },
  heading: { fontSize: 12.5, fontWeight: 700, marginTop: 18, marginBottom: 6 },
  body: {},
  commentWhen: { fontSize: 9, fontWeight: 700, marginTop: 8 },
});

function ContractPdf({ contract }: { contract: ContractDetail }) {
  const m = exportModel(contract);
  return (
    <Document title={m.title} creator={WORDMARK} producer={WORDMARK}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.wordmark}>{WORDMARK}</Text>
        <Text style={styles.title}>{m.title}</Text>
        <View>
          {m.meta.map((row) => (
            <View key={row.label} style={styles.metaRow}>
              <Text style={styles.metaLabel}>{row.label}</Text>
              <Text style={styles.metaValue}>{row.value}</Text>
            </View>
          ))}
        </View>
        {m.sections.map((s) => (
          <View key={s.heading}>
            <Text style={styles.heading}>{s.heading}</Text>
            {/* Text keeps "\n" as line breaks. */}
            <Text style={styles.body}>{s.body ?? "—"}</Text>
          </View>
        ))}
        <Text style={styles.heading}>Коментарі</Text>
        {m.comments.length === 0 ? (
          <Text>—</Text>
        ) : (
          m.comments.map((c, i) => (
            <View key={i} wrap={false}>
              <Text style={styles.commentWhen}>{c.when}</Text>
              <Text>{c.body}</Text>
            </View>
          ))
        )}
      </Page>
    </Document>
  );
}

export async function buildContractPdf(contract: ContractDetail): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ContractPdf contract={contract} />);
}
