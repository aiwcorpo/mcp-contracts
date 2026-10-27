package pl.aiwcorpo.mcp.manifest;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

public final class ContractFiles {

    private ContractFiles() {
    }

    public static Path root() {
        return Path.of(System.getProperty("contracts.root", ".")).toAbsolutePath().normalize();
    }

    public static Path resolve(String relative) {
        return root().resolve(relative);
    }

    public static String read(Path path) {
        try {
            return Files.readString(path);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static List<Path> list(String relativeDir, String suffix) {
        try (Stream<Path> files = Files.list(resolve(relativeDir))) {
            return files.filter(p -> p.getFileName().toString().endsWith(suffix)).sorted().toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
