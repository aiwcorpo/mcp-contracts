package pl.aiwcorpo.mcp.policy.bundle;

import com.cedarpolicy.model.policy.PolicySet;
import com.cedarpolicy.model.schema.Schema;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import pl.aiwcorpo.mcp.cedar.entities.McpCedarSchema;

/**
 * Command line lint for the policy pipeline (ws-09): {@code java -cp ... pl.aiwcorpo.mcp.policy.bundle.PolicyLintCli
 * [--overrides] [--schema <file>] <file-or-directory>...}. Checks every {@code *.cedar} file: with {@code --overrides}, no
 * permit at all (C7); without it, no templates; in both modes no policy that the validator calls impossible (CC-183: a
 * policy that can never match, such as a {@code forbid} guarded by an attribute the schema does not have). The schema is
 * {@code cedar/mcp.cedarschema} of this version unless {@code --schema} names another. Exit code 0 when clean, 1 on
 * violations, 2 on usage or parse errors and when the schema or the policies do not validate at all (since 6.0.0, CC-203: such a
 * run used to end with 0).
 */
public final class PolicyLintCli {

    private PolicyLintCli() {
    }

    public static void main(String[] args) {
        System.exit(run(args, System.out, System.err));
    }

    static int run(String[] args, PrintStream out, PrintStream err) {
        boolean overrides = false;
        Path schemaFile = null;
        List<Path> inputs = new ArrayList<>();
        for (int i = 0; i < args.length; i++) {
            if ("--overrides".equals(args[i])) {
                overrides = true;
            } else if ("--schema".equals(args[i]) && i + 1 < args.length) {
                schemaFile = Path.of(args[++i]);
            } else {
                inputs.add(Path.of(args[i]));
            }
        }
        if (inputs.isEmpty()) {
            err.println("usage: PolicyLintCli [--overrides] [--schema <file>] <file-or-directory>...");
            return 2;
        }
        int violations = 0;
        try {
            Schema schema = schemaFile == null ? McpCedarSchema.schema() : new Schema(Files.readString(schemaFile));
            for (Path file : cedarFiles(inputs)) {
                PolicySet set = PolicySet.parsePolicies(Files.readString(file));
                List<String> found = new ArrayList<>(PolicyLint.templates(set));
                if (overrides) {
                    found.addAll(PolicyLint.permits(set));
                }
                found.addAll(PolicyLint.impossible(schema, set));
                for (String violation : found) {
                    out.println(file + ": " + violation);
                }
                violations += found.size();
            }
        } catch (Exception e) {
            err.println("cannot lint: " + e.getMessage());
            return 2;
        }
        return violations == 0 ? 0 : 1;
    }

    private static List<Path> cedarFiles(List<Path> inputs) throws IOException {
        List<Path> files = new ArrayList<>();
        for (Path input : inputs) {
            if (Files.isDirectory(input)) {
                try (Stream<Path> walk = Files.walk(input)) {
                    walk.filter(p -> p.toString().endsWith(".cedar")).sorted().forEach(files::add);
                }
            } else {
                files.add(input);
            }
        }
        return files;
    }
}
