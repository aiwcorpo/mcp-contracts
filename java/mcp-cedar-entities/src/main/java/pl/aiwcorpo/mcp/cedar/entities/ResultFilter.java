package pl.aiwcorpo.mcp.cedar.entities;

import com.cedarpolicy.AuthorizationEngine;
import com.cedarpolicy.model.AuthorizationResponse;
import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
