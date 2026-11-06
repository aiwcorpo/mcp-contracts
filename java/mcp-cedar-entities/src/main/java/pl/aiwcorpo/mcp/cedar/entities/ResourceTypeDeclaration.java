package pl.aiwcorpo.mcp.cedar.entities;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * One entry of {@code resourceTypes} in the server manifest (C6): everything the entity builder knows about a resource
 * type of a server. There is no built-in type; a type exists when a registered server declares it.
 *
 * @param type Cedar entity type {@code <Namespace>::<Name>}, the namespace is the server's Cedar namespace
 * @param attributes attributes the resolver fills from the system, without the parent attribute and {@code scopes}
 * @param parent type of the containing resource, in the same namespace
 * @param parentAttribute Cedar attribute that holds the parent entity; present exactly when {@code parent} is
 * @param idPattern anchored regular expression of the ids of this type
 * @param scopePattern anchored regular expression of the local part of a grantable scope id; empty: the type cannot be
 *        granted in the scope mapping
 * @param earlyScopeCheck whether the gateway puts the id of a tool argument of this type into {@code context.refs};
 *        only for types whose scope is the exact id
 * @param classification the attribute the builder normalizes, if any
 */
public record ResourceTypeDeclaration(
        String type,
        List<String> attributes,
        Optional<String> parent,
        Optional<String> parentAttribute,
        String idPattern,
        Optional<String> scopePattern,
        boolean earlyScopeCheck,
        Optional<Classification> classification) {

    /** Shape of a classification attribute. */
    public enum Kind {
        /** One string. */
        STRING,
        /** A set of strings. */
        SET
    }

    /**
     * Classification attribute (CC-062, CC-067): normalized to trimmed ASCII lower case, sets without duplicates.
     *
     * @param attribute name of the attribute, one of {@code attributes}
     * @param kind string or set of strings
     * @param required whether a resource without the attribute is refused ({@code internal_error})
     */
    public record Classification(String attribute, Kind kind, boolean required) {

        public Classification {
            Objects.requireNonNull(attribute, "attribute");
            Objects.requireNonNull(kind, "kind");
        }
    }

    public ResourceTypeDeclaration {
        Objects.requireNonNull(type, "type");
        attributes = List.copyOf(Objects.requireNonNull(attributes, "attributes"));
        Objects.requireNonNull(parent, "parent");
        Objects.requireNonNull(parentAttribute, "parentAttribute");
        Objects.requireNonNull(idPattern, "idPattern");
        Objects.requireNonNull(scopePattern, "scopePattern");
        Objects.requireNonNull(classification, "classification");
    }

    /** @return the part before {@code ::}, e.g. {@code Jira} */
    public String namespace() {
        return type.substring(0, type.indexOf("::"));
    }
}
