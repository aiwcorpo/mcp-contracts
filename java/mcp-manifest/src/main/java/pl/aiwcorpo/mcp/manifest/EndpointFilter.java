package pl.aiwcorpo.mcp.manifest;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.TreeSet;
import java.util.regex.Pattern;

/**
 * Filter in the query of the aggregate MCP endpoint {@code /mcp} and of {@code /s/<serverId>/mcp} (CC-170): parameters
 * {@code systems}, {@code tools}, {@code access} and {@code exclude}. Parsing gives one canonical form per filter, so the
 * address, the audit field {@code filter} and the binding to a session (CC-172) compare as text. The reference is
 * {@code scripts/lib/endpoint-filter.mjs}; {@code test-vectors/endpoint-filter/} pins the answers.
 *
 * <p>The filter only narrows what the user may call anyway; it is not a security boundary (CC-170).
 */
public final class EndpointFilter {

    /** Longest query accepted, in bytes. */
    public static final int MAX_QUERY_BYTES = 512;
    /** Most distinct entries of {@code systems}. */
    public static final int MAX_SYSTEMS = 5;
    /** Most distinct entries of {@code tools}. */
    public static final int MAX_TOOLS = 100;
    /** Most distinct entries of {@code exclude}. */
    public static final int MAX_EXCLUDE = 100;

    private static final Pattern SYSTEM = Pattern.compile("[a-z][a-z0-9]*");
    private static final Pattern TOOL = Pattern.compile("[a-z][a-z0-9]*__[a-z][a-z0-9]*(?:_[a-z0-9]+)*");
    private static final Pattern ALLOWED_CHARACTERS = Pattern.compile("[A-Za-z0-9_,=&]*");
    private static final int MAX_SYSTEM_LENGTH = 32;
    private static final int MAX_TOOL_LENGTH = 80;
    private static final EndpointFilter NONE = new EndpointFilter(Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty());

    /** Value of {@code access}. */
    public enum Access {
        /** Tools whose approved risk is READ_ONLY. */
        READ,
        /** Tools whose approved risk is UPDATE or DESTRUCTIVE; READ_ONLY ones are not included. */
        WRITE;

        String text() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    /** The query is not a valid filter; the client sees 400 invalid_request, reason invalid_filter, never the cause. */
    public static final class Invalid extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final String cause;

        Invalid(String cause) {
            super(cause);
            this.cause = cause;
        }

        /** @return short internal cause as in the vectors (for logs, not for the client) */
        public String cause() {
            return cause;
        }
    }

    private final Optional<List<String>> systems;
    private final Optional<List<String>> tools;
    private final Optional<Access> access;
    private final Optional<List<String>> exclude;

    private EndpointFilter(Optional<List<String>> systems, Optional<List<String>> tools, Optional<Access> access,
            Optional<List<String>> exclude) {
        this.systems = systems;
        this.tools = tools;
        this.access = access;
        this.exclude = exclude;
    }

    /** @return the filter that leaves everything visible (no query) */
    public static EndpointFilter none() {
        return NONE;
    }

    /**
     * @param rawQuery query of the request without the leading {@code ?}; {@code null} or empty means no filter
     * @throws Invalid when the query is not a valid filter
     */
    public static EndpointFilter parse(String rawQuery) {
        if (rawQuery == null || rawQuery.isEmpty()) {
            return NONE;
        }
        if (rawQuery.getBytes(StandardCharsets.UTF_8).length > MAX_QUERY_BYTES) {
            throw new Invalid("query_too_long");
        }
        if (rawQuery.indexOf('%') >= 0) {
            throw new Invalid("percent_encoding");
        }
        if (!ALLOWED_CHARACTERS.matcher(rawQuery).matches()) {
            throw new Invalid("forbidden_character");
        }
        Optional<List<String>> systems = Optional.empty();
        Optional<List<String>> tools = Optional.empty();
        Optional<Access> access = Optional.empty();
        Optional<List<String>> exclude = Optional.empty();
        List<String> seen = new ArrayList<>();
        for (String part : rawQuery.split("&", -1)) {
            if (part.isEmpty()) {
                throw new Invalid("empty_parameter");
            }
            int eq = part.indexOf('=');
            if (eq <= 0 || part.indexOf('=', eq + 1) >= 0) {
                throw new Invalid("malformed_parameter");
            }
            String name = part.substring(0, eq).toLowerCase(Locale.ROOT);
            String value = part.substring(eq + 1).toLowerCase(Locale.ROOT);
            if (!List.of("systems", "tools", "access", "exclude").contains(name)) {
                throw new Invalid("unknown_parameter");
            }
            if (seen.contains(name)) {
                throw new Invalid("repeated_parameter");
            }
            seen.add(name);
            switch (name) {
                case "systems" -> systems = Optional.of(list(name, value));
                case "tools" -> tools = Optional.of(list(name, value));
                case "exclude" -> exclude = Optional.of(list(name, value));
                default -> {
                    if (value.equals("read")) {
                        access = Optional.of(Access.READ);
                    } else if (value.equals("write")) {
                        access = Optional.of(Access.WRITE);
                    } else {
                        throw new Invalid("invalid_access");
                    }
                }
            }
        }
        return new EndpointFilter(systems, tools, access, exclude);
    }

    private static List<String> list(String name, String value) {
        if (value.isEmpty()) {
            throw new Invalid("empty_value");
        }
        TreeSet<String> unique = new TreeSet<>();
        for (String entry : value.split(",", -1)) {
            if (entry.isEmpty()) {
                throw new Invalid("empty_entry");
            }
            unique.add(entry);
        }
        for (String entry : unique) {
            boolean ok = switch (name) {
                case "systems" -> isSystem(entry);
                case "tools" -> isTool(entry);
                default -> isSystem(entry) || isTool(entry);
            };
            if (!ok) {
                throw new Invalid("invalid_entry");
            }
        }
        int max = switch (name) {
            case "systems" -> MAX_SYSTEMS;
            case "tools" -> MAX_TOOLS;
            default -> MAX_EXCLUDE;
        };
        if (unique.size() > max) {
            throw new Invalid("too_many_entries");
        }
        return List.copyOf(unique);
    }

    private static boolean isSystem(String entry) {
        return entry.length() <= MAX_SYSTEM_LENGTH && SYSTEM.matcher(entry).matches();
    }

    private static boolean isTool(String entry) {
        return entry.length() <= MAX_TOOL_LENGTH && TOOL.matcher(entry).matches();
    }

    /** @return canonical text: fixed parameter order, sorted values, no duplicates; empty for no filter */
    public String canonical() {
        List<String> parts = new ArrayList<>();
        systems.ifPresent(v -> parts.add("systems=" + String.join(",", v)));
        tools.ifPresent(v -> parts.add("tools=" + String.join(",", v)));
        access.ifPresent(v -> parts.add("access=" + v.text()));
        exclude.ifPresent(v -> parts.add("exclude=" + String.join(",", v)));
        return String.join("&", parts);
    }

    /** @return true when the request carried no filter */
    public boolean isEmpty() {
        return systems.isEmpty() && tools.isEmpty() && access.isEmpty() && exclude.isEmpty();
    }

    /** @return the systems entries, sorted, if the parameter was given */
    public Optional<List<String>> systems() {
        return systems;
    }

    /** @return the tools entries, sorted, if the parameter was given */
    public Optional<List<String>> tools() {
        return tools;
    }

    /** @return the access restriction, if the parameter was given */
    public Optional<Access> access() {
        return access;
    }

    /** @return the exclude entries (systems and qualified tool names), sorted, if the parameter was given */
    public Optional<List<String>> exclude() {
        return exclude;
    }

    /**
     * On {@code /s/<serverId>/mcp}, {@code systems} must be absent or exactly the system of the route (CC-169).
     *
     * @param routeSystem system of the route without the {@code mcp-} prefix, or {@code null} on {@code /mcp}
     * @throws Invalid when {@code systems} names anything else
     */
    public void checkRoute(String routeSystem) {
        if (routeSystem == null || systems.isEmpty()) {
            return;
        }
        List<String> given = systems.get();
        if (given.size() != 1 || !given.get(0).equals(routeSystem)) {
            throw new Invalid("systems_not_route_system");
        }
    }

    /**
     * @param qualifiedName {@code <system>__<tool>}
     * @param risk approved risk of the registry entry: READ_ONLY, UPDATE or DESTRUCTIVE; any other value is left out by
     *        both values of {@code access}
     * @return true when the filter leaves the tool visible; the caller applies it to tools the user may call
     */
    public boolean allows(String qualifiedName, String risk) {
        String system = qualifiedName.substring(0, qualifiedName.indexOf("__"));
        if (systems.isPresent() && !systems.get().contains(system)) {
            return false;
        }
        if (tools.isPresent() && !tools.get().contains(qualifiedName)) {
            return false;
        }
        if (access.isPresent()) {
            boolean readOnly = "READ_ONLY".equals(risk);
            boolean write = "UPDATE".equals(risk) || "DESTRUCTIVE".equals(risk);
            // A risk outside the closed set (or null) is in neither group, so neither access value leaves it (CC-186).
            if (access.get() == Access.READ ? !readOnly : !write) {
                return false;
            }
        }
        return exclude.isEmpty() || !(exclude.get().contains(system) || exclude.get().contains(qualifiedName));
    }

    /**
     * CC-172: the filter of a later request of an MCP session must equal the one of {@code initialize}, compared after
     * normalization.
     *
     * @throws Invalid when either query is not a valid filter
     */
    public static boolean sessionMatches(String initializeQuery, String requestQuery) {
        return parse(initializeQuery).canonical().equals(parse(requestQuery).canonical());
    }
}
