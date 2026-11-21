// A policy of a server that reads context.principalType (CC-263): an agent never reads a folder, whatever its groups grant.

@id("notes-agent-no-folder")
forbid (principal, action, resource is Notes::Folder)
when { context has principalType && context.principalType == "agent" };
