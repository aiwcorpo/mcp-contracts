// Reference rendering of the queries a server sends to its system (entity-builder.md, section 8, CC-160). The server
// composes the query from structured fields, never from raw JQL or CQL given by the model, quotes every value and puts the
// user's conditions in parentheses before it adds the scope condition, so that an OR in a value cannot widen the scope.
// The lists of fields, operators and ORDER BY fields below are normative (CC-160): a server may allow fewer, never more, and a
// new field needs a change of the contract. The server, not the model, chooses what is queried.
export const ORDER_FIELDS = { jql: ['created', 'updated', 'priority', 'key'], cql: ['created', 'lastmodified', 'title'] };
const CONDITION_FIELDS = { jql: ['text', 'status', 'assignee', 'summary'], cql: ['text', 'title', 'label'] };
const OPERATORS = ['=', '~', '!='];

export class QueryError extends Error {}

// A value is a quoted literal: backslash and double quote escaped, control characters refused (a newline would end the literal in some parsers).
export function quote(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) throw new QueryError('value is not a plain string');
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function render(language, scopeField, { scope, conditions = [], orderBy }) {
  if (!Array.isArray(scope) || scope.length === 0) throw new QueryError('nothing to query');
  const parts = [];
  if (conditions.length > 0) {
    const rendered = conditions.map(({ field, op, value }) => {
      if (!CONDITION_FIELDS[language].includes(field) || !OPERATORS.includes(op)) throw new QueryError('condition not allowed');
      return `${field} ${op} ${quote(value)}`;
    });
    parts.push(`(${rendered.join(' AND ')})`);
  }
  parts.push(`${scopeField} in (${scope.map(quote).join(', ')})`);
  let query = parts.join(' AND ');
  if (orderBy) {
    if (!ORDER_FIELDS[language].includes(orderBy.field) || !['ASC', 'DESC'].includes(orderBy.direction)) throw new QueryError('order not allowed');
    query += ` ORDER BY ${orderBy.field} ${orderBy.direction}`;
  }
  return query;
}

export const renderJql = (input) => render('jql', 'project', input);
export const renderCql = (input) => render('cql', 'space', input);

// OpenSearch: the pattern used only to list names. For every granted prefix the index of that name and the indices below `<prefix>-`.
export function openSearchPattern(granted) {
  if (granted.length === 0) throw new QueryError('nothing to query');
  return [...new Set(granted)].sort().flatMap((p) => [p, `${p}-*`]).join(',');
}

// The answer of `GET _resolve/index/<pattern>` has indices, aliases and data_streams. Only concrete indices are queried, and only
// when their name is a granted prefix or starts with `<prefix>-`; an alias or a data stream is never queried, whatever its name
// and whatever it points to, because it can reach indices outside the grant. The query then goes to the list of names.
export function resolveIndexNames(granted, resolved) {
  const covered = (name) => granted.some((p) => name === p || name.startsWith(`${p}-`));
  return (resolved.indices ?? []).map((i) => i.name).filter(covered).sort();
}

const INDEX_NAME = /^[a-z0-9][a-z0-9._-]{0,254}$/;

// An index named by the model as an argument (a resource id, CC-056): one concrete name. Anything that is a pattern, a list or a name
// that the pattern of an index refuses (`*`, `_all`, a comma, a leading dot) is invalid_argument before any call to the system. After the
// resolution an alias, a data stream, an index outside the grant and a name the system does not know are all not_found_or_denied.
export function resolveIndexArgument(argument, granted, resolved) {
  if (typeof argument !== 'string' || !INDEX_NAME.test(argument)) return { error: 'invalid_argument' };
  const names = resolveIndexNames(granted, resolved);
  return names.includes(argument) ? { names: [argument] } : { error: 'not_found_or_denied' };
}
