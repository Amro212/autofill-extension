import { injectScript } from "wxt/utils/inject-script";

import {
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
  parseSerializedResponse,
  type BridgeAction,
  type BridgeResponse,
} from "./protocol.js";

export interface MainWorldBridge {
  execute(action: BridgeAction): Promise<BridgeResponse>;
  dispose(): void;
}

function randomId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function createBridgeClient(
  script: HTMLScriptElement,
  channelId: string,
): MainWorldBridge {
  let disposed = false;
  const pending = new Map<
    string,
    { resolve: (response: BridgeResponse) => void; timer: ReturnType<typeof setTimeout> }
  >();
  const onResponse = (event: Event) => {
    try {
      const response = parseSerializedResponse((event as CustomEvent).detail);
      if (response.channelId !== channelId) return;
      const request = pending.get(response.requestId);
      if (request === undefined) return;
      clearTimeout(request.timer);
      pending.delete(response.requestId);
      request.resolve(response);
    } catch {
      // Host-page events that do not match the protocol are ignored.
    }
  };
  script.addEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
  return {
    execute(action) {
      if (disposed) return Promise.reject(new Error("bridge-disposed"));
      const requestId = randomId();
      return new Promise<BridgeResponse>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          resolve({ channelId, requestId, ok: false, error: "bridge-timeout" });
        }, 1_000);
        pending.set(requestId, { resolve, timer });
        script.dispatchEvent(
          new CustomEvent(BRIDGE_REQUEST_EVENT, {
            detail: JSON.stringify({ channelId, requestId, action }),
          }),
        );
      });
    },
    dispose() {
      disposed = true;
      script.removeEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
      for (const [requestId, request] of pending) {
        clearTimeout(request.timer);
        request.resolve({ channelId, requestId, ok: false, error: "bridge-disposed" });
      }
      pending.clear();
      script.remove();
    },
  };
}

export async function injectMainWorldBridge(): Promise<MainWorldBridge> {
  const channelId = randomId();
  const { script } = await injectScript("/job-copilot-main-world.js", {
    keepInDom: true,
    modifyScript(element) {
      element.dataset.jobCopilotChannel = channelId;
    },
  });
  return createBridgeClient(script, channelId);
}
