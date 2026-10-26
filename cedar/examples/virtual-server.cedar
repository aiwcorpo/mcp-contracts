// A virtual server only narrows (security invariant 5). These rules are forbids, so a link can never
// add a permission: it can only remove resources outside its narrowing (context.vsScopes, from the vsc claim).
//
// Every type a link can narrow (C5 resourceDefaults: Jira::Project, Confluence::Space, GitLab::Group,
// OpenSearch::Index, ServiceDesk::Queue) is enforced on the server for the type and its children. The gateway
// can check only arguments that name the narrowed type itself; issue keys, page ids, project paths, ticket ids
// and index names reveal their container only after the server resolves them. A policy bundle (ws-09) must keep
// a rule for every narrowable type; a missing rule silently widens the link.

// ---------- gateway: Action::"call" with ids from resourceRefs ----------

@id("vs-narrow-call-jira-project")
forbid (principal, action == Action::"call", resource is Tool)
when {
  context has vsScopes &&
  context.vsScopes has jiraProjects &&
  context has refs &&
  context.refs has jiraProject &&
  !context.vsScopes.jiraProjects.containsAll(context.refs.jiraProject)
};

@id("vs-narrow-call-confluence-space")
forbid (principal, action == Action::"call", resource is Tool)
when {
  context has vsScopes &&
  context.vsScopes has confluenceSpaces &&
  context has refs &&
  context.refs has confluenceSpace &&
  !context.vsScopes.confluenceSpaces.containsAll(context.refs.confluenceSpace)
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

@id("vs-narrow-call-servicedesk-queue")
forbid (principal, action == Action::"call", resource is Tool)
when {
  context has vsScopes &&
  context.vsScopes has servicedeskQueues &&
  context has refs &&
  context.refs has servicedeskQueue &&
  !context.vsScopes.servicedeskQueues.containsAll(context.refs.servicedeskQueue)
};

// ---------- server: action on the resolved resource ----------

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

@id("vs-narrow-confluence-space")
forbid (principal, action, resource is Confluence::Space)
when {
  context has vsScopes &&
  context.vsScopes has confluenceSpaces &&
  !context.vsScopes.confluenceSpaces.contains(resource.key)
};

@id("vs-narrow-confluence-page")
forbid (principal, action, resource is Confluence::Page)
when {
  context has vsScopes &&
  context.vsScopes has confluenceSpaces &&
  !context.vsScopes.confluenceSpaces.contains(resource.space.key)
};

@id("vs-narrow-gitlab-group")
forbid (principal, action, resource is GitLab::Group)
when {
  context has vsScopes &&
  context.vsScopes has gitlabGroups &&
  !context.vsScopes.gitlabGroups.contains(resource.path)
};

@id("vs-narrow-gitlab-project")
forbid (principal, action, resource is GitLab::Project)
when {
  context has vsScopes &&
  context.vsScopes has gitlabGroups &&
  !context.vsScopes.gitlabGroups.contains(resource.group.path)
};

@id("vs-narrow-opensearch-index")
forbid (principal, action, resource is OpenSearch::Index)
when {
  context has vsScopes &&
  context.vsScopes has opensearchIndexPrefixes &&
  !resource.namePrefixes.containsAny(context.vsScopes.opensearchIndexPrefixes)
};

@id("vs-narrow-servicedesk-queue")
forbid (principal, action, resource is ServiceDesk::Queue)
when {
  context has vsScopes &&
  context.vsScopes has servicedeskQueues &&
  !context.vsScopes.servicedeskQueues.contains(resource.id)
};

@id("vs-narrow-servicedesk-ticket")
forbid (principal, action, resource is ServiceDesk::Ticket)
when {
  context has vsScopes &&
  context.vsScopes has servicedeskQueues &&
  !context.vsScopes.servicedeskQueues.contains(resource.queue.id)
};
