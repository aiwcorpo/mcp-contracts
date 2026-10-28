// Reference implementation of the text hygiene rules (CC-121, CC-122), shared by the gateway and the starter: what a
// tool argument may contain and what text coming from a system may keep. test-vectors/text-hygiene/ is the
// specification; the Unicode categories are those of the runtime (Cf: JDK 25 and Node 24 agree on the characters of the
// vectors). There is no Unicode normalisation anywhere (no NFKC, CC-122): text passes unchanged except for the set below.
const ALLOWED_FORMAT = new Set([0x200c, 0x200d, 0x200e, 0x200f]); // ZWNJ, ZWJ, LRM, RLM
const INVISIBLE = new Set([0x034f, 0x115f, 0x1160, 0x3164, 0xffa0, 0x2800]);
const WHITESPACE_CONTROLS = new Set([0x09, 0x0a, 0x0d]);

const isVariationSelector = (cp) => (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);
const isNoncharacter = (cp) => (cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xfffe) === 0xfffe;
const isEmoji = (cp) => cp !== undefined && /^\p{Extended_Pictographic}$/u.test(String.fromCodePoint(cp));

/** Code points of a JS string; an unpaired surrogate is one element of its own. */
export const codePoints = (text) => Array.from(text, (ch) => ch.codePointAt(0));

/** Reason why the code point at `index` is not allowed, or null. `identifier` adds TAB, LF, CR; `mention` adds U+FF01..U+FF5E. */
export function forbiddenReason(cps, index, { identifier = false, mention = false } = {}) {
  const cp = cps[index];
  if (cp < 0x20) return WHITESPACE_CONTROLS.has(cp) ? (identifier ? 'line_break_in_identifier' : null) : 'control_character';
  if (cp >= 0x7f && cp <= 0x9f) return 'control_character';
  if (cp === 0x2028 || cp === 0x2029) return 'line_separator';
  if (cp >= 0xd800 && cp <= 0xdfff) return 'unpaired_surrogate';
  if (isNoncharacter(cp)) return 'noncharacter';
  if (cp === 0xfe0f && isEmoji(cps[index - 1])) return null;
  if (isVariationSelector(cp)) return 'variation_selector';
  if (INVISIBLE.has(cp)) return 'invisible_character';
  if (!ALLOWED_FORMAT.has(cp) && /^\p{Cf}$/u.test(String.fromCodePoint(cp))) return 'format_character';
  if (mention && cp >= 0xff01 && cp <= 0xff5e) return 'full_width_ascii';
  return null;
}

/** Argument check: {valid: true} or {valid: false, reason} for the first forbidden character (the tool answers invalid_argument). */
export function checkArgument(text, options = {}) {
  const cps = codePoints(text);
  for (let i = 0; i < cps.length; i++) {
    const reason = forbiddenReason(cps, i, options);
    if (reason !== null) return { valid: false, reason };
  }
  return { valid: true };
}

/** Text from a system: every maximal run of forbidden characters is replaced by one space; nothing else changes. */
export function sanitizeSystemText(text) {
  const cps = codePoints(text);
  let out = '';
  let inRun = false;
  for (let i = 0; i < cps.length; i++) {
    if (forbiddenReason(cps, i) !== null) {
      if (!inRun) out += ' ';
      inRun = true;
    } else {
      inRun = false;
      out += String.fromCodePoint(cps[i]);
    }
  }
  return out;
}
