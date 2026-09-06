// Delay before each retry. Four gaps between five attempts (the schema's
// default max_attempts): fails fast at first, then backs off toward an hour.
const BACKOFF_MS = [
  60 * 1000, // gap before attempt 2
  5 * 60 * 1000, // gap before attempt 3
  15 * 60 * 1000, // gap before attempt 4
  60 * 60 * 1000, // gap before attempt 5
];

// `attempts` is the post-increment count (i.e. the attempt that just
// failed). Returns the next retry Date, or null once attempts has reached
// maxAttempts — the caller should treat null as "stop retrying, mark failed".
function nextRetryAt({ attempts, maxAttempts, now = new Date() }) {
  if (attempts >= maxAttempts) {
    return null;
  }
  const index = Math.min(attempts - 1, BACKOFF_MS.length - 1);
  return new Date(now.getTime() + BACKOFF_MS[index]);
}

module.exports = {
  BACKOFF_MS,
  nextRetryAt,
};
