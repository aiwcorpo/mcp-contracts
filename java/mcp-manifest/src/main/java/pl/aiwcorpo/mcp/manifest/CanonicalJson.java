package pl.aiwcorpo.mcp.manifest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * JSON Canonicalization Scheme (RFC 8785): object members sorted by UTF-16 code units, no whitespace, strings and
 * numbers serialized like ECMAScript {@code JSON.stringify}. Numbers are IEEE 754 doubles, as in JavaScript.
 */
public final class CanonicalJson {

    private static final ObjectMapper JSON = StrictJson.MAPPER;

    private CanonicalJson() {
    }

    /** @return canonical form of a JSON text */
    public static String canonicalize(String json) {
        try {
            return canonicalize(JSON.readTree(json));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static String canonicalize(JsonNode node) {
        StringBuilder out = new StringBuilder();
        write(node, out);
        return out.toString();
    }

    private static void write(JsonNode node, StringBuilder out) {
        switch (node.getNodeType()) {
            case OBJECT -> {
                List<String> names = new ArrayList<>();
                for (Iterator<String> it = node.fieldNames(); it.hasNext();) {
                    names.add(it.next());
                }
                names.sort(String::compareTo);
                out.append('{');
                for (int i = 0; i < names.size(); i++) {
                    if (i > 0) {
                        out.append(',');
                    }
                    string(names.get(i), out);
                    out.append(':');
                    write(node.get(names.get(i)), out);
                }
                out.append('}');
            }
            case ARRAY -> {
                out.append('[');
                for (int i = 0; i < node.size(); i++) {
                    if (i > 0) {
                        out.append(',');
                    }
                    write(node.get(i), out);
                }
                out.append(']');
            }
            case STRING -> string(node.textValue(), out);
            case NUMBER -> out.append(number(node.doubleValue()));
            case BOOLEAN -> out.append(node.booleanValue());
            case NULL -> out.append("null");
            default -> throw new IllegalArgumentException("not JSON data: " + node.getNodeType());
        }
    }

    private static void string(String value, StringBuilder out) {
        out.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\b' -> out.append("\\b");
                case '\f' -> out.append("\\f");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20 || (Character.isSurrogate(c) && !wellFormedSurrogate(value, i))) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        out.append('"');
    }

    private static boolean wellFormedSurrogate(String value, int i) {
        char c = value.charAt(i);
        if (Character.isHighSurrogate(c)) {
            return i + 1 < value.length() && Character.isLowSurrogate(value.charAt(i + 1));
        }
        return i > 0 && Character.isHighSurrogate(value.charAt(i - 1));
    }

    /** ECMAScript Number::toString for a finite double (RFC 8785 section 3.2.2.3). */
    static String number(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            throw new IllegalArgumentException("JSON has no NaN or Infinity");
        }
        if (value == 0) {
            return "0";
        }
        if (value < 0) {
            return "-" + number(-value);
        }
        // ECMAScript: the fewest significant digits that round-trip, and among those the value closest to the exact
        // one. Rounding the exact value to p digits is not enough: at a power of two the rounding interval is
        // asymmetric, so the neighbour one unit away may round-trip while the rounded value does not.
        BigDecimal exact = new BigDecimal(value);
        BigDecimal decimal = null;
        for (int precision = 1; precision <= 17 && decimal == null; precision++) {
            BigDecimal rounded = exact.round(new MathContext(precision, RoundingMode.HALF_EVEN));
            BigDecimal unit = rounded.ulp();
            BigDecimal best = null;
            for (BigDecimal candidate : new BigDecimal[] {rounded, rounded.subtract(unit), rounded.add(unit)}) {
                if (candidate.signum() > 0 && candidate.precision() <= precision && candidate.doubleValue() == value
                        && (best == null || candidate.subtract(exact).abs().compareTo(best.subtract(exact).abs()) < 0)) {
                    best = candidate;
                }
            }
            if (best != null) {
                decimal = best.stripTrailingZeros();
            }
        }
        String digits = decimal.unscaledValue().toString();
        int k = digits.length();
        int n = k - decimal.scale();
        if (k <= n && n <= 21) {
            return digits + "0".repeat(n - k);
        }
        if (0 < n && n <= 21) {
            return digits.substring(0, n) + "." + digits.substring(n);
        }
        if (-6 < n && n <= 0) {
            return "0." + "0".repeat(-n) + digits;
        }
        int e = n - 1;
        String exponent = (e < 0 ? "-" : "+") + Math.abs(e);
        return k == 1 ? digits + "e" + exponent : digits.charAt(0) + "." + digits.substring(1) + "e" + exponent;
    }
}
