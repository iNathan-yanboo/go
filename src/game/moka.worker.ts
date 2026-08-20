import { GoModelRuntime } from './moka/runtime';

let runtime: GoModelRuntime | null = null;

self.onmessage = async (event: MessageEvent) => {
  const message = event.data;

  try {
    if (message.type === 'initialize') {
      runtime = GoModelRuntime.create(message.manifest, message.weightsBuffer);
      self.postMessage({
        requestId: message.requestId,
        type: 'ready',
      });
      return;
    }

    if (!runtime) {
      throw new Error('Go model worker is not initialized.');
    }

    const result = runtime.infer(message.features);
    self.postMessage(
      {
        ...result,
        requestId: message.requestId,
        type: 'result',
      },
      { transfer: [result.policyLogits.buffer] },
    );
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Go model inference failed.',
      requestId: message.requestId,
      type: 'error',
    });
  }
};
