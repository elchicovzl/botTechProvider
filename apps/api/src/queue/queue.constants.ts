export const QUEUES = {
  DOCUMENT_INGEST: 'document-ingest',
  MESSAGE_SEND: 'message-send',
  WEBHOOK_PROCESS: 'webhook-process',
} as const;

export const QUEUE_NAMES = Object.values(QUEUES);

/**
 * Default job options per queue
 */
export const JOB_OPTIONS = {
  [QUEUES.DOCUMENT_INGEST]: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: false, // Keep in DLQ
  },
  [QUEUES.MESSAGE_SEND]: {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: false,
  },
  [QUEUES.WEBHOOK_PROCESS]: {
    attempts: 3,
    backoff: { type: 'fixed' as const, delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: false,
  },
} as const;
