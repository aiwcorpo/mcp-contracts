// Server-level evaluation (C7): changes only inside resources granted through scope groups (C9).

@id("jira-update-project-in-scope")
permit (
  principal in UserGroup::"mcp-jira-write",
  action == Action::"update",
  resource is Jira::Project
)
when { principal.scopes.jiraProjects.contains(resource.key) };

@id("jira-update-issue-in-scope")
permit (
  principal in UserGroup::"mcp-jira-write",
  action == Action::"update",
  resource is Jira::Issue
)
when { principal.scopes.jiraProjects.contains(resource.project.key) };

@id("jira-delete-issue-in-scope")
permit (
  principal in UserGroup::"mcp-jira-destructive",
  action == Action::"delete",
  resource is Jira::Issue
)
when { principal.scopes.jiraProjects.contains(resource.project.key) };

@id("gitlab-update-project-in-scope")
permit (
  principal in UserGroup::"mcp-gitlab-write",
  action == Action::"update",
  resource is GitLab::Project
)
when { principal.scopes.gitlabGroups.contains(resource.group.path) };
