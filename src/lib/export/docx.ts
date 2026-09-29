import { CharacterSet, Document, Packer, Paragraph, TextRun } from "docx";
import type { ContractDetail } from "@/lib/domain/types";
import { exportModel, FONT_FAMILY, readFont, WORDMARK } from "./common";

const SIZE = 21; // half-points: 10.5 pt

/** Text with its line breaks preserved exactly. */
function lines(text: string, options: { bold?: boolean; size?: number } = {}): TextRun[] {
  return text.split(/\r?\n/).map(
    (line, i) => new TextRun({ text: line, break: i > 0 ? 1 : undefined, font: FONT_FAMILY, size: options.size ?? SIZE, bold: options.bold }),
  );
}

const para = (children: TextRun[], spacingAfter = 120) => new Paragraph({ children, spacing: { after: spacingAfter } });

export async function buildContractDocx(contract: ContractDetail): Promise<Buffer> {
  const m = exportModel(contract);
  const heading = (text: string) => para(lines(text, { bold: true, size: 26 }), 80);

  const children: Paragraph[] = [
    para([new TextRun({ text: WORDMARK, font: FONT_FAMILY, size: 16, bold: true, characterSpacing: 20 })], 360),
    para(lines(m.title, { bold: true, size: 32 }), 200),
    ...m.meta.map((row) =>
      para(
        [
          new TextRun({ text: `${row.label}: `, font: FONT_FAMILY, size: SIZE, bold: true }),
          new TextRun({ text: row.value, font: FONT_FAMILY, size: SIZE }),
        ],
        60,
      ),
    ),
    para([], 200),
  ];

  for (const s of m.sections) {
    children.push(heading(s.heading));
    children.push(para(s.body ? lines(s.body) : lines("—"), 280));
  }

  children.push(heading("Коментарі"));
  if (m.comments.length === 0) children.push(para(lines("—")));
  for (const c of m.comments) {
    children.push(para([new TextRun({ text: c.when, font: FONT_FAMILY, size: 18, bold: true })], 40));
    children.push(para(lines(c.body), 200));
  }

  const doc = new Document({
    creator: WORDMARK,
    title: m.title,
    fonts: [
      { name: FONT_FAMILY, data: readFont("regular"), characterSet: CharacterSet.RUSSIAN },
    ],
    styles: { default: { document: { run: { font: FONT_FAMILY, size: SIZE } } } },
    sections: [
      {
        properties: {
          page: {
            // A4 in twips, 2 cm margins.
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
