package pl.aiwcorpo.mcp.cedar.entities;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * Per-system id patterns (CC-056), identical to {@code common.schema.json} ($defs JiraProjectKey ... and
 * ResourceIdPatterns); a test compares them. Ids that do not match never reach Cedar or a backend query.
 */
public final class ResourceIds {

    /** Which ids a pattern applies to. */
    public enum Kind {
        /** Ids in tool arguments and of resolved resources. */
        RESOURCE,
        /** Grantable or narrowable scope ids: static.json mapping, vsc claim, resourceDefaults. */
        SCOPE
    }

    private static final String GITLAB_SEGMENT = "[A-Za-z0-9](?:[._-]?[A-Za-z0-9])*";
    private static final Pattern JIRA_PROJECT = Pattern.compile("^[A-Z][A-Z0-9_]{1,9}$");
    private static final Pattern JIRA_ISSUE = Pattern.compile("^[A-Z][A-Z0-9_]{1,9}-[1-9][0-9]{0,9}$");
    private static final Pattern CONFLUENCE_SPACE = Pattern.compile("^[A-Za-z0-9]{1,255}$");
    private static final Pattern CONFLUENCE_PAGE = Pattern.compile("^[1-9][0-9]{0,18}$");
    private static final Pattern GITLAB_GROUP = Pattern.compile(
            "^(?!.*\\.(?:git|atom)$)" + GITLAB_SEGMENT + "(?:/" + GITLAB_SEGMENT + "){0,19}$");
    private static final Pattern GITLAB_PROJECT = Pattern.compile(
            "^(?!.*\\.(?:git|atom)$)" + GITLAB_SEGMENT + "(?:/" + GITLAB_SEGMENT + "){1,20}$");
    private static final Pattern OPENSEARCH_INDEX = Pattern.compile("^[a-z0-9][a-z0-9._-]{0,254}$");
    private static final Pattern OPENSEARCH_PREFIX = Pattern.compile("^[a-z0-9][a-z0-9._-]{0,253}[a-z0-9_]$|^[a-z0-9]$");
    private static final Pattern SERVICEDESK_ID = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$");
    private static final int GITLAB_MAX_LENGTH = 1024;

    private static final Map<String, Pattern> RESOURCE = Map.of(
            "Jira::Project", JIRA_PROJECT,
            "Jira::Issue", JIRA_ISSUE,
            "Confluence::Space", CONFLUENCE_SPACE,
            "Confluence::Page", CONFLUENCE_PAGE,
            "GitLab::Group", GITLAB_GROUP,
            "GitLab::Project", GITLAB_PROJECT,
            "OpenSearch::Index", OPENSEARCH_INDEX,
            "ServiceDesk::Queue", SERVICEDESK_ID,
            "ServiceDesk::Ticket", SERVICEDESK_ID);
    private static final Map<String, Pattern> SCOPE = Map.of(
            "Jira::Project", JIRA_PROJECT,
            "Confluence::Space", CONFLUENCE_SPACE,
            "Confluence::Page", CONFLUENCE_PAGE,
            "GitLab::Group", GITLAB_GROUP,
            "OpenSearch::Index", OPENSEARCH_PREFIX,
            "ServiceDesk::Queue", SERVICEDESK_ID);

    private ResourceIds() {
    }

    /** @return true when {@code id} is a valid id of {@code type} for the given use; false for unknown types */
    public static boolean isValid(String type, Kind kind, String id) {
        Pattern pattern = (kind == Kind.RESOURCE ? RESOURCE : SCOPE).get(type);
        if (pattern == null || id == null) {
            return false;
        }
        if (type.startsWith("GitLab::") && id.length() > GITLAB_MAX_LENGTH) {
            return false;
        }
        return pattern.matcher(id).matches();
    }

    /** @return the regular expression used for the type and kind, or null; for comparison with the JSON Schema */
    public static String pattern(String type, Kind kind) {
        Pattern pattern = (kind == Kind.RESOURCE ? RESOURCE : SCOPE).get(type);
        return pattern == null ? null : pattern.pattern();
    }
}
