import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import PDFDocument from "pdfkit";

import type { CoverLetterResult, TailoredResume } from "@job-copilot/contracts";

function pdfBuffer(write: (document: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({
      autoFirstPage: true,
      bufferPages: true,
      margins: { top: 50, right: 54, bottom: 50, left: 54 },
      info: { Producer: "Job Copilot" },
    });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
    write(document);
    document.end();
  });
}

export function renderResumePdf(resume: TailoredResume): Promise<Buffer> {
  return pdfBuffer((document) => {
    if (resume.name !== undefined) {
      document.font("Helvetica-Bold").fontSize(18).text(resume.name, { align: "center" });
      document.moveDown(0.6);
    }
    if (resume.summary !== undefined) {
      document.font("Helvetica-Bold").fontSize(11).text("Summary");
      document.font("Helvetica").fontSize(10).text(resume.summary.text);
      document.moveDown(0.5);
    }
    for (const section of resume.sections) {
      document.font("Helvetica-Bold").fontSize(11).text(section.heading.toLocaleUpperCase());
      for (const bullet of section.bullets) {
        document.font("Helvetica").fontSize(10).text(`• ${bullet.text}`, { indent: 10 });
      }
      document.moveDown(0.5);
    }
  });
}

export async function renderResumeDocx(resume: TailoredResume): Promise<Buffer> {
  const children: Paragraph[] = [];
  if (resume.name !== undefined) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: resume.name, bold: true, size: 32 })],
      }),
    );
  }
  if (resume.summary !== undefined) {
    children.push(new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph(resume.summary.text));
  }
  for (const section of resume.sections) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2 }));
    for (const bullet of section.bullets) {
      children.push(new Paragraph({ text: bullet.text, bullet: { level: 0 } }));
    }
  }
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

export function renderCoverLetterPdf(letter: CoverLetterResult): Promise<Buffer> {
  return pdfBuffer((document) => {
    if (letter.recipient !== undefined) {
      document.font("Helvetica").fontSize(10).text(letter.recipient);
      document.moveDown(0.5);
    }
    if (letter.subject !== undefined) {
      document.font("Helvetica-Bold").fontSize(11).text(letter.subject);
      document.moveDown(0.8);
    }
    for (const paragraph of letter.paragraphs) {
      document.font("Helvetica").fontSize(10).text(paragraph.text);
      document.moveDown(0.8);
    }
  });
}

export async function renderCoverLetterDocx(letter: CoverLetterResult): Promise<Buffer> {
  const children = [
    ...(letter.recipient === undefined ? [] : [new Paragraph(letter.recipient)]),
    ...(letter.subject === undefined
      ? []
      : [
          new Paragraph({
            children: [new TextRun({ text: letter.subject, bold: true })],
          }),
        ]),
    ...letter.paragraphs.map(({ text }) => new Paragraph({ text, spacing: { after: 200 } })),
  ];
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
