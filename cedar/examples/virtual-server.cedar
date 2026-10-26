// A virtual server only narrows (security invariant 5). These rules are forbids, so a link can never
// add a permission: it can only remove resources outside its resourceDefaults.

@id("vs-narrow-call-jira-project")
forbid (principal, action == Action::"call", resource is Tool)
when {
  context has vsScopes &&
  context.vsScopes has jiraProjects &&
  context has refs &&
  context.refs has jiraProject &&
  !context.vsScopes.jiraProjects.containsAll(context.refs.jiraProject)
};

@id("vs-narrow-call-gitlab-group")
forbid (principal, action == Action::"call", resource is Tool)
when {
  context has vsScopes &&
  context.vsScopes has gitlabGroups &&
  context has refs &&
  context.refs has gitlabGroup &&
  !context.vsScopes.gitlabGroups.containsAll(context.refs.gitlabGroup)
};

@id("vs-narrow-jira-project")
forbid (principal, action, resource is Jira::Project)
when {
  context has vsScopes &&
  context.vsScopes has jiraProjects &&
  !context.vsScopes.jiraProjects.contains(resource.key)
};

@id("vs-narrow-jira-issue")
forbid (principal, action, resource is Jira::Issue)
when {
  context has vsScopes &&
  context.vsScopes has jiraProjects &&
  !context.vsScopes.jiraProjects.contains(resource.project.key)
};

@id("vs-narrow-opensearch-index")
forbid (principal, action, resource is OpenSearch::Index)
when {
  context has vsScopes &&
  context.vsScopes has opensearchIndexPrefixes &&
  !resource.namePrefixes.containsAny(context.vsScopes.opensearchIndexPrefixes)
};
