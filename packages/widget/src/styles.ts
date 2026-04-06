export function getStyles(primaryColor: string, position: 'left' | 'right'): string {
  return `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a1a;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    .arc-fab {
      position: fixed;
      bottom: 20px;
      ${position}: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${primaryColor};
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .arc-fab:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
    .arc-fab svg { width: 24px; height: 24px; fill: currentColor; }

    .arc-panel {
      position: fixed;
      bottom: 88px;
      ${position}: 20px;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10000;
      animation: arc-slide-up 0.2s ease-out;
    }

    @keyframes arc-slide-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .arc-header {
      padding: 16px;
      background: ${primaryColor};
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .arc-header h3 { font-size: 15px; font-weight: 600; }
    .arc-close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      opacity: 0.8;
    }
    .arc-close:hover { opacity: 1; }

    .arc-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .arc-msg {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.4;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    /* INBOUND = visitor sent it → right-aligned */
    .arc-msg-visitor {
      align-self: flex-end;
      background: #f0f0f0;
      color: #1a1a1a;
      border-bottom-right-radius: 4px;
    }
    /* OUTBOUND = bot/agent reply → left-aligned */
    .arc-msg-bot {
      align-self: flex-start;
      background: ${primaryColor};
      color: white;
      border-bottom-left-radius: 4px;
    }

    .arc-typing {
      align-self: flex-start;
      padding: 10px 14px;
      background: #f0f0f0;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      display: flex;
      gap: 4px;
    }
    .arc-typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #999;
      animation: arc-bounce 1.4s ease-in-out infinite;
    }
    .arc-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .arc-typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes arc-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }

    .arc-input-area {
      padding: 12px 16px;
      border-top: 1px solid #e5e5e5;
      display: flex;
      gap: 8px;
    }
    .arc-input {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 14px;
      outline: none;
      font-family: inherit;
    }
    .arc-input:focus { border-color: ${primaryColor}; }
    .arc-send {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: ${primaryColor};
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .arc-send:disabled { opacity: 0.5; cursor: not-allowed; }
    .arc-send svg { width: 16px; height: 16px; fill: currentColor; }

    .arc-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 13px;
      text-align: center;
      padding: 20px;
    }

    .arc-connecting {
      padding: 8px 16px;
      text-align: center;
      font-size: 12px;
      color: #999;
      background: #fafafa;
    }

    .arc-error {
      padding: 8px 16px;
      text-align: center;
      font-size: 12px;
      color: #dc2626;
      background: #fef2f2;
    }
  `;
}
