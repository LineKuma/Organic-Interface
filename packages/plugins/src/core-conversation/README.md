# Core Conversation Plugin

## Overview

The Core Conversation Plugin (`core-conversation`) is the primary user interaction interface for Organic Interface. It provides text-based CLI interaction capabilities, following the Linux design philosophy where the plugin acts as a system program (like a shell) interacting with the kernel.

## Design Philosophy

Organic Interface adopts the Linux design philosophy:

- **Kernel (core)**: Provides base services, task scheduling, resource management, and runtime environment
- **Plugin (peripheral)**: Implements specific business logic and user interaction
- **core-conversation**: The primary user-facing plugin, equivalent to the shell in Linux

## Features

### Session Management
- Create new conversation sessions
- Resume existing sessions
- Close and archive sessions
- List active sessions with filtering
- Session timeout and TTL management

### Context Management
- Maintain conversation context windows
- Add, update, and delete messages
- Automatic context compression
- Token-based window limiting

### Input Processing
- CLI-level text input parsing
- Command recognition (`/command` syntax)
- Intent extraction from natural language
- Input validation

### Output Formatting
- Plain text, terminal, JSON, and markdown formats
- Color support for terminal output
- Streaming output support
- Error formatting

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Kernel (Core)                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │         PluginManager, EventBus, Lifecycle       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│          CoreConversationPlugin (Peripheral)            │
│  ┌───────────────┬────────────────┬────────────────┐   │
│  │ SessionManager│ ContextManager │ InputParser    │   │
│  └───────────────┴────────────────┴────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │              OutputFormatter                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Usage

### Initialize Plugin

```typescript
import { CoreConversationPlugin } from '@organic/plugins/core-conversation';
import { Kernel } from '@organic/kernel';

const kernel = new Kernel({ config: {...} });
const plugin = new CoreConversationPlugin();

await kernel.registerPlugin(plugin);
await kernel.start();
```

### Create Session

```typescript
const result = await plugin.execute({
  action: 'create_session',
  params: {
    userId: 'user-123',
    config: {
      title: 'My Session',
      ttl: 3600000, // 1 hour
    },
  },
});
```

### Send Message

```typescript
const result = await plugin.execute({
  action: 'send_message',
  params: {
    sessionId: 'sess_abc123',
    text: 'Hello, how are you?',
  },
});
```

### List Sessions

```typescript
const result = await plugin.execute({
  action: 'list_sessions',
  params: {
    filter: {
      status: 'active',
    },
  },
});
```

## API Reference

### Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `create_session` | Create a new conversation session | `userId?`, `config?` |
| `send_message` | Send a message to a session | `sessionId?`, `text` |
| `resume_session` | Resume an existing session | `sessionId` |
| `close_session` | Close a session | `sessionId?` |
| `list_sessions` | List all sessions | `filter?` |
| `get_session` | Get session details | `sessionId?` |
| `get_context` | Get context window | `sessionId?` |
| `clear_context` | Clear session context | `sessionId?` |
| `update_context` | Update context data | `sessionId?`, `updates` |

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSessionHistory` | number | 100 | Max messages per session |
| `defaultTimeout` | number | 30000 | Default timeout (ms) |
| `enableStreaming` | boolean | false | Enable streaming responses |
| `maxSessions` | number | 100 | Max concurrent sessions |
| `defaultContextWindowSize` | number | 50 | Default context window size |

## License

MIT