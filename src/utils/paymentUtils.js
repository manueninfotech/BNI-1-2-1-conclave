/**
 * Payment & UPI Utility Functions
 */

/**
 * Generates a standard UPI deep link URL.
 * Spec: upi://pay?pa=UPI_ID&pn=HOLDER_NAME&am=FEE&tn=NOTE&cu=INR
 */
export function generateUpiUri({ upiId, name = '1-2-1 Connect Conclave', amount = 0, note = 'Conclave Registration' }) {
  if (!upiId) return '';
  const cleanUpiId = String(upiId).trim().replace(/\s+/g, '');
  // Clean alphanumeric name without spaces or special characters for 100% UPI scanner compatibility
  const cleanName = String(name || 'ConnectConclave').replace(/[^a-zA-Z0-9]/g, '').trim() || 'ConnectConclave';
  const numAmount = Number(amount || 0);

  let uri = `upi://pay?pa=${cleanUpiId}&pn=${cleanName}&cu=INR`;
  if (numAmount > 0) {
    uri += `&am=${numAmount}`;
  }
  return uri;
}

/**
 * Generates a high-quality QR code image URL for a given text/payload using QuickChart QR API.
 */
export function generateQrCodeUrl(text, size = 500) {
  if (!text) return '';
  const encodedText = encodeURIComponent(text);
  return `https://quickchart.io/qr?text=${encodedText}&size=${size}&margin=2&ecLevel=H`;
}

/**
 * Launches mobile UPI payment app (Google Pay / PhonePe / Paytm / BHIM) via deep link.
 */
export function triggerUpiPayment(upiUri) {
  if (!upiUri) return;
  window.location.href = upiUri;
}
