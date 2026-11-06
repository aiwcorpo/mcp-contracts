package pl.aiwcorpo.mcp.manifest;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.BitSet;
import java.util.List;

/**
 * The grammar of {@code idPattern} and {@code scopePattern} of a resource type (C6, 7.0.0). A pattern is applied to ids that a
 * client chooses, so it must match in linear time. A pattern is within the grammar when it has at most
 * {@link #MAX_PATTERN_LENGTH} characters, no back references, no lookaround, no quantifier applied to a group that contains a
 * quantifier, and every quantified group that has alternatives lets them start with disjoint characters (so {@code (a|aa)+}
 * is out and {@code (?:[._-][a-z]|[a-z])*} is in). Ids longer than {@link #MAX_ID_LENGTH} are invalid before any matching.
 * The JavaScript twin is {@code grammarViolation} in {@code scripts/lib/manifest-rules.mjs}; the vectors keep them equal.
 */
public final class PatternGrammar {

    /** Longest pattern. */
    public static final int MAX_PATTERN_LENGTH = 512;
    /** Longest id or local scope part that is matched at all. */
    public static final int MAX_ID_LENGTH = 1024;

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
        return groups.isEmpty() ? null : "unbalanced parenthesis";
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
