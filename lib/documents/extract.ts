import 'server-only';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';

const MAX_TEXT = 80000;

export async function extractDocumentText(buffer: Buffer, contentType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  let text = '';
  if (contentType === 'application/pdf' || lower.endsWith('.pdf')) {
    const { default: pdfParse } = await import('pdf-parse');
    const parsed = await pdfParse(buffer, { max: 25 });
    text = parsed.text;
  } else if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lower.endsWith('.docx')) {
    const parsed = await mammoth.extractRawText({ buffer });
    text = parsed.value;
  } else if (contentType.startsWith('image/') || /\.(png|jpe?g)$/i.test(lower)) {
    const worker = await Tesseract.createWorker('eng', 1);
    try {
      const result = await worker.recognize(buffer);
      text = result.data.text;
    } finally {
      await worker.terminate();
    }
  } else {
    throw new Error('Unsupported document type.');
  }
  return text.replace(/\u0000/g, '').trim().slice(0, MAX_TEXT);
}
