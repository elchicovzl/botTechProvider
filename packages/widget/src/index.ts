import { Widget } from './widget';
import { WidgetConfig } from './types';

// Capture script reference immediately — document.currentScript is only
// available during synchronous execution, NOT inside event listeners.
const _script = document.currentScript as HTMLScriptElement | null;

function init(): void {
  // Prevent double initialization
  if (document.getElementById('arc-webchat-root')) {
    console.warn('[ArcWebChat] Already initialized');
    return;
  }

  if (!_script) {
    console.error('[ArcWebChat] Cannot find script element');
    return;
  }

  const tenant = _script.dataset.tenant;
  const api = _script.dataset.api;

  if (!tenant || !api) {
    console.error('[ArcWebChat] Missing required data-tenant or data-api attributes');
    return;
  }

  const config: WidgetConfig = {
    tenant,
    api,
    theme: _script.dataset.theme,
    position: (_script.dataset.position as 'left' | 'right') || 'right',
    greeting: _script.dataset.greeting,
  };

  // Expose instance globally for programmatic control
  (window as any).__arcWebChat = new Widget(config);
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { Widget };
export type { WidgetConfig };
