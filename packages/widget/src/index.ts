import { Widget } from './widget';
import { WidgetConfig } from './types';

function init(): void {
  // Prevent double initialization
  if (document.getElementById('arc-webchat-root')) {
    console.warn('[ArcWebChat] Already initialized');
    return;
  }

  // Read config from script tag data attributes
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) {
    console.error('[ArcWebChat] Cannot find script element');
    return;
  }

  const tenant = script.dataset.tenant;
  const api = script.dataset.api;

  if (!tenant || !api) {
    console.error('[ArcWebChat] Missing required data-tenant or data-api attributes');
    return;
  }

  const config: WidgetConfig = {
    tenant,
    api,
    theme: script.dataset.theme,
    position: (script.dataset.position as 'left' | 'right') || 'right',
    greeting: script.dataset.greeting,
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
