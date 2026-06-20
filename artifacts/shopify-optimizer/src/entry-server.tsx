import { renderToString } from 'react-dom/server';
import React from 'react';

interface RenderResult {
  html: string;
}

/**
 * SSR entry point for Replit's prerender pipeline.
 *
 * Renders a minimal shell so the prerender captures body content
 * (not metadata-only), which ensures the deployed HTML includes
 * the React <script> tags needed for client-side hydration.
 *
 * The full app is rendered client-side via the JS bundle.
 * We keep this file free of browser-only imports (Three.js, Canvas, etc.)
 * to avoid crashes in the Node.js SSR environment.
 */
export function render(_url: string): RenderResult {
  try {
    const html = renderToString(
      React.createElement(
        'div',
        {
          id: 'sc-ssr-shell',
          style: {
            background: '#080810',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        React.createElement(
          'div',
          {
            style: {
              color: '#c8a84b',
              fontFamily: 'Geist, "Helvetica Neue", Arial, sans-serif',
              fontSize: '14px',
              textAlign: 'center',
              letterSpacing: '0.05em',
            },
          },
          'Shopy Crafter'
        )
      )
    );
    return { html };
  } catch {
    return { html: '<div id="sc-ssr-shell"></div>' };
  }
}
