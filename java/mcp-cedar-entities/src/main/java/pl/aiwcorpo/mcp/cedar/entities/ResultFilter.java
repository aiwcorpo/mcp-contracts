package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.AuthorizationEngine;
import com.cedarpolicy.model.AuthorizationResponse;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

/**
 * Filters the elements a search or list tool returns (CC-036): every element is evaluated with
 * {@link EntityBuilder#forResource} and kept only when the authorizer allows it. An element that cannot be
 * resolved, built or evaluated is dropped, never returned (fail-closed); a dropped element is not an error of the call.
 */
public final class ResultFilter {

    /** Policy evaluation of one request, e.g. cedar-java {@code isAuthorized} with the loaded bundle. */
    @FunctionalInterface
    public interface Authorizer {
        /** @return true only for an explicit allow; errors must be reported as false or as an exception */
        boolean isAllowed(CedarRequest request) throws Exception;
    }

    /**
     * Authorizer on cedar-java that counts only a clean allow: a failed request, a deny, or an allow with evaluation
     * errors in the diagnostics (a policy that errored, e.g. a forbid on a missing attribute) all mean "drop".
     */
    public static Authorizer cedarAuthorizer(AuthorizationEngine engine, PolicySet policies, Schema schema) {
        Objects.requireNonNull(engine, "engine");
        Objects.requireNonNull(policies, "policies");
        Objects.requireNonNull(schema, "schema");
        return request -> {
            AuthorizationResponse response = engine.isAuthorized(request.toAuthorizationRequest(schema), policies,
                    request.cedarEntities());
            return response.success.map(s -> s.isAllowed() && s.getErrors().isEmpty()).orElse(false);
        };
    }

    private final EntityBuilder builder;
    private final Authorizer authorizer;

    public ResultFilter(EntityBuilder builder, Authorizer authorizer) {
        this.builder = Objects.requireNonNull(builder, "builder");
        this.authorizer = Objects.requireNonNull(authorizer, "authorizer");
    }

    /**
     * CC-061: a call is allowed only if every value of every resourceRef argument (array elements, source and
     * target, the container a resource is created in) is allowed on its own. The caller resolves one resource per
     * value; an empty list, a resource that cannot be built or evaluated, or any deny gives false.
     *
     * @param resources one resolved resource per value of every resourceRef argument
     */
    public boolean allAllowed(Caller caller, ToolDescriptor tool, Map<String, ?> arguments, List<ResolvedResource> resources) {
        if (resources.isEmpty()) {
            return false;
        }
        for (ResolvedResource resource : resources) {
            try {
                if (!authorizer.isAllowed(builder.forResource(caller, tool, arguments, resource))) {
                    return false;
                }
            } catch (Exception e) {
                return false;
            }
        }
        return true;
    }

    /** Resolves one resource id from a tool argument to the resource as the system reports it. */
    @FunctionalInterface
    public interface ResourceResolver {
        /**
         * @param type Cedar type from the manifest resourceRef, e.g. {@code GitLab::Group}
         * @param id the argument value (already checked against the id pattern)
         * @return the resource with canonical id, parent and classification from the system
         */
        ResolvedResource resolve(String type, String id) throws Exception;
    }

    /**
     * Outcome of {@link #checkAll}.
     *
     * @param allowed true only when every evaluated resource was allowed
     * @param deniedType type of the first resource that was not allowed
     * @param deniedId id (argument value or container id) of that resource
     * @param reason why: "denied", "not_resolved", "invalid_argument" or "evaluation_error"
     */
    public record CheckResult(boolean allowed, Optional<String> deniedType, Optional<String> deniedId, Optional<String> reason) {

        static CheckResult ok() {
            return new CheckResult(true, Optional.empty(), Optional.empty(), Optional.empty());
        }

        static CheckResult denied(String type, String id, String reason) {
            return new CheckResult(false, Optional.ofNullable(type), Optional.ofNullable(id), Optional.of(reason));
        }
    }

    /**
     * CC-061 without relying on the caller to list the resources: enumerates every value of every resourceRef from
     * {@code tool} and {@code arguments}, resolves each with {@code resolver} and evaluates it, then evaluates the
     * creation container if one is given. Stops at the first value that is not allowed (review 2.0.0 M5). A tool
     * whose resourceRef arguments are all absent has nothing to check here and is allowed; its results still go
     * through {@link #allowed}.
     *
     * @param creationContainer the group, project, space or queue a new resource is created in, if the tool creates one
     */
    public CheckResult checkAll(Caller caller, ToolDescriptor tool, Map<String, ?> arguments, ResourceResolver resolver,
            Optional<ResolvedResource> creationContainer) {
        List<Map.Entry<String, String>> values;
        try {
            values = EntityBuilder.resourceValues(tool, arguments);
        } catch (EntityBuilderException e) {
            return CheckResult.denied(null, null, e.code() == EntityBuilderException.Code.INVALID_ARGUMENT ? "invalid_argument" : "evaluation_error");
        }
        for (Map.Entry<String, String> value : values) {
            ResolvedResource resource;
            try {
                resource = resolver.resolve(value.getKey(), value.getValue());
            } catch (Exception e) {
                return CheckResult.denied(value.getKey(), value.getValue(), "not_resolved");
            }
            CheckResult result = evaluate(caller, tool, arguments, resource, value.getKey(), value.getValue());
            if (!result.allowed()) {
                return result;
            }
        }
        if (creationContainer.isPresent()) {
            ResolvedResource container = creationContainer.get();
            return evaluate(caller, tool, arguments, container, container.type(), container.id());
        }
        return CheckResult.ok();
    }

    private CheckResult evaluate(Caller caller, ToolDescriptor tool, Map<String, ?> arguments, ResolvedResource resource,
            String type, String id) {
        try {
            return authorizer.isAllowed(builder.forResource(caller, tool, arguments, resource))
                    ? CheckResult.ok() : CheckResult.denied(type, id, "denied");
        } catch (Exception e) {
            return CheckResult.denied(type, id, "evaluation_error");
        }
    }

    /**
     * @param items elements returned by the backend, in backend order
     * @param toResource resolves an element to the resource the policy is evaluated on (with its parent)
     * @return allowed elements in the original order
     */
    public <T> List<T> allowed(Caller caller, ToolDescriptor tool, Map<String, ?> arguments, List<T> items,
            Function<? super T, ResolvedResource> toResource) {
        List<T> kept = new ArrayList<>(items.size());
        for (T item : items) {
            try {
                if (authorizer.isAllowed(builder.forResource(caller, tool, arguments, toResource.apply(item)))) {
                    kept.add(item);
                }
            } catch (Exception e) {
                // fail-closed: an element that cannot be evaluated is not returned
            }
        }
        return kept;
    }
}
