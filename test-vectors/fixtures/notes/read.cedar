@id("notes-read")
permit (
  principal in UserGroup::"mcp-notes-read",
  action == Notes::Action::"read",
  resource
)
when { resource is Notes::Notebook || resource is Notes::Note || resource is Notes::Folder };
