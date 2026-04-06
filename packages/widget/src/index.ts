import { Widget } from './widget';
import { WidgetConfig } from './types';

// Capture script reference immediately — document.currentScript is only
// available during synchronous execution, NOT inside event listeners.
const _script = document.currentScript as HTMLScriptElement | null;

function init(): void {
  if (document.getElementById('arc-webchat-root')) {
    console.warn('[ArcWebChat] Already initialized');
    return;
  }

  if (!_script) {
    console.error('[ArcWebChat] Cannot find script element');
    return;
  }

  const apiKey = _script.dataset.key;
  if (!apiKey) {
    console.error('[ArcWebChat] Missing required data-key attribute');
    return;
  }

  // Infer API base URL from the script's own src
  const scriptUrl = new URL(_script.src);
  const api = scriptUrl.origin;

  const config: WidgetConfig = {
    apiKey,
    api,
    theme: _script.dataset.theme,
    position: (_script.dataset.position as 'left' | 'right') || 'right',
    greeting: _script.dataset.greeting,
  };

  (window as any).__arcWebChat = new Widget(config);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { Widget };
export type { WidgetConfig };
