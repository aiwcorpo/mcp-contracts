// Destructive tools need an authentication at MFA level within the last hour. The gateway reports this
// deny as step_up_required (C10). A missing mfa claim means "unknown" (C2) and is treated as stale.

@id("destructive-requires-fresh-mfa")
forbid (principal, action == Action::"call", resource is Tool)
when { resource.risk == "DESTRUCTIVE" }
unless { context has mfaAge && context.mfaAge < 3600 };
