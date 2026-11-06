// The only permit of the gateway: a user may call a tool when they are in the group the tool's risk requires (C9).
// No group, no permit, default deny. Which server a tool belongs to does not matter here.

@id("platform-call-by-group")
permit (principal, action == Action::"call", resource is Tool)
when { principal in resource.requiredGroup };
