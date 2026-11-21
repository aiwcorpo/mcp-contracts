// A user may read a static resource or a resource template of a server when they are in the group the manifest derives (C9):
// mcp-<system>-read. No group, no permit, default deny. The scope hierarchy is not checked here: the container of a
// hierarchical resource is known only after resolution, so the server checks `principal in resource.scopes`.

@id("platform-read-resource-by-group")
permit (principal, action == Action::"read_resource", resource is McpResource)
when { principal in resource.requiredGroup };
