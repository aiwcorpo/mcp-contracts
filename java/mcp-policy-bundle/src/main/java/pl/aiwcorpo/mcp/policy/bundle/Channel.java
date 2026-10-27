package pl.aiwcorpo.mcp.policy.bundle;

/** Distribution channel of a bundle; each has its own key and its own revision sequence (CC-028). */
public enum Channel {
    /** Regular bundle: schema, policies and static entities. */
    MAIN,
    /** Emergency bundle: forbid policies only, validated against the loaded main bundle's schema. */
    OVERRIDES
}
