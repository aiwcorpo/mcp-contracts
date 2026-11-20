// A prompt whose manifest entry names an additionalGroup is got only by members of that group as well. This policy can only
// remove access: platform-get-prompt-by-group still needs mcp-<system>-read.

@id("platform-get-prompt-additional-group")
forbid (principal, action == Action::"get_prompt", resource is McpPrompt)
when { resource has additionalGroup && !(principal in resource.additionalGroup) };
