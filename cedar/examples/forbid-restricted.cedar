// Data classified as Restricted is never available to AI agents, whatever the user may do in the system.
// forbid overrides every permit, so no group or scope can open it.

@id("jira-forbid-restricted-project")
forbid (principal, action, resource is Jira::Project)
when { resource has category && resource.category == "Restricted" };

@id("jira-forbid-restricted-issue")
forbid (principal, action, resource is Jira::Issue)
when { resource.project has category && resource.project.category == "Restricted" };

@id("confluence-forbid-restricted-space")
forbid (principal, action, resource is Confluence::Space)
when { resource.labels.contains("restricted") };

@id("confluence-forbid-restricted-page")
forbid (principal, action, resource is Confluence::Page)
when { resource.space.labels.contains("restricted") };
