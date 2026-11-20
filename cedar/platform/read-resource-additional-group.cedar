// A resource whose manifest entry names an additionalGroup is read only by members of that group as well. This policy can
// only remove access: platform-read-resource-by-group still needs mcp-<system>-read.

@id("platform-read-resource-additional-group")
forbid (principal, action == Action::"read_resource", resource is McpResource)
when { resource has additionalGroup && !(principal in resource.additionalGroup) };
