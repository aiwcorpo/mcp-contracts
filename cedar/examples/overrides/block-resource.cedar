// An emergency block of one resource of any server: the handbook is withdrawn until the owner has checked it. The gateway
// reports the deny as not_found_or_denied (C10).

@id("override-block-resource-internal-handbook")
forbid (principal, action == Action::"read_resource", resource is McpResource)
when { resource.name == "internal_handbook" };
