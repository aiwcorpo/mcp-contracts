@id("notes-forbid-restricted-notebook")
forbid (principal, action, resource is Notes::Notebook)
when { resource.labels.contains("restricted") };

@id("notes-forbid-restricted-note")
forbid (principal, action, resource is Notes::Note)
when { resource.notebook.labels.contains("restricted") };

@id("notes-forbid-restricted-folder")
forbid (principal, action, resource is Notes::Folder)
when { resource has classification && resource.classification.contains("restricted") };
