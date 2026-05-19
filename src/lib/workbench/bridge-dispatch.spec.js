import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';

const bridgeDispatchPath = '../../../sidecar/' + 'bridge-dispatch.mjs';

/**
 * @param {PassThrough} input
 * @param {string} id
 * @param {string} type
 */
function writeCommand(input, id, type) {
	input.write(`${JSON.stringify({ id, payload: {}, type })}\n`);
}

describe('bridge dispatch', () => {
	it('does not let a long diff analysis block later prompt commands', async () => {
		expect.assertions(2);

		const input = new PassThrough();
		/** @type {Array<{id: string, ok: boolean}>} */
		const responses = [];
		const originalWrite = process.stdout.write;
		process.stdout.write = function patchedWrite(chunk) {
			const text = String(chunk);
			if (text.trim()) {
				responses.push(JSON.parse(text));
			}
			return true;
		};

		const runtime = {
			analyzeDiff: () => new Promise((resolve) => setTimeout(() => resolve({ slow: true }), 50)),
			sendPrompt: () => ({ fast: true })
		};

		try {
			const { runBridge } = await import(bridgeDispatchPath);
			/** @type {(runtime: object, input: PassThrough) => Promise<void>} */
			const runBridgeWithInput = runBridge;
			const running = runBridgeWithInput(runtime, input);
			writeCommand(input, 'slow', 'analyze-diff');
			writeCommand(input, 'fast', 'send-prompt');

			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(responses.at(0)).toMatchObject({ id: 'fast', ok: true });

			input.end();
			await running;
			await new Promise((resolve) => setTimeout(resolve, 60));
			expect(responses.some((response) => response.id === 'slow' && response.ok)).toBe(true);
		} finally {
			process.stdout.write = originalWrite;
		}
	});
});
