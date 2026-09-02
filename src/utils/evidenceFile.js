// Mirrors ALLOWED_EVIDENCE_MIME_TYPES / MAX_EVIDENCE_FILE_BYTES in
// server/findings/router.cjs and server/caps/router.cjs — kept here so the
// UI can reject an unsupported or oversized file the moment it's selected,
// instead of only finding out after the parent record (follow-up/CAP) has
// already been created and evidence upload fails as a separate step.
export const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

export const MAX_EVIDENCE_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

export const EVIDENCE_FILE_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt';

// Returns a user-facing error string, or null if the file is acceptable.
export function validateEvidenceFile(file) {
  if (!file) {
    return 'No file selected.';
  }
  if (!ALLOWED_EVIDENCE_MIME_TYPES.has(file.type)) {
    return `"${file.name}" is not a supported evidence file type.`;
  }
  if (file.size > MAX_EVIDENCE_FILE_BYTES) {
    return `"${file.name}" exceeds the maximum evidence file size (15 MB).`;
  }
  return null;
}
