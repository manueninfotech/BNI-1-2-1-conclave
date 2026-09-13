/**
 * Utility helper to parse raw text agenda into structured timeline step items.
 */
export function parseAgendaTextToSteps(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const steps = [];

  for (const line of lines) {
    // Match line like "09:30 AM - Registration & Welcome Coffee" or "10:15 AM: Round 1 Networking Seating"
    const match = line.match(/^([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM|am|pm)?|[A-Za-z0-9\s]+(?:Mins|Min|Hours|Hour))\s*[-–—:]\s*(.+)$/i);
    if (match) {
      steps.push({
        time: match[1].trim(),
        title: match[2].trim(),
        desc: `Scheduled for ${match[1].trim()} during the conclave program.`
      });
    } else if (line.toLowerCase().includes('agenda')) {
      // Title header line like "BNI REGIONAL CONCLAVE 2026 AGENDA"
      continue;
    } else {
      steps.push({
        time: 'Program',
        title: line,
        desc: ''
      });
    }
  }

  return steps;
}

/**
 * Utility helper to extract readable text content from base64 PDF Data URLs directly in browser.
 * Optimized with size capping and fast regex scanning to prevent main UI thread blocking.
 */
export function extractTextFromPdfDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.includes(';base64,')) return '';
  try {
    const base64Str = dataUrl.split(';base64,')[1];
    if (!base64Str) return '';

    // Limit base64 scan to first 400KB to avoid freezing the main JS UI thread on large PDF files
    const truncatedBase64 = base64Str.length > 400000 ? base64Str.substring(0, 400000) : base64Str;
    const binaryStr = window.atob(truncatedBase64);
    
    const lines = [];

    // Pattern 1: Fast (Text) Tj matching
    const tjRegex = /\(([^()]{2,150})\)\s*Tj/g;
    let m;
    let count = 0;
    while ((m = tjRegex.exec(binaryStr)) !== null && count < 120) {
      if (m[1]) {
        const cleaned = m[1].replace(/\\([()\\])/g, '$1').trim();
        if (cleaned.length > 2 && !cleaned.startsWith('%PDF') && !cleaned.includes('/Catalog') && !cleaned.includes('endobj')) {
          lines.push(cleaned);
          count++;
        }
      }
    }

    // Pattern 2: Fast TJ array text matching
    if (lines.length === 0) {
      const arrayTjRegex = /\[\s*(?:\(([^()]{2,150})\)\s*|-?\d+\s*)+\]\s*TJ/gi;
      while ((m = arrayTjRegex.exec(binaryStr)) !== null && count < 120) {
        const innerRegex = /\(([^()]+)\)/g;
        let innerMatch;
        const lineParts = [];
        while ((innerMatch = innerRegex.exec(m[0])) !== null) {
          if (innerMatch[1]) {
            const c = innerMatch[1].replace(/\\([()\\])/g, '$1').trim();
            if (c) lineParts.push(c);
          }
        }
        if (lineParts.length > 0) {
          lines.push(lineParts.join(' '));
          count++;
        }
      }
    }

    if (lines.length > 0) {
      const uniqueLines = lines.filter((l, idx) => lines.indexOf(l) === idx);
      return uniqueLines.join('\n');
    }
  } catch (e) {
    console.warn("Could not extract PDF text:", e);
  }
  return '';
}

/**
 * Utility helper to open or download uploaded agenda documents cleanly.
 * Converts base64 Data URLs into Blob URLs so PDF readers and browsers
 * open and download valid binary files without corrupting them.
 */
export function downloadOrViewAgendaDocument(agendaDoc) {
  if (!agendaDoc) return;

  const fileName = agendaDoc.name || 'conclave_agenda.pdf';

  // 1. Prefer base64 dataUrl -> Blob URL for instant binary viewing without backend static 404
  if (agendaDoc.dataUrl && agendaDoc.dataUrl.includes(';base64,')) {
    try {
      const parts = agendaDoc.dataUrl.split(';base64,');
      const mime = parts[0].replace('data:', '') || agendaDoc.type || 'application/pdf';
      const base64Str = parts[1];
      const binaryStr = window.atob(base64Str);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      const win = window.open(blobUrl, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    } catch (e) {
      console.warn("Blob conversion failed, using fallback:", e);
    }
  }

  // 2. Direct physical server static URL on backend
  if (agendaDoc.url && agendaDoc.url.startsWith('/uploads')) {
    const host = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : 'https://conclave-backend.blackpond-26884e90.centralindia.azurecontainerapps.io';
    const backendUrl = `${host}${agendaDoc.url}`;
    const win = window.open(backendUrl, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = backendUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    return;
  }

  // 3. Fallback direct URL handling
  const fileUrl = agendaDoc.url || agendaDoc.dataUrl || '';
  if (fileUrl) {
    window.open(fileUrl, '_blank');
  }
}

/**
 * Dynamically generates a clean, fresh PDF Data URL containing ONLY
 * the newly provided schedule text lines without any previous/old data.
 */
export function createFreshAgendaPdfDataUrl(rawText, conclaveTitle = 'BNI CONCLAVE 2026') {
  const lines = (rawText || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const titleHeader = (conclaveTitle || 'BNI CONCLAVE 2026').toUpperCase().replace(/[()]/g, '');

  const pdfStreamLines = [
    'BT',
    '/F1 20 Tf',
    '0.74 0.11 0.14 rg',
    '50 780 Td',
    `(${titleHeader}) Tj`,
    '0 -24 Td',
    '/F1 14 Tf',
    '0.2 0.2 0.2 rg',
    '(OFFICIAL CONCLAVE PROGRAM AGENDA) Tj',
    '0 -35 Td'
  ];

  lines.forEach((line) => {
    const safeLine = line.replace(/[()]/g, '');
    const isMatch = safeLine.match(/^([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM|am|pm)?|[A-Za-z0-9\s]+(?:Mins|Min|Hours|Hour))\s*[-–—:]\s*(.+)$/i);
    if (isMatch) {
      const timePart = isMatch[1].trim();
      const textPart = isMatch[2].trim();
      pdfStreamLines.push('/F1 11 Tf');
      pdfStreamLines.push('0.74 0.11 0.14 rg');
      pdfStreamLines.push(`(${timePart}) Tj`);
      pdfStreamLines.push('90 0 Td');
      pdfStreamLines.push('/F2 11 Tf');
      pdfStreamLines.push('0.1 0.1 0.1 rg');
      pdfStreamLines.push(`(- ${textPart}) Tj`);
      pdfStreamLines.push('-90 -35 Td');
    } else {
      pdfStreamLines.push('/F2 11 Tf');
      pdfStreamLines.push('0.2 0.2 0.2 rg');
      pdfStreamLines.push(`(${safeLine}) Tj`);
      pdfStreamLines.push('0 -30 Td');
    }
  });

  pdfStreamLines.push('0 -25 Td');
  pdfStreamLines.push('/F2 9 Tf');
  pdfStreamLines.push('0.5 0.5 0.5 rg');
  pdfStreamLines.push(`(Official BNI Conclave Schedule Document) Tj`);
  pdfStreamLines.push('ET');

  const streamBody = pdfStreamLines.join('\n');
  const streamLen = streamBody.length;

  const pdfDoc = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 595 842] /Contents 5 0 R >>
endobj
4 0 obj
<< /Font <<
  /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
  /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
>> >>
endobj
5 0 obj
<< /Length ${streamLen} >>
stream
${streamBody}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000356 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + streamLen}
%%EOF`;

  const base64Str = btoa(unescape(encodeURIComponent(pdfDoc)));
  return `data:application/pdf;base64,${base64Str}`;
}
