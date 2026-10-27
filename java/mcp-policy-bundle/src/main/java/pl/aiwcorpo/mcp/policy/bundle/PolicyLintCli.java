package pl.aiwcorpo.mcp.policy.bundle;

import com.cedarpolicy.model.policy.PolicySet;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * Command line lint for the policy pipeline (ws-09): {@code java -cp ... pl.aiwcorpo.mcp.policy.bundle.PolicyLintCli
 * [--overrides] <file-or-directory>...}. Checks every {@code *.cedar} file: context.vsScopes only in forbid
 * (CC-041) and, with {@code --overrides}, no permit at all (C7). Exit code 0 when clean, 1 on violations, 2 on
 * usage or parse errors.
 */
public final class PolicyLintCli {

    private PolicyLintCli() {
    }

    public static void main(String[] args) {
        boolean overrides = false;
        List<Path> inputs = new ArrayList<>();
        for (String arg : args) {
            if ("--overrides".equals(arg)) {
                overrides = true;
            } else {
                inputs.add(Path.of(arg));
            }
        }
        if (inputs.isEmpty()) {
            System.err.println("usage: PolicyLintCli [--overrides] <file-or-directory>...");
            System.exit(2);
        }
        int violations = 0;
        try {
            for (Path file : cedarFiles(inputs)) {
                PolicySet set = PolicySet.parsePolicies(Files.readString(file));
                List<String> found = new ArrayList<>(PolicyLint.vsScopesOutsideForbid(set));
                if (overrides) {
                    found.addAll(PolicyLint.permits(set));
                }
                for (String violation : found) {
                    System.out.println(file + ": " + violation);
                }
                violations += found.size();
            }
        } catch (Exception e) {
            System.err.println("cannot lint: " + e.getMessage());
            System.exit(2);
        }
        System.exit(violations == 0 ? 0 : 1);
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
