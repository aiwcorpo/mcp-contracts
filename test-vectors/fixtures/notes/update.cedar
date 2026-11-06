// Changes only inside granted scopes; a note carries the scope of its notebook, a folder the scope of every prefix of its path.

@id("notes-update-in-scope")
permit (
  principal in UserGroup::"mcp-notes-write",
  action == Notes::Action::"update",
  resource
)
when { principal in resource.scopes };

@id("notes-delete-in-scope")
permit (
  principal in UserGroup::"mcp-notes-destructive",
  action == Notes::Action::"delete",
  resource is Notes::Note
)
when { principal in resource.scopes };
