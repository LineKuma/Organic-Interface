/**
 * Conversation History Resolver
 *
 * Resolves {{history:...}} macros to retrieve conversation history.
 *
 * This is the most powerful macro type, supporting:
 * - Context ID specification (or "current" for active context)
 * - Range queries (first N, last N, range start:end)
 * - Filtering by sender type, message type, content substring
 * - Custom formatting
 */

import type {
  MacroExpression,
  MacroResolveResult,
  MacroResolutionContext,
  HistoryQuery,
  HistoryFilter,
} from '../types/macro.js';

import type { Message } from '@organic/agent';

/**
 * Parse history macro arguments into a HistoryQuery
 *
 * Syntax variants:
 *   {{history:context_id}}                     - Full history
 *   {{history:current}}                        - Current context
 *   {{history:context_id:last:N}}              - Last N messages
 *   {{history:context_id:first:N}}             - First N messages
 *   {{history:context_id:range:start:end}}     - Range of messages
 *   {{history:context_id:filter:sender:name}}  - Filter by sender type
 *   {{history:context_id:filter:type:msg_type}} - Filter by message type
 *   {{history:context_id:filter:contains:text}} - Filter by content substring
 */
function parseHistoryQuery(args: string[]): HistoryQuery | null {
  if (args.length === 0) {
    return null;
  }

  const contextId = args[0];
  const query: HistoryQuery = { contextId };

  let i = 1;
  while (i < args.length) {
    const cmd = args[i].toLowerCase();

    switch (cmd) {
      case 'last':
        if (args[i + 1]) {
          query.lastN = parseInt(args[i + 1], 10);
          if (isNaN(query.lastN)) query.lastN = undefined;
          i += 2;
        } else {
          i++;
        }
        break;

      case 'first':
        if (args[i + 1]) {
          query.firstN = parseInt(args[i + 1], 10);
          if (isNaN(query.firstN)) query.firstN = undefined;
          i += 2;
        } else {
          i++;
        }
        break;

      case 'range':
        if (args[i + 1] && args[i + 2]) {
          const start = parseInt(args[i + 1], 10);
          const end = parseInt(args[i + 2], 10);
          if (!isNaN(start) && !isNaN(end)) {
            query.range = { start, end };
          }
          i += 3;
        } else {
          i++;
        }
        break;

      case 'filter':
        if (args[i + 1] && args[i + 2]) {
          const filterField = args[i + 1].toLowerCase();
          const filterValue = args[i + 2];
          query.filter = query.filter ?? {};

          switch (filterField) {
            case 'sender':
              query.filter.sender = filterValue;
              break;
            case 'type':
              query.filter.type = filterValue;
              break;
            case 'contains':
              query.filter.contains = filterValue;
              break;
          }

          i += 3;
        } else {
          i++;
        }
        break;

      default:
        i++;
        break;
    }
  }

  return query;
}

/**
 * Apply range constraints to a message array
 */
function applyRange(messages: Message[], query: HistoryQuery): Message[] {
  if (query.lastN !== undefined) {
    return messages.slice(-query.lastN);
  }

  if (query.firstN !== undefined) {
    return messages.slice(0, query.firstN);
  }

  if (query.range) {
    const start = query.range.start ?? 0;
    const end = query.range.end ?? messages.length;
    return messages.slice(start, end);
  }

  return messages;
}

/**
 * Apply filter constraints to a message array
 */
function applyFilter(messages: Message[], filter: HistoryFilter): Message[] {
  return messages.filter(msg => {
    // Filter by sender type (user, agent, system, plugin)
    if (filter.sender !== undefined && msg.sender.type !== filter.sender) {
      return false;
    }

    // Filter by message type
    if (filter.type !== undefined && msg.type !== filter.type) {
      return false;
    }

    // Filter by content substring
    if (filter.contains !== undefined) {
      const text = msg.content.text ?? '';
      if (!text.includes(filter.contains)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Format messages for display
 */
function formatMessages(messages: Message[]): string {
  if (messages.length === 0) {
    return '(no messages)';
  }

  return messages
    .map((msg, idx) => {
      const sender = `[${msg.sender.type}:${msg.sender.name}]`;
      const timestamp = msg.timestamp ? new Date(msg.timestamp).toISOString() : '';
      const header = `#${idx + 1} ${sender} ${timestamp}`;
      const text = msg.content.text ?? '';
      return `${header}\n${text}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Resolve a conversation history macro
 *
 * @param expression - The parsed macro expression
 * @param context - Resolution context with message retrieval
 * @returns Resolution result
 */
export async function resolveHistory(
  expression: MacroExpression,
  context: MacroResolutionContext
): Promise<MacroResolveResult> {
  // Parse query
  const query = parseHistoryQuery(expression.args);
  if (!query) {
    return {
      success: false,
      error: 'History macro requires at least a context ID: {{history:context_id}}',
      expression,
    };
  }

  // Resolve "current" to actual context ID
  if (query.contextId === 'current') {
    if (!context.currentContextId) {
      return {
        success: false,
        error: 'Cannot resolve "current" context: no active context available',
        expression,
      };
    }
    query.contextId = context.currentContextId;
  }

  // Get messages
  if (!context.getMessages) {
    return {
      success: false,
      error: 'Cannot resolve history: no message retrieval function provided',
      expression,
    };
  }

  let messages: Message[];
  try {
    const result = context.getMessages(query.contextId);
    messages = Array.isArray(result) ? result : await result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to retrieve messages for context "${query.contextId}": ${message}`,
      expression,
    };
  }

  if (!messages || messages.length === 0) {
    return {
      success: true,
      content: '(no messages in history)',
      expression,
    };
  }

  // Apply filter
  if (query.filter) {
    messages = applyFilter(messages, query.filter);
  }

  // Apply range
  messages = applyRange(messages, query);

  // Format
  const content = formatMessages(messages);

  return {
    success: true,
    content,
    expression,
  };
}
