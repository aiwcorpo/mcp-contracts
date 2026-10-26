// Server-level evaluation (C7): reading a resolved resource. Reading follows the user's own rights in the
// backend system; the platform only adds the classification and virtual server limits (other files).

@id("jira-read")
permit (
  principal in UserGroup::"mcp-jira-read",
  action == Action::"read",
  resource
)
when { resource is Jira::Project || resource is Jira::Issue };

@id("gitlab-read")
permit (
  principal in UserGroup::"mcp-gitlab-read",
  action == Action::"read",
  resource
)
when { resource is GitLab::Group || resource is GitLab::Project };

@id("confluence-read")
permit (
  principal in UserGroup::"mcp-confluence-read",
  action == Action::"read",
  resource
)
when { resource is Confluence::Space || resource is Confluence::Page };

@id("servicedesk-read")
permit (
  principal in UserGroup::"mcp-servicedesk-read",
  action == Action::"read",
  resource
)
when { resource is ServiceDesk::Queue || resource is ServiceDesk::Ticket };

// OpenSearch has no per-user rights in the backend beyond FLS, so reading is limited to granted index prefixes.
@id("opensearch-read-in-scope")
permit (
  principal in UserGroup::"mcp-opensearch-read",
  action == Action::"read",
  resource is OpenSearch::Index
)
when { resource.namePrefixes.containsAny(principal.scopes.opensearchIndexPrefixes) };
