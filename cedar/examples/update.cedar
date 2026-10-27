// Server-level evaluation (C7): changes only inside resources granted by the bundle's scope mapping
// (entities/static.json, CC-037). `principal in resource.scopes` is true when one of the user's groups is
// mapped to the resource itself or to any of its containers, so a grant on GitLab group team-a covers
// team-a/sub/app but not team-ab.

@id("jira-update-project-in-scope")
permit (
  principal in UserGroup::"mcp-jira-write",
  action == Action::"update",
  resource is Jira::Project
)
when { principal in resource.scopes };

@id("jira-update-issue-in-scope")
permit (
  principal in UserGroup::"mcp-jira-write",
  action == Action::"update",
  resource is Jira::Issue
)
when { principal in resource.scopes };

@id("jira-delete-issue-in-scope")
permit (
  principal in UserGroup::"mcp-jira-destructive",
  action == Action::"delete",
  resource is Jira::Issue
)
when { principal in resource.scopes };

@id("gitlab-update-group-in-scope")
permit (
  principal in UserGroup::"mcp-gitlab-write",
  action == Action::"update",
  resource is GitLab::Group
)
when { principal in resource.scopes };

@id("gitlab-update-project-in-scope")
permit (
  principal in UserGroup::"mcp-gitlab-write",
  action == Action::"update",
  resource is GitLab::Project
)
when { principal in resource.scopes };

// A page tree granted through Confluence::Page/<root> covers every page below the root.
@id("confluence-update-page-in-scope")
permit (
  principal in UserGroup::"mcp-confluence-write",
  action == Action::"update",
  resource is Confluence::Page
)
when { principal in resource.scopes };
