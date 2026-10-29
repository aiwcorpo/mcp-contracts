// Gateway-level evaluation (C7): may this user call this tool at all?
// A tool needs the group that matches its risk (C9). No group, no permit, default deny.

@id("jira-call-read")
permit (
  principal in UserGroup::"mcp-jira-read",
  action == Action::"call",
  resource is Tool
)
when { resource.server == "mcp-jira" && resource.risk == "READ_ONLY" };

@id("jira-call-update")
permit (
  principal in UserGroup::"mcp-jira-write",
  action == Action::"call",
  resource is Tool
)
when { resource.server == "mcp-jira" && resource.risk == "UPDATE" };

@id("jira-call-destructive")
permit (
  principal in UserGroup::"mcp-jira-destructive",
  action == Action::"call",
  resource is Tool
)
when { resource.server == "mcp-jira" && resource.risk == "DESTRUCTIVE" };

@id("gitlab-call-read")
permit (
  principal in UserGroup::"mcp-gitlab-read",
  action == Action::"call",
  resource is Tool
)
when { resource.server == "mcp-gitlab" && resource.risk == "READ_ONLY" };

@id("gitlab-call-update")
permit (
  principal in UserGroup::"mcp-gitlab-write",
  action == Action::"call",
  resource is Tool
)
when { resource.server == "mcp-gitlab" && resource.risk == "UPDATE" };

@id("confluence-call-read")
permit (
  principal in UserGroup::"mcp-confluence-read",
  action == Action::"call",
  resource is Tool
)
when { resource.server == "mcp-confluence" && resource.risk == "READ_ONLY" };

@id("servicedesk-call-read")
permit (
  principal in UserGroup::"mcp-servicedesk-read",
  action == Action::"call",
  resource is Tool
)
when { resource.server == "mcp-servicedesk" && resource.risk == "READ_ONLY" };

@id("opensearch-call-read")
permit (
  principal in UserGroup::"mcp-opensearch-read",
  action == Action::"call",
  resource is Tool
)
when { resource.server == "mcp-opensearch" && resource.risk == "READ_ONLY" };

// Writes are allowed only inside granted scopes (entities/static.json). The gateway checks this early only for
// flat scope types named directly by an argument (here a Jira project key). Hierarchical types (GitLab groups,
// OpenSearch prefixes, Confluence page trees) and ids whose container is unknown before resolution (issue keys)
// are checked by the server with `principal in resource.scopes`.
@id("jira-call-write-outside-scope")
forbid (principal, action == Action::"call", resource is Tool)
when {
  resource.server == "mcp-jira" &&
  resource.risk != "READ_ONLY" &&
  context has refs &&
  context.refs has jiraProject &&
  !principal.scopes.jiraProjects.containsAll(context.refs.jiraProject)
};

// Calls that change data (risk UPDATE) need the write group of the system (C9). Where the change is bounded by a scope
// (Confluence spaces and pages, service desk queues), the server checks `principal in resource.scopes` (update.cedar).
@id("confluence-call-update")
permit (
  principal in UserGroup::"mcp-confluence-write",
  action == Action::"call",
  resource is Tool
)
when { resource.server == "mcp-confluence" && resource.risk == "UPDATE" };

@id("servicedesk-call-update")
permit (
  principal in UserGroup::"mcp-servicedesk-write",
  action == Action::"call",
  resource is Tool
)
when { resource.server == "mcp-servicedesk" && resource.risk == "UPDATE" };

@id("opensearch-call-update")
permit (
  principal in UserGroup::"mcp-opensearch-write",
  action == Action::"call",
  resource is Tool
)
when { resource.server == "mcp-opensearch" && resource.risk == "UPDATE" };
