// Reference for prompts/get (CC-259): the gateway renders the result from the approved manifest entry and calls no server. test-vectors/
// prompt-render/ pins it. Every refusal about the name or an argument is one answer, -32602 "Prompt not found" with the requested name
// in data, so that a client cannot tell an unknown prompt from a forbidden one or from a bad argument.
import { checkArgument } from './text-hygiene.mjs';

/** The characters that a value never carries, whatever pattern the author wrote: they would let a value close or open a marker of the template. */
const FORBIDDEN_IN_VALUE = /[<>{}]/;

export const promptNotFound = (name) => ({ code: -32602, message: 'Prompt not found', data: { name } });

function argumentProblem(rule, value, typePatterns) {
  if (typeof value !== 'string') return 'not_a_string';
  if (value.length > rule.maxLength) return 'too_long';
  if (!checkArgument(value, { identifier: true }).valid) return 'text_hygiene';
  if (FORBIDDEN_IN_VALUE.test(value)) return 'forbidden_character';
  if (!new RegExp(rule.pattern, 'u').test(value)) return 'pattern';
  if (rule.type !== undefined && !new RegExp(typePatterns[rule.type], 'u').test(value)) return 'type';
  return null;
}

/**
 * `prompt` is the manifest entry { name, definition: { description, arguments: [{ name, required }] }, argumentRules, messages };
 * `typePatterns` maps a ResourceType to its idPattern; `args` is params.arguments (an object, or undefined); `era` is modern (the result
 * carries resultType, and nothing else of CacheableResult) or legacy (it does not). Returns { result } or
 * { error, reason }. The reason is for the audit only (argument_invalid), never in the answer.
 */
export function renderPrompt({ prompt, typePatterns = {}, args, era = 'modern' }) {
  const fail = () => ({ error: promptNotFound(prompt.name), reason: 'argument_invalid' });
  const given = args === undefined || args === null ? {} : args;
  if (typeof given !== 'object' || Array.isArray(given)) return fail();
  const declared = prompt.definition.arguments ?? [];
  const names = new Set(declared.map((a) => a.name));
  if (Object.keys(given).some((name) => !names.has(name))) return fail();
  if (declared.some((a) => a.required === true && !Object.hasOwn(given, a.name))) return fail();
  for (const argument of declared) {
    if (!Object.hasOwn(given, argument.name)) continue;
    const rule = prompt.argumentRules.find((r) => r.name === argument.name);
    if (argumentProblem(rule, given[argument.name], typePatterns) !== null) return fail();
  }
  const substitute = (text) => text.replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (_, name) => (Object.hasOwn(given, name) ? given[name] : ''));
  return {
    result: {
      ...(era === 'modern' && { resultType: 'complete' }),
      description: prompt.definition.description,
      messages: prompt.messages.map((m) => ({ role: m.role, content: { type: 'text', text: substitute(m.text) } })),
    },
  };
}

/** Which check refuses an argument first, for the vectors that pin the order of the checks. */
export const firstProblem = (rule, value, typePatterns = {}) => argumentProblem(rule, value, typePatterns);
