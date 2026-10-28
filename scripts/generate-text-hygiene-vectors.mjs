// Generates test-vectors/text-hygiene/ (CC-121, CC-122). Expected values are written here by hand and
// test/text-hygiene.test.mjs runs scripts/lib/text-hygiene.mjs against them. Strings are stored with every
// non-ASCII character as a \uXXXX escape, so the files stay ASCII and invisible characters stay visible in review.
import { mkdirSync, writeFileSync } from 'node:fs';
import { path } from './lib/contracts.mjs';

const escapeNonAscii = (json) => json.replace(/[\u007f-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
const write = (name, value) => {
  mkdirSync(path('test-vectors', 'text-hygiene'), { recursive: true });
  writeFileSync(path('test-vectors', 'text-hygiene', `${name}.json`), escapeNonAscii(JSON.stringify(value, null, 2)) + '\n');
};
const u = (...cps) => String.fromCodePoint(...cps);

const arg = (name, description, mode, input, expected) => write(name, { description, mode, input, expected });
const ok = { valid: true };
const bad = (reason) => ({ valid: false, reason });

// ---- arguments: mode "argument" (free text)
arg('argument-valid-ascii', 'Plain text.', 'argument', 'Fix the login page', ok);
arg('argument-valid-empty', 'Empty string.', 'argument', '', ok);
arg('argument-valid-polish', 'Polish letters are ordinary text.', 'argument', 'Zażółć gęślą jaźń', ok);
arg('argument-valid-newline-tab-cr', 'Free text may contain TAB, LF and CR.', 'argument', 'line1\n\tline2\r\nline3', ok);
arg('argument-valid-emoji-variation-selector', 'U+FE0F directly after an emoji (red heart with emoji presentation).', 'argument', u(0x2764, 0xfe0f) + ' done', ok);
arg('argument-valid-zwj-sequence', 'ZWJ (U+200D) is allowed: family emoji sequence.', 'argument', u(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467), ok);
arg('argument-valid-zwnj', 'ZWNJ (U+200C) is allowed, it is part of Persian orthography.', 'argument', 'mi' + u(0x200c) + 'khaham', ok);
arg('argument-valid-lrm-rlm', 'LRM and RLM (U+200E, U+200F) are allowed.', 'argument', 'a' + u(0x200e) + 'b' + u(0x200f) + 'c', ok);
arg('argument-valid-nfkc-sensitive-text', 'Text that NFKC would change is not touched and not rejected (CC-122): ligature, circled digit, combining accent.', 'argument', u(0xfb01) + ' ' + u(0x2460) + ' e' + u(0x0301), ok);
arg('argument-valid-full-width-outside-mention-filter', 'Full-width ASCII is only refused where mentions are filtered (CC-122); other arguments keep it.', 'argument', u(0xff21, 0xff22, 0xff23, 0xff01), ok);
arg('argument-valid-ascii-at-all', 'ASCII @all is not a hygiene matter: the mention filter of the starter handles it.', 'argument', '@all please look', ok);
for (const [name, cp, reason, what] of [
  ['nul', 0x00, 'control_character', 'NUL'],
  ['bell', 0x07, 'control_character', 'BEL'],
  ['escape', 0x1b, 'control_character', 'ESC (terminal escape sequences)'],
  ['delete', 0x7f, 'control_character', 'DEL'],
  ['c1-next-line', 0x85, 'control_character', 'C1 NEL'],
  ['c1-last', 0x9f, 'control_character', 'last C1 control'],
  ['line-separator', 0x2028, 'line_separator', 'U+2028'],
  ['paragraph-separator', 0x2029, 'line_separator', 'U+2029'],
  ['zero-width-space', 0x200b, 'format_character', 'ZWSP (Cf, outside U+200C..U+200F)'],
  ['word-joiner', 0x2060, 'format_character', 'WORD JOINER'],
  ['bom', 0xfeff, 'format_character', 'BOM / zero width no-break space in the middle of text'],
  ['soft-hyphen', 0x00ad, 'format_character', 'SOFT HYPHEN'],
  ['bidi-override', 0x202e, 'format_character', 'right-to-left override'],
  ['bidi-isolate', 0x2066, 'format_character', 'left-to-right isolate'],
  ['arabic-letter-mark', 0x061c, 'format_character', 'ARABIC LETTER MARK'],
  ['tag-character', 0xe0041, 'format_character', 'TAG LATIN CAPITAL LETTER A (hidden text in tag characters)'],
  ['noncharacter-fffe', 0xfffe, 'noncharacter', 'U+FFFE'],
  ['noncharacter-ffff', 0xffff, 'noncharacter', 'U+FFFF'],
  ['noncharacter-fdd0', 0xfdd0, 'noncharacter', 'U+FDD0'],
  ['noncharacter-10ffff', 0x10ffff, 'noncharacter', 'U+10FFFF (supplementary plane)'],
  ['variation-selector-1', 0xfe00, 'variation_selector', 'VS1'],
  ['variation-selector-supplement', 0xe0100, 'variation_selector', 'VS17'],
  ['combining-grapheme-joiner', 0x034f, 'invisible_character', 'U+034F'],
  ['hangul-choseong-filler', 0x115f, 'invisible_character', 'U+115F'],
  ['hangul-jungseong-filler', 0x1160, 'invisible_character', 'U+1160'],
  ['hangul-filler', 0x3164, 'invisible_character', 'U+3164'],
  ['halfwidth-hangul-filler', 0xffa0, 'invisible_character', 'U+FFA0'],
  ['braille-blank', 0x2800, 'invisible_character', 'U+2800'],
]) {
  arg(`argument-invalid-${name}`, `${what} inside an argument is rejected (invalid_argument).`, 'argument', 'ab' + u(cp) + 'cd', bad(reason));
}
arg('argument-invalid-lone-high-surrogate', 'An unpaired high surrogate (JSON \\ud800 escape) is rejected.', 'argument', 'ab' + String.fromCharCode(0xd800) + 'cd', bad('unpaired_surrogate'));
arg('argument-invalid-lone-low-surrogate', 'An unpaired low surrogate.', 'argument', 'ab' + String.fromCharCode(0xdc00) + 'cd', bad('unpaired_surrogate'));
arg('argument-invalid-variation-selector-after-letter', 'U+FE0F only follows an emoji; after a letter it hides nothing visible and is rejected.', 'argument', 'a' + u(0xfe0f) + 'b', bad('variation_selector'));
arg('argument-invalid-double-variation-selector', 'A single U+FE0F after an emoji: the second one is rejected.', 'argument', u(0x2764, 0xfe0f, 0xfe0f), bad('variation_selector'));
arg('argument-invalid-variation-selector-at-start', 'U+FE0F with nothing before it.', 'argument', u(0xfe0f) + 'a', bad('variation_selector'));
arg('argument-invalid-run-of-invisible', 'A run of invisible characters between words.', 'argument', 'ignore' + u(0x200b, 0x2060, 0xfeff) + 'previous', bad('format_character'));

// ---- arguments that carry a pattern (identifiers): TAB, LF and CR are refused too
arg('identifier-valid-key', 'An issue key.', 'argument-identifier', 'ABC-123', ok);
arg('identifier-invalid-newline', 'LF in an identifier value (would also pass a loose pattern ending in $ on some engines).', 'argument-identifier', 'ABC-123\n', bad('line_break_in_identifier'));
arg('identifier-invalid-carriage-return', 'CR in an identifier value.', 'argument-identifier', 'ABC-123\r', bad('line_break_in_identifier'));
arg('identifier-invalid-tab', 'TAB in an identifier value.', 'argument-identifier', 'ABC\t123', bad('line_break_in_identifier'));
arg('identifier-invalid-zero-width-space', 'The general rules still apply to identifiers.', 'argument-identifier', 'ABC' + u(0x200b) + '-123', bad('format_character'));

// ---- arguments that pass through a mention filter (CC-122): full-width ASCII is refused, NFKC is not used
arg('mention-invalid-full-width-at-all', 'Full-width "@all" would be read as @all by a recipient that applies NFKC.', 'argument-mention-filtered', u(0xff20, 0xff41, 0xff4c, 0xff4c) + ' look', bad('full_width_ascii'));
arg('mention-invalid-full-width-letter', 'One full-width letter U+FF41 inside text.', 'argument-mention-filtered', 'hello ' + u(0xff41), bad('full_width_ascii'));
arg('mention-invalid-full-width-first', 'The first character of the range, U+FF01.', 'argument-mention-filtered', u(0xff01), bad('full_width_ascii'));
arg('mention-invalid-full-width-last', 'The last character of the range, U+FF5E.', 'argument-mention-filtered', u(0xff5e), bad('full_width_ascii'));
arg('mention-valid-ideographic-space', 'U+3000 and U+FF00, U+FF5F are outside U+FF01..U+FF5E.', 'argument-mention-filtered', 'a' + u(0x3000) + 'b' + u(0xff5f), ok);
arg('mention-valid-ascii', 'Ordinary ASCII text passes this check (the filter for ASCII mentions is separate).', 'argument-mention-filtered', 'please review', ok);
arg('mention-valid-polish', 'Polish text passes.', 'argument-mention-filtered', 'Zażółć gęślą jaźń', ok);
arg('mention-invalid-general-rules-apply', 'The general rules apply to mention-filtered arguments too.', 'argument-mention-filtered', '@all' + u(0x200b), bad('format_character'));

// ---- text from a system: forbidden runs become one space, nothing is normalised
const sys = (name, description, input, output) => write(name, { description, mode: 'system-text', input, expected: { output } });
sys('system-text-unchanged', 'Clean text stays byte for byte.', 'Title: fix login', 'Title: fix login');
sys('system-text-keeps-newlines-and-tabs', 'LF, CR and TAB are ordinary in a page body.', 'a\nb\r\nc\td', 'a\nb\r\nc\td');
sys('system-text-zero-width-space-becomes-space', 'A removed character is replaced, not dropped: "ignore" and "previous" never merge into one token.', 'ignore' + u(0x200b) + 'previous', 'ignore previous');
sys('system-text-run-becomes-one-space', 'A run of forbidden characters becomes one space.', 'a' + u(0x200b, 0x2060, 0xfeff, 0x00ad) + 'b', 'a b');
sys('system-text-two-runs-two-spaces', 'Two separate runs give two spaces.', 'a' + u(0x200b) + 'b' + u(0x2060) + 'c', 'a b c');
sys('system-text-existing-space-is-kept', 'No collapsing with neighbouring spaces: the replacement is one space per run.', 'a ' + u(0x200b) + ' b', 'a   b');
sys('system-text-run-at-start-and-end', 'No trimming.', u(0x200b) + 'hello' + u(0xfeff), ' hello ');
sys('system-text-control-characters', 'C0, DEL and C1 controls are replaced.', 'x' + u(0x07, 0x7f, 0x85) + 'y', 'x y');
sys('system-text-line-separators', 'U+2028 and U+2029 are replaced.', 'a' + u(0x2028) + 'b' + u(0x2029) + 'c', 'a b c');
sys('system-text-bidi-controls', 'Bidirectional overrides and isolates are replaced.', 'a' + u(0x202e) + 'cod.exe' + u(0x2066), 'a cod.exe ');
sys('system-text-tag-characters', 'A run of tag characters (hidden ASCII) becomes one space.', 'a' + u(0xe0049, 0xe0067, 0xe006e, 0xe006f, 0xe0072, 0xe0065) + 'b', 'a b');
sys('system-text-lone-surrogate', 'An unpaired surrogate is replaced.', 'a' + String.fromCharCode(0xd800) + 'b', 'a b');
sys('system-text-noncharacter', 'A noncharacter is replaced.', 'a' + u(0xfffe) + 'b', 'a b');
sys('system-text-invisible-fillers', 'Invisible fillers outside Cf: U+034F, U+115F, U+1160, U+3164, U+FFA0, U+2800 are one run.', 'a' + u(0x034f, 0x115f, 0x1160, 0x3164, 0xffa0, 0x2800) + 'b', 'a b');
sys('system-text-variation-selector-after-letter', 'U+FE0F after a letter is removed.', 'a' + u(0xfe0f) + 'b', 'a b');
sys('system-text-variation-selector-supplement', 'VS17 (U+E0100) is removed.', 'a' + u(0xe0100) + 'b', 'a b');
sys('system-text-emoji-presentation-kept', 'A single U+FE0F after an emoji stays.', u(0x2764, 0xfe0f) + ' ok', u(0x2764, 0xfe0f) + ' ok');
sys('system-text-second-variation-selector-removed', 'Only a single U+FE0F is kept.', u(0x2764, 0xfe0f, 0xfe0f) + 'x', u(0x2764, 0xfe0f) + ' x');
sys('system-text-zwj-zwnj-lrm-rlm-kept', 'U+200C..U+200F are kept.', 'a' + u(0x200c, 0x200d, 0x200e, 0x200f) + 'b', 'a' + u(0x200c, 0x200d, 0x200e, 0x200f) + 'b');
sys('system-text-no-nfkc', 'No normalisation (CC-122): full-width text, ligature and a combining sequence come out as they went in.', u(0xff20, 0xff41, 0xff4c, 0xff4c) + ' ' + u(0xfb01) + ' e' + u(0x0301), u(0xff20, 0xff41, 0xff4c, 0xff4c) + ' ' + u(0xfb01) + ' e' + u(0x0301));
sys('system-text-polish-unchanged', 'Polish text with precomposed letters is untouched.', 'Zażółć gęślą jaźń', 'Zażółć gęślą jaźń');
console.log('text hygiene vectors written');
