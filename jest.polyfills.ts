import { TextEncoder, TextDecoder } from 'util';
import { TransformStream, ReadableStream, WritableStream } from 'stream/web';
import { BroadcastChannel } from 'worker_threads';

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as unknown as typeof globalThis.TextEncoder;
}

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}

if (typeof globalThis.TransformStream === 'undefined') {
  globalThis.TransformStream = TransformStream as unknown as typeof globalThis.TransformStream;
}

if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream = ReadableStream as unknown as typeof globalThis.ReadableStream;
}

if (typeof globalThis.WritableStream === 'undefined') {
  globalThis.WritableStream = WritableStream as unknown as typeof globalThis.WritableStream;
}

if (typeof globalThis.BroadcastChannel === 'undefined') {
  globalThis.BroadcastChannel = BroadcastChannel as unknown as typeof globalThis.BroadcastChannel;
}

if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = ((value: unknown) => JSON.parse(JSON.stringify(value))) as typeof globalThis.structuredClone;
}
