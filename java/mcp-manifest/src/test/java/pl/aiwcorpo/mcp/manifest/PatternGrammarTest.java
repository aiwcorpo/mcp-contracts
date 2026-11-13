package pl.aiwcorpo.mcp.manifest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;

class PatternGrammarTest {

    @Test
    void quoteAndControlEscapesAreRefused() {
        for (String pattern : List.of("^\\Q[\\E(a+)+\\Q]\\E$", "^\\Q[\\E(a*)\\1\\Q]\\E$", "^\\Q[\\E(?=a)a\\Q]\\E$", "^a\\Q[\\E|b\\Q]\\E$",
                "^\\c\\(a+\\c\\)+$", "^[\\Q]\\E]$")) {
            assertEquals("quote or control escape", PatternGrammar.violation(pattern), pattern);
        }
        assertNull(PatternGrammar.violation("^[a-z\\-]{1,8}\\.[0-9]$"));
    }
}
