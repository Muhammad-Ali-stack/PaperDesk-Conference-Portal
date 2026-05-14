// Lightweight in-memory FIFO queue for non-priority (non-OTP) emails.
// Enforces a send delay to stay within Gmail's rate limits (~500/day, ~20/hour).
// On Vercel (serverless), delays are disabled because the process lifetime is per-request.

const IS_SERVERLESS = !!process.env.VERCEL;

const SEND_DELAY_MS  = IS_SERVERLESS ? 0    : 2500; // gap between consecutive sends
const MAX_RETRIES    = 2;                            // retry attempts after the first failure
const RETRY_DELAY_MS = IS_SERVERLESS ? 1000 : 5000; // wait before a retry

let _queue   = [];
let _running = false;

const _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Drains the queue one job at a time until empty, then stops.
// Re-entrant calls are ignored via the _running guard.
const _processQueue = async () => {
  if (_running) return;
  _running = true;

  while (_queue.length > 0) {
    const job = _queue.shift();

    try {
      await job.task();
      console.log(`[emailQueue] Sent: "${job.subject}"`);
    } catch (err) {
      if (job.retries < MAX_RETRIES) {
        job.retries += 1;
        console.warn(
          `[emailQueue] Attempt ${job.retries}/${MAX_RETRIES} failed for "${job.subject}": ${err.message}. ` +
          `Retrying in ${RETRY_DELAY_MS / 1000}s.`
        );
        await _sleep(RETRY_DELAY_MS);
        _queue.unshift(job); // put back at the front for immediate retry
      } else {
        console.error(`[emailQueue] Permanently failed after ${MAX_RETRIES} retries for "${job.subject}": ${err.message}`);
      }
    }

    if (_queue.length > 0 && SEND_DELAY_MS > 0) {
      await _sleep(SEND_DELAY_MS);
    }
  }

  _running = false;
};

// Adds a send task to the queue and starts the processor if idle.
// task: async function that performs the actual send (throws on failure)
// subject: used only for log messages
export const enqueue = (task, subject = "(no subject)") => {
  _queue.push({ task, subject, retries: 0 });
  _processQueue();
};

// Returns the number of jobs currently waiting in the queue.
export const queueSize = () => _queue.length;
