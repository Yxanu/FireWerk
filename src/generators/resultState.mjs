export function normalizeResultState(state = {}) {
  const fingerprints = [...new Set((state.fingerprints || []).filter(Boolean))];

  return {
    count: Number.isFinite(state.count) ? state.count : 0,
    primaryFingerprint: state.primaryFingerprint || null,
    fingerprints
  };
}

export function hasFreshResult(previousState = {}, currentState = {}) {
  const previous = normalizeResultState(previousState);
  const current = normalizeResultState(currentState);

  if (current.count > previous.count) {
    return true;
  }

  if (current.primaryFingerprint &&
    current.primaryFingerprint !== previous.primaryFingerprint &&
    !previous.fingerprints.includes(current.primaryFingerprint)) {
    return true;
  }

  return current.fingerprints.some((fingerprint) => !previous.fingerprints.includes(fingerprint));
}
