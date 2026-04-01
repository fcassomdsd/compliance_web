function createLoginRateLimiter({ windowSeconds, blockSeconds, maxAttempts, now = () => Date.now() }) {
  const attempts = new Map();

  function normalizeKey(ip, username) {
    return `${String(ip || 'unknown').trim().toLowerCase()}::${String(username || '').trim().toLowerCase()}`;
  }

  function getOrInit(key) {
    const current = attempts.get(key);
    const ts = now();
    if (!current || current.windowStart + windowSeconds * 1000 <= ts) {
      const next = {
        count: 0,
        windowStart: ts,
        blockedUntil: 0,
      };
      attempts.set(key, next);
      return next;
    }
    return current;
  }

  function isBlocked(ip, username) {
    const key = normalizeKey(ip, username);
    const state = getOrInit(key);
    return state.blockedUntil > now();
  }

  function registerFailure(ip, username) {
    const key = normalizeKey(ip, username);
    const state = getOrInit(key);
    state.count += 1;
    if (state.count >= maxAttempts) {
      state.blockedUntil = now() + blockSeconds * 1000;
      state.count = 0;
      state.windowStart = now();
    }
    attempts.set(key, state);
  }

  function clear(ip, username) {
    const key = normalizeKey(ip, username);
    attempts.delete(key);
  }

  return {
    isBlocked,
    registerFailure,
    clear,
  };
}

module.exports = {
  createLoginRateLimiter,
};
