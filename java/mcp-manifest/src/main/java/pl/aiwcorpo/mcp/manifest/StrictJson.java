package pl.aiwcorpo.mcp.manifest;

import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;

/**
 * Parser shared by this module. A duplicate key or trailing content would let two readers see different
 * documents behind the same hash, so both are errors (review 2.0.0 L6).
 */
final class StrictJson {

    static final ObjectMapper MAPPER = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .build();

    private StrictJson() {
    }
}
