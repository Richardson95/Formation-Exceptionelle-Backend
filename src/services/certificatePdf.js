import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { uploadRoot } from '../middleware/upload.js';

const PURPLE = '#4c1d95';
const PURPLE_LIGHT = '#7c3aed';
const GOLD = '#f59e0b';

/**
 * Render a certificate PDF to local storage and return its public URL.
 * Swap the write target for S3/Cloudinary in production.
 */
export async function renderCertificatePdf({ certificate, baseUrl }) {
  const dir = path.join(uploadRoot, 'certificates');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${certificate.code}.pdf`;
  const filePath = path.join(dir, filename);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const { width, height } = doc.page;

    // Border
    doc.lineWidth(6).strokeColor(PURPLE).rect(25, 25, width - 50, height - 50).stroke();
    doc.lineWidth(1).strokeColor(GOLD).rect(38, 38, width - 76, height - 76).stroke();

    doc
      .fillColor(PURPLE)
      .fontSize(30)
      .font('Helvetica-Bold')
      .text('Formation Exceptionelle', 0, 80, { align: 'center' });
    doc
      .fillColor(GOLD)
      .fontSize(12)
      .font('Helvetica')
      .text('Your Partner In Career Development', { align: 'center' });

    doc
      .moveDown(2)
      .fillColor('#1f2937')
      .fontSize(20)
      .text('Certificate of Completion', { align: 'center' });

    doc
      .moveDown(1)
      .fontSize(13)
      .fillColor('#6b7280')
      .text('This is to certify that', { align: 'center' });

    doc
      .moveDown(0.5)
      .fillColor(PURPLE_LIGHT)
      .fontSize(28)
      .font('Helvetica-Bold')
      .text(certificate.userName, { align: 'center' });

    doc
      .moveDown(0.8)
      .fillColor('#6b7280')
      .fontSize(13)
      .font('Helvetica')
      .text('has successfully completed the course', { align: 'center' });

    doc
      .moveDown(0.5)
      .fillColor('#1f2937')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(certificate.courseTitle, { align: 'center' });

    const issued = new Date(certificate.issuedAt).toISOString().slice(0, 10);
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#6b7280')
      .text(`Issued: ${issued}`, 60, height - 90, { align: 'left' })
      .text(`Certificate ID: ${certificate.code}`, 0, height - 90, { align: 'right', width: width - 60 });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return `${baseUrl}/uploads/certificates/${filename}`;
}
