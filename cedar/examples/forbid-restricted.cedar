// Data classified as restricted is never available to AI agents, whatever the user may do in the system.
// forbid overrides every permit, so no group or scope can open it. The entity builder normalizes classification
// values (trim, ASCII lower case), so the canonical value is "restricted" in every system (CC-067).

@id("jira-forbid-restricted-project")
forbid (principal, action, resource is Jira::Project)
when { resource.category == "restricted" };

@id("jira-forbid-restricted-issue")
forbid (principal, action, resource is Jira::Issue)
when { resource.project.category == "restricted" };

@id("confluence-forbid-restricted-space")
forbid (principal, action, resource is Confluence::Space)
when { resource.labels.contains("restricted") };

@id("confluence-forbid-restricted-page")
forbid (principal, action, resource is Confluence::Page)
when { resource.space.labels.contains("restricted") };

@id("opensearch-forbid-restricted-index")
forbid (principal, action, resource is OpenSearch::Index)
when { resource.tags.contains("restricted") };

// A topic is not inherited in GitLab, so a restricted group protects its whole subtree through inheritedClassification
// (the union of the classification of every ancestor group, filled by the entity builder, CC-129).
@id("gitlab-forbid-restricted-group")
forbid (principal, action, resource is GitLab::Group)
when {
  (resource has classification && resource.classification.contains("restricted")) ||
  resource.inheritedClassification.contains("restricted")
};

@id("gitlab-forbid-restricted-project")
forbid (principal, action, resource is GitLab::Project)
when {
  (resource has classification && resource.classification.contains("restricted")) ||
  (resource.group has classification && resource.group.classification.contains("restricted")) ||
  resource.inheritedClassification.contains("restricted")
};

@id("servicedesk-forbid-restricted-queue")
forbid (principal, action, resource is ServiceDesk::Queue)
when { resource has classification && resource.classification.contains("restricted") };

@id("servicedesk-forbid-restricted-ticket")
forbid (principal, action, resource is ServiceDesk::Ticket)
when { resource.queue has classification && resource.queue.classification.contains("restricted") };
