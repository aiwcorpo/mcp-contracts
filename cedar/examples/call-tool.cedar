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

// Writes are allowed only inside scope groups (mcp-jira-proj-*). The gateway can check this early when the
// tool takes a project key; for issue keys only the server knows the real project.
@id("jira-call-write-outside-scope")
forbid (principal, action == Action::"call", resource is Tool)
when {
  resource.server == "mcp-jira" &&
  resource.risk != "READ_ONLY" &&
  context has refs &&
  context.refs has jiraProject &&
  !principal.scopes.jiraProjects.containsAll(context.refs.jiraProject)
};

@id("gitlab-call-write-outside-scope")
forbid (principal, action == Action::"call", resource is Tool)
when {
  resource.server == "mcp-gitlab" &&
  resource.risk != "READ_ONLY" &&
  context has refs &&
  context.refs has gitlabGroup &&
  !principal.scopes.gitlabGroups.containsAll(context.refs.gitlabGroup)
};
