import { fileURLToPath } from 'url';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import * as storage from './storageProvider.js';

const PURPLE = '#4c1d95';
const PURPLE_LIGHT = '#6d28d9';
const GOLD = '#c99a2e';
const INK = '#1f2937';
const GREY = '#6b7280';

const LOGO_PATH = fileURLToPath(new URL('../assets/logo.png', import.meta.url));

/**
 * Render a branded Certificate of Completion PDF and persist it (R2 when
 * configured, else local disk). Returns its public URL.
 *
 * Design: A4 landscape, double purple/gold frame, embedded logo, elegant serif
 * (Times) typography, the recipient's name on a gold rule, a wax-style seal and
 * a Director signature line, plus issue date + verifiable certificate id.
 */
export async function renderCertificatePdf({ certificate, baseUrl }) {
  const filename = `${certificate.code}.pdf`;

  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { width, height } = doc.page;
    const cx = width / 2;

    // ── Frame ───────────────────────────────────────────────────────────────
    doc.rect(0, 0, width, height).fill('#ffffff');
    doc.lineWidth(5).strokeColor(PURPLE).rect(22, 22, width - 44, height - 44).stroke();
    doc.lineWidth(1).strokeColor(GOLD).rect(32, 32, width - 64, height - 64).stroke();

    // Gold corner accents
    const corner = (x, y, dx, dy) => {
      doc.lineWidth(2).strokeColor(GOLD);
      doc.moveTo(x, y).lineTo(x + dx, y).stroke();
      doc.moveTo(x, y).lineTo(x, y + dy).stroke();
    };
    corner(44, 44, 34, 34);
    corner(width - 44, 44, -34, 34);
    corner(44, height - 44, 34, -34);
    corner(width - 44, height - 44, -34, -34);

    // ── Logo ────────────────────────────────────────────────────────────────
    const logoW = 250;
    try {
      if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, cx - logoW / 2, 58, { width: logoW });
      }
    } catch {
      /* logo optional — continue without it */
    }

    // ── Title ─────────────────────────────────────────────────────────────
    doc
      .fillColor(GOLD)
      .font('Times-Bold')
      .fontSize(26)
      .text('Certificate of Completion', 0, 150, { align: 'center', characterSpacing: 1 });

    // Divider
    doc.lineWidth(1).strokeColor(GOLD)
      .moveTo(cx - 90, 188).lineTo(cx + 90, 188).stroke();

    // ── Body ──────────────────────────────────────────────────────────────
    doc
      .fillColor(GREY)
      .font('Times-Italic')
      .fontSize(13)
      .text('This is to certify that', 0, 206, { align: 'center' });

    // Recipient name on a gold rule
    doc
      .fillColor(PURPLE)
      .font('Times-Bold')
      .fontSize(34)
      .text(certificate.userName || 'Student', 0, 226, { align: 'center' });
    const nameW = Math.min(
      doc.widthOfString(certificate.userName || 'Student', { font: 'Times-Bold', size: 34 }) + 60,
      width - 200
    );
    doc.lineWidth(1).strokeColor(GOLD)
      .moveTo(cx - nameW / 2, 272).lineTo(cx + nameW / 2, 272).stroke();

    doc
      .fillColor(GREY)
      .font('Times-Italic')
      .fontSize(13)
      .text('has successfully completed the course', 0, 284, { align: 'center' });

    doc
      .fillColor(INK)
      .font('Times-Bold')
      .fontSize(20)
      .text(certificate.courseTitle || '', 80, 306, { align: 'center', width: width - 160 });

    // ── Seal ──────────────────────────────────────────────────────────────
    const sealX = cx;
    const sealY = 402;
    doc.lineWidth(2).strokeColor(GOLD).circle(sealX, sealY, 34).stroke();
    doc.lineWidth(0.8).strokeColor(GOLD).circle(sealX, sealY, 27).stroke();
    doc
      .fillColor(PURPLE)
      .font('Times-Bold')
      .fontSize(15)
      .text('FE', sealX - 20, sealY - 13, { width: 40, align: 'center' });
    doc
      .fillColor(GOLD)
      .font('Helvetica-Bold')
      .fontSize(6)
      .text('CERTIFIED', sealX - 30, sealY + 6, { width: 60, align: 'center', characterSpacing: 1 });

    // ── Signature + meta ──────────────────────────────────────────────────
    const issued = new Date(certificate.issuedAt).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // Date (left) and Director signature (right)
    const baseY = height - 96;
    doc.lineWidth(1).strokeColor('#9ca3af')
      .moveTo(90, baseY).lineTo(250, baseY).stroke();
    doc.fillColor(GREY).font('Helvetica').fontSize(10)
      .text(issued, 90, baseY + 6, { width: 160, align: 'center' })
      .text('Date of Issue', 90, baseY + 20, { width: 160, align: 'center' });

    doc.lineWidth(1).strokeColor('#9ca3af')
      .moveTo(width - 250, baseY).lineTo(width - 90, baseY).stroke();
    doc.fillColor(PURPLE).font('Times-BoldItalic').fontSize(15)
      .text('Formation Exceptionelle', width - 250, baseY - 22, { width: 160, align: 'center' });
    doc.fillColor(GREY).font('Helvetica').fontSize(10)
      .text('Director', width - 250, baseY + 6, { width: 160, align: 'center' })
      .text('Formation Exceptionelle', width - 250, baseY + 20, { width: 160, align: 'center' });

    // Certificate id (centered footer) — verifiable
    doc.fillColor(GREY).font('Helvetica').fontSize(9)
      .text(`Certificate ID: ${certificate.code}`, 0, height - 52, { align: 'center' });
    doc.fillColor('#9ca3af').font('Helvetica').fontSize(8)
      .text('Verify authenticity at formationexceptionelle.com', 0, height - 40, { align: 'center' });

    doc.end();
  });

  return storage.saveBuffer({
    buffer,
    key: storage.keyFor('certificates', filename),
    contentType: 'application/pdf',
    baseUrl,
  });
}
