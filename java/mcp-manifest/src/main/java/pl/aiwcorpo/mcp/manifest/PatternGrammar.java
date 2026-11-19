package pl.aiwcorpo.mcp.manifest;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.BitSet;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The grammar of {@code idPattern} and {@code scopePattern} of a resource type (C6, 7.0.0). A pattern is applied to ids that a
 * client chooses, so it must match in linear time. A pattern is within the grammar when it has at most
 * {@link #MAX_PATTERN_LENGTH} characters, no back references, no lookaround, no {@code \Q}, {@code \E} or {@code \c} escapes, no
 * quantifier applied to a group that contains a quantifier, no two variable-width atoms of one sequence whose characters overlap
 * (so {@code a*a*} and {@code a?a?} are out and {@code [a-z]+-[a-z]+} is in), and every quantified group that has alternatives lets them start with disjoint characters
 * (so {@code (a|aa)+} is out and {@code (?:[._-][a-z]|[a-z])*} is in). Ids longer than {@link #MAX_ID_LENGTH} are invalid before any matching.
 * The JavaScript twin is {@code grammarViolation} in {@code scripts/lib/manifest-rules.mjs}; the vectors keep them equal.
 */
public final class PatternGrammar {

    /** Longest pattern. */
    public static final int MAX_PATTERN_LENGTH = 512;
    /** Longest id or local scope part that is matched at all. */
    public static final int MAX_ID_LENGTH = 1024;

    private static final Pattern COUNTED = Pattern.compile("\\{(\\d+)(,(\\d*))?\\}");
    private static final Pattern HEX_ESCAPE = Pattern.compile("\\\\[xu](?:([0-9A-Fa-f]{2}|[0-9A-Fa-f]{4})|\\{([0-9A-Fa-f]{1,6})\\})");

    private PatternGrammar() {
    }

    /** @return the first violation, or null when the pattern is within the grammar */
    public static String violation(String regex) {
        if (regex.length() > MAX_PATTERN_LENGTH) {
            return "longer than " + MAX_PATTERN_LENGTH + " characters";
        }
        ArrayDeque<int[]> groups = new ArrayDeque<>(); // {start of body, hasQuantifier}
        boolean inClass = false;
        boolean lastClosedHadQuantifier = false;
        int lastClosedBodyStart = -1;
        int lastClosedBodyEnd = -1;
        for (int i = 0; i < regex.length(); i++) {
            char c = regex.charAt(i);
            if (c == '\\') {
                char next = i + 1 < regex.length() ? regex.charAt(i + 1) : ' ';
                if (!inClass && ((next >= '1' && next <= '9') || next == 'k')) {
                    return "back reference";
                }
                // \Q...\E and \c consume more than one character in java.util.regex, so skipping one here would let the
                // rest of the scan read quoted or control text as syntax and miss what the engine compiles.
                if (next == 'Q' || next == 'E' || next == 'c') {
                    return "quote or control escape";
                }
                i++;
                lastClosedHadQuantifier = false;
                lastClosedBodyStart = -1;
                continue;
            }
            if (inClass) {
                inClass = c != ']';
                continue;
            }
            if (c == '[') {
                inClass = true;
            } else if (c == '(') {
                if (regex.startsWith("(?=", i) || regex.startsWith("(?!", i) || regex.startsWith("(?<=", i) || regex.startsWith("(?<!", i)) {
                    return "lookaround";
                }
                int bodyStart = i + 1;
                if (regex.startsWith("(?:", i)) {
                    bodyStart = i + 3;
                    i += 2;
                } else if (regex.startsWith("(?<", i)) {
                    int close = regex.indexOf('>', i);
                    if (close < 0) {
                        return "unsupported group syntax";
                    }
                    bodyStart = close + 1;
                    i = close;
                } else if (regex.startsWith("(?", i)) {
                    return "unsupported group syntax";
                }
                groups.push(new int[] {bodyStart, 0});
                lastClosedBodyStart = -1;
                continue;
            } else if (c == ')') {
                if (groups.isEmpty()) {
                    return "unbalanced parenthesis";
                }
                int[] group = groups.pop();
                if (group[1] == 1 && !groups.isEmpty()) {
                    groups.peek()[1] = 1;
                }
                lastClosedHadQuantifier = group[1] == 1;
                lastClosedBodyStart = group[0];
                lastClosedBodyEnd = i;
                continue;
            } else if (c == '*' || c == '+' || c == '?' || c == '{') {
                if (c == '{' && !regex.substring(i).matches("(?s)\\{\\d+(,\\d*)?\\}.*")) {
                    lastClosedBodyStart = -1;
                    lastClosedHadQuantifier = false;
                    continue;
                }
                if (lastClosedHadQuantifier) {
                    return "quantifier applied to a group that contains a quantifier";
                }
                if (lastClosedBodyStart >= 0) {
                    String ambiguous = ambiguousAlternatives(regex.substring(lastClosedBodyStart, lastClosedBodyEnd));
                    if (ambiguous != null) {
                        return ambiguous;
                    }
                }
                if (!groups.isEmpty()) {
                    groups.peek()[1] = 1;
                }
                if (c == '{') {
                    i = regex.indexOf('}', i);
                }
                lastClosedHadQuantifier = false;
                lastClosedBodyStart = -1;
                continue;
            }
            lastClosedHadQuantifier = false;
            lastClosedBodyStart = -1;
        }
        return groups.isEmpty() ? neighbouringQuantifiers(regex) : "unbalanced parenthesis";
    }

    /**
     * Two variable-width atoms of one sequence whose characters overlap, such as {@code a*a*}, {@code a?a?} or
     * {@code a{0,9}a{0,9}}, let a failing match try every split of the id between them; k of them cost about n^k steps.
     * They are allowed only when a fixed atom whose characters are disjoint from every variable atom before it stands between
     * them, as in {@code [a-z]+-[a-z]+}. A group is one atom over the characters of its body, variable when its body has a
     * quantifier or alternatives; only alternation at the same level starts a new sequence.
     */
    private static String neighbouringQuantifiers(String regex) {
        Sequence top = new Sequence(regex);
        top.scan();
        return top.violation;
    }

    /** Scanner over one pattern; {@code scan} reads a sequence up to the closing parenthesis of its group or the end. */
    private static final class Sequence {
        private final String regex;
        private int i;
        private String violation;

        Sequence(String regex) {
            this.regex = regex;
        }

        /** Characters (null when unknown) and whether the scanned body is variable-width; empty bodies give null. */
        private record Summary(BitSet chars, boolean variable) {
        }

        Summary scan() {
            boolean any = false;
            boolean known = true;
            BitSet all = new BitSet();
            boolean variableBody = false;
            boolean pending = false;
            BitSet pendingChars = null;
            while (i < regex.length() && violation == null) {
                char c = regex.charAt(i);
                if (c == ')') {
                    break;
                }
                if (c == '|') {
                    variableBody = true;
                    pending = false;
                    i++;
                    continue;
                }
                if (c == '^' || c == '$') {
                    i++;
                    continue;
                }
                BitSet chars;
                boolean variable = false;
                if (c == '(') {
                    i = groupBodyStart(regex, i);
                    Summary inner = scan();
                    i++;
                    if (inner == null) {
                        skipQuantifier();
                        continue;
                    }
                    chars = inner.chars();
                    variable = inner.variable();
                } else {
                    int end = c == '\\' ? escapeEnd(regex, i) : c == '[' ? classEnd(regex, i) + 1 : i + 1;
                    String atom = regex.substring(i, end);
                    chars = c == '.' ? null : c == '\\' && atom.length() > 2 ? escapedCharacter(atom) : firstCharacters(atom);
                    i = end;
                }
                int[] range = skipQuantifier();
                if (range[1] == 0) {
                    continue;
                }
                variable = variable || range[0] != range[1];
                any = true;
                if (chars == null) {
                    known = false;
                } else {
                    all.or(chars);
                }
                variableBody = variableBody || variable;
                if (variable) {
                    if (pending && (pendingChars == null || chars == null || pendingChars.intersects(chars))) {
                        violation = "neighbouring quantified atoms overlap";
                    } else if (pending) {
                        pendingChars.or(chars);
                    } else {
                        pending = true;
                        pendingChars = chars == null ? null : (BitSet) chars.clone();
                    }
                } else if (pending && pendingChars != null && chars != null && !pendingChars.intersects(chars)) {
                    pending = false;
                }
            }
            return any ? new Summary(known ? all : null, variableBody) : null;
        }

        /** Reads the quantifier at the cursor, with a lazy or possessive suffix; returns {min, max}, max -1 for unbounded. */
        private int[] skipQuantifier() {
            int[] range = {1, 1};
            if (i >= regex.length()) {
                return range;
            }
            char q = regex.charAt(i);
            Matcher counted = COUNTED.matcher(regex).region(i, regex.length());
            if (q == '*' || q == '+' || q == '?') {
                range = new int[] {q == '+' ? 1 : 0, q == '?' ? 1 : -1};
                i++;
            } else if (q == '{' && counted.lookingAt()) {
                int min = Integer.parseInt(counted.group(1));
                int max = counted.group(2) == null ? min : counted.group(3).isEmpty() ? -1 : Integer.parseInt(counted.group(3));
                range = new int[] {min, max};
                i = counted.end();
            } else {
                return range;
            }
            if (i < regex.length() && (regex.charAt(i) == '?' || regex.charAt(i) == '+')) {
                i++;
            }
            return range;
        }
    }

    private static int groupBodyStart(String regex, int open) {
        if (regex.startsWith("(?:", open)) {
            return open + 3;
        }
        if (regex.startsWith("(?<", open) && regex.indexOf('>', open) > 0) {
            return regex.indexOf('>', open) + 1;
        }
        return open + 1;
    }

    /**
     * End of the escape at {@code at}. Hexadecimal escapes (x with two digits, u with four, either with braces), control
     * escapes (c and one character) and property or name escapes (p, P, N, with one letter or braces) are one atom.
     */
    private static int escapeEnd(String regex, int at) {
        char kind = at + 1 < regex.length() ? regex.charAt(at + 1) : ' ';
        int end = at + 2;
        if ("xupPN".indexOf(kind) >= 0 && regex.startsWith("{", at + 2) && regex.indexOf('}', at) > 0) {
            end = regex.indexOf('}', at) + 1;
        } else if (kind == 'x') {
            end = at + 4;
        } else if (kind == 'u') {
            end = at + 6;
        } else if (kind == 'c' || kind == 'p' || kind == 'P') {
            end = at + 3;
        }
        return Math.min(end, regex.length());
    }

    /** The one BMP character of a hexadecimal escape, or null (any character) for every other multi-character escape. */
    private static BitSet escapedCharacter(String escape) {
        Matcher hex = HEX_ESCAPE.matcher(escape);
        if (!hex.matches()) {
            return null;
        }
        int code = Integer.parseInt(hex.group(1) != null ? hex.group(1) : hex.group(2), 16);
        if (code > 0xFFFF) {
            return null;
        }
        BitSet set = new BitSet();
        set.set(code);
        return set;
    }

    private static int classEnd(String regex, int open) {
        for (int i = open + 1; i < regex.length(); i++) {
            if (regex.charAt(i) == '\\') {
                i++;
            } else if (regex.charAt(i) == ']') {
                return i;
            }
        }
        return regex.length() - 1;
    }

    /** A quantified group with alternatives: the first characters of the alternatives must be disjoint. */
    private static String ambiguousAlternatives(String body) {
        List<String> branches = new ArrayList<>();
        int depth = 0;
        boolean inClass = false;
        int from = 0;
        for (int i = 0; i < body.length(); i++) {
            char c = body.charAt(i);
            if (c == '\\') {
                i++;
            } else if (inClass) {
                inClass = c != ']';
            } else if (c == '[') {
                inClass = true;
            } else if (c == '(') {
                depth++;
            } else if (c == ')') {
                depth--;
            } else if (c == '|' && depth == 0) {
                branches.add(body.substring(from, i));
                from = i + 1;
            }
        }
        branches.add(body.substring(from));
        if (branches.size() < 2) {
            return null;
        }
        BitSet seen = new BitSet();
        for (String branch : branches) {
            BitSet first = firstCharacters(branch);
            if (first == null) {
                return "alternatives in a quantified group must start with a literal or a simple class";
            }
            if (seen.intersects(first)) {
                return "alternatives in a quantified group overlap";
            }
            seen.or(first);
        }
        return null;
    }

    /** Characters (BMP) that a branch can start with, for a literal, an escaped literal, \d or a class without negation; else null. */
    private static BitSet firstCharacters(String branch) {
        if (branch.isEmpty()) {
            return null;
        }
        BitSet set = new BitSet();
        char c = branch.charAt(0);
        if (c == '[') {
            int end = branch.indexOf(']');
            if (end < 0 || branch.length() > 1 && branch.charAt(1) == '^') {
                return null;
            }
            String inner = branch.substring(1, end);
            for (int i = 0; i < inner.length(); i++) {
                char a = inner.charAt(i);
                if (a == '\\') {
                    if (i + 1 >= inner.length() || Character.isLetterOrDigit(inner.charAt(i + 1))) {
                        return null;
                    }
                    a = inner.charAt(++i);
                }
                if (i + 2 < inner.length() && inner.charAt(i + 1) == '-') {
                    char b = inner.charAt(i + 2);
                    if (b == '\\') {
                        return null;
                    }
                    set.set(a, b + 1);
                    i += 2;
                } else {
                    set.set(a);
                }
            }
            return set;
        }
        if (c == '\\') {
            if (branch.length() < 2) {
                return null;
            }
            char e = branch.charAt(1);
            if (e == 'd') {
                set.set('0', '9' + 1);
                return set;
            }
            if (Character.isLetterOrDigit(e)) {
                return null;
            }
            set.set(e);
            return set;
        }
        if ("().*+?{|^$".indexOf(c) >= 0) {
            return null;
        }
        set.set(c);
        return set;
    }
}
