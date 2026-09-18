// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Fernando A. Casso Rodriguez

'use strict';

// Escaping for an AFTS (Alfresco Full Text Search) / Lucene quoted value.
//
// Values are interpolated into predicates like `vso:findingId:"<value>"`, so the value must
// not be able to close the quote or escape it. Two characters matter, and ordering does too:
//   - backslash first, so the backslashes this function inserts are not escaped again
//   - then the double quote
// A trailing backslash is the reason both are handled: escaping only `"` lets a value ending
// in `\` escape the closing quote and malform (or extend) the predicate.
//
// This lives in one module because the same one-liner had been copied into the findings, caps
// and reports routers plus the Alfresco client, and had already drifted behind the queries it
// feeds.
function escapeAftsValue(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

module.exports = { escapeAftsValue };
