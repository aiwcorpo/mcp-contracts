// A tool whose manifest names an additionalGroup is called only by members of that group as well. This policy can only
// remove access: platform-call-by-group still needs the group that the risk derives.

@id("platform-call-additional-group")
forbid (principal, action == Action::"call", resource is Tool)
when { resource has additionalGroup && !(principal in resource.additionalGroup) };
