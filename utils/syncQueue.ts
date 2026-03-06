/**
 * Offline Sync Queue — Wrap Supabase photo uploads in an offline queue using AsyncStorage.
 * When the Provider has no signal on site, Proof-of-Work photos are cached locally and
 * the upload mutation runs automatically when cellular/wifi is restored.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "@diaspora_bridge/upload_queue";
const MAX_RETRIES = 3;

export interface QueuedUpload {
  id: string;
  projectId: string;
  localUri: string;
  storagePath: string;
  metadata?: Record<string, unknown>;
  retries: number;
  createdAt: string;
}

export type UploadExecutor = (item: QueuedUpload) => Promise<void>;

let executor: UploadExecutor | null = null;
let isProcessing = false;

export function setSyncQueueExecutor(fn: UploadExecutor): void {
  executor = fn;
}

async function getQueue(): Promise<QueuedUpload[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function setQueue(queue: QueuedUpload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueUpload(
  projectId: string,
  localUri: string,
  storagePath: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const item: QueuedUpload = {
    id,
    projectId,
    localUri,
    storagePath,
    metadata,
    retries: 0,
    createdAt: new Date().toISOString(),
  };
  const queue = await getQueue();
  queue.push(item);
  await setQueue(queue);
  return id;
}

export async function processQueue(): Promise<{ processed: number; failed: number }> {
  if (!executor || isProcessing) return { processed: 0, failed: 0 };
  isProcessing = true;
  let processed = 0;
  let failed = 0;
  try {
    let queue = await getQueue();
    while (queue.length > 0) {
      const item = queue[0];
      try {
        await executor(item);
        queue.shift();
        await setQueue(queue);
        processed++;
      } catch (e) {
        item.retries += 1;
        if (item.retries >= MAX_RETRIES) {
          queue.shift();
          await setQueue(queue);
          failed++;
        } else {
          queue[0] = item;
          await setQueue(queue);
          failed++;
          break;
        }
      }
    }
  } finally {
    isProcessing = false;
  }
  return { processed, failed };
}

export async function getQueueLength(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
