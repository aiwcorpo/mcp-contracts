// A user may get a prompt of a server when they are in the group the manifest derives (C9): mcp-<system>-read.

@id("platform-get-prompt-by-group")
permit (principal, action == Action::"get_prompt", resource is McpPrompt)
when { principal in resource.requiredGroup };
