package pl.aiwcorpo.mcp.policy.bundle;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.GZIPInputStream;
import pl.aiwcorpo.mcp.policy.bundle.BundleRejectedException.Reason;

/**
 * Reads a gzip-compressed ustar archive into memory, defensively (CC-045): regular files and directories only,
 * name = ustar prefix + name, no absolute names, no {@code .} or {@code ..} segments, no duplicates, checked header
 * checksums, and limits on entry count, entry size and total size after decompression.
 */
public final class TarReader {

    /**
     * @param maxEntries maximum number of entries (files and directories)
     * @param maxEntryBytes maximum size of one file
     * @param maxTotalBytes maximum size of the decompressed archive
     */
    public record Limits(int maxEntries, long maxEntryBytes, long maxTotalBytes) {
        /** 1000 entries, 4 MiB per file, 16 MiB in total. */
        public static final Limits DEFAULT = new Limits(1000, 4L * 1024 * 1024, 16L * 1024 * 1024);
    }

    private static final int BLOCK = 512;

    private TarReader() {
    }

    /** @return file name -> content, in archive order; directories are not listed */
    public static Map<String, byte[]> readGzip(byte[] archive, Limits limits) throws BundleRejectedException {
        byte[] raw = gunzip(archive, limits.maxTotalBytes() + 2L * BLOCK);
        Map<String, byte[]> files = new LinkedHashMap<>();
        int entries = 0;
        int offset = 0;
        while (true) {
            if (offset + BLOCK > raw.length) {
                throw invalid("truncated archive");
            }
            if (isZeroBlock(raw, offset)) {
                break;
            }
            if (++entries > limits.maxEntries()) {
                throw invalid("more than " + limits.maxEntries() + " entries");
            }
            verifyChecksum(raw, offset);
            String name = cString(raw, offset, 100);
            String prefix = cString(raw, offset + 345, 155);
            String fullName = prefix.isEmpty() ? name : prefix + "/" + name;
            long size = octal(raw, offset + 124, 12);
            char type = (char) raw[offset + 156];
            if (size < 0 || size > limits.maxEntryBytes()) {
                throw invalid(fullName + ": size " + size + " outside the limit");
            }
            int dataStart = offset + BLOCK;
            if (dataStart + size > raw.length) {
                throw invalid(fullName + ": truncated content");
            }
            if (type == '5') {
                checkName(fullName.endsWith("/") ? fullName.substring(0, fullName.length() - 1) : fullName);
            } else if (type == '0' || type == 0) {
                checkName(fullName);
                byte[] content = new byte[(int) size];
                System.arraycopy(raw, dataStart, content, 0, (int) size);
                if (files.putIfAbsent(fullName, content) != null) {
                    throw invalid(fullName + ": duplicate entry");
                }
            } else {
                throw invalid(fullName + ": entry type '" + type + "' is not a regular file");
            }
            offset = dataStart + (int) ((size + BLOCK - 1) / BLOCK) * BLOCK;
        }
        return Collections.unmodifiableMap(files);
    }

    private static byte[] gunzip(byte[] archive, long maxBytes) throws BundleRejectedException {
        try (InputStream in = new GZIPInputStream(new ByteArrayInputStream(archive))) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[64 * 1024];
            long total = 0;
            int read;
            while ((read = in.read(buffer)) > 0) {
                total += read;
                if (total > maxBytes) {
                    throw invalid("decompressed size above " + maxBytes + " bytes");
                }
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        } catch (IOException e) {
            throw new BundleRejectedException(Reason.ARCHIVE_INVALID, "not a gzip archive", e);
        }
    }

    private static void checkName(String name) throws BundleRejectedException {
        if (name.isEmpty() || name.startsWith("/") || name.contains("\\")) {
            throw invalid(name + ": absolute or malformed name");
        }
        for (String segment : name.split("/", -1)) {
            if (segment.isEmpty() || segment.equals(".") || segment.equals("..")) {
                throw invalid(name + ": empty, '.' or '..' path segment");
            }
        }
    }

    private static void verifyChecksum(byte[] raw, int offset) throws BundleRejectedException {
        long expected = octal(raw, offset + 148, 8);
        long sum = 0;
        for (int i = 0; i < BLOCK; i++) {
            sum += (i >= 148 && i < 156) ? ' ' : (raw[offset + i] & 0xff);
        }
        if (sum != expected) {
            throw invalid("header checksum mismatch");
        }
    }

    private static boolean isZeroBlock(byte[] raw, int offset) {
        for (int i = 0; i < BLOCK; i++) {
            if (raw[offset + i] != 0) {
                return false;
            }
        }
        return true;
    }

    private static long octal(byte[] raw, int offset, int length) throws BundleRejectedException {
        String text = cString(raw, offset, length).trim();
        if (text.isEmpty() || !text.matches("[0-7]+")) {
            throw invalid("malformed numeric header field");
        }
        return Long.parseLong(text, 8);
    }

    private static String cString(byte[] raw, int offset, int length) {
        int end = offset;
        while (end < offset + length && raw[end] != 0) {
            end++;
        }
        return new String(raw, offset, end - offset, StandardCharsets.UTF_8);
    }

    private static BundleRejectedException invalid(String message) {
        return new BundleRejectedException(Reason.ARCHIVE_INVALID, message);
    }
}
