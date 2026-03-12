/**
 * Redis-backed Task Queue with Priority Support
 * 
 * Features:
 * - Priority queues (0 = highest)
 * - Delayed task scheduling
 * - Recurring tasks via cron
 * - Dead letter queue for failed tasks
 * - Visibility timeout for in-flight tasks
 */

import { createClient, RedisClientType } from 'redis';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Task,
  TaskId,
  TaskPriority,
  QueueMessage,
  WorkflowId,
  SchedulerConfig,
} from './types.ts';

/** Redis queue implementation */
export class TaskQueue extends EventEmitter {
  private redis: RedisClientType;
  private config: SchedulerConfig;
  private isRunning = false;
  private pollInterval?: number;
  private cronInterval?: number;
  private delayedInterval?: number;
  
  // Queue names (with prefix)
  private readonly PRIORITY_QUEUE = 'queue:priority';
  private readonly DELAYED_QUEUE = 'queue:delayed';
  private readonly IN_FLIGHT_SET = 'queue:inflight';
  private readonly DEAD_LETTER_QUEUE = 'queue:deadletter';
  private readonly CRON_HASH = 'queue:cron';
  
  constructor(redis: RedisClientType, config: SchedulerConfig) {
    super();
    this.redis = redis;
    this.config = config;
  }
  
  /** Initialize queue system */
  async initialize(): Promise<void> {
    // Start background processors
    this.isRunning = true;
    this.startDelayedProcessor();
    this.startCronProcessor();
    this.emit('initialized');
  }
  
  /** Shutdown queue system */
  async shutdown(): Promise<void> {
    this.isRunning = false;
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.cronInterval) clearInterval(this.cronInterval);
    if (this.delayedInterval) clearInterval(this.delayedInterval);
    this.emit('shutdown');
  }
  
  // ============================================================================
  // ENQUEUE OPERATIONS
  // ============================================================================
  
  /** Add task to queue */
  async enqueue(
    task: Task,
    workflowId: WorkflowId,
    options?: {
      priority?: TaskPriority;
      delay?: number; // Delay in milliseconds
    }
  ): Promise<string> {
    const messageId = uuidv4();
    const now = Date.now();
    
    const message: QueueMessage = {
      id: messageId,
      task,
      workflowId,
      priority: options?.priority ?? task.priority ?? TaskPriority.NORMAL,
      enqueuedAt: new Date(),
      attempts: 0,
      visibleAt: options?.delay ? now + options.delay : now,
    };
    
    const serialized = JSON.stringify(message);
    
    if (options?.delay && options.delay > 0) {
      // Add to delayed queue
      await this.redis.zAdd(this.getKey(this.DELAYED_QUEUE), [{
        score: message.visibleAt,
        value: serialized,
      }]);
      this.emit('task:delayed', { taskId: task.id, visibleAt: message.visibleAt });
    } else {
      // Add to priority queue
      const priorityScore = message.priority;
      await this.redis.zAdd(this.getKey(this.PRIORITY_QUEUE), [{
        score: priorityScore,
        value: serialized,
      }]);
      this.emit('task:enqueued', { taskId: task.id, priority: message.priority });
    }
    
    return messageId;
  }
  
  /** Schedule recurring task with cron expression */
  async scheduleCron(
    task: Task,
    workflowId: WorkflowId,
    cronExpression: string,
    options?: { priority?: TaskPriority }
  ): Promise<string> {
    const scheduleId = uuidv4();
    const cronJob = {
      id: scheduleId,
      task,
      workflowId,
      cron: cronExpression,
      priority: options?.priority ?? task.priority,
      nextRun: this.calculateNextRun(cronExpression),
      createdAt: new Date(),
    };
    
    await this.redis.hSet(
      this.getKey(this.CRON_HASH),
      scheduleId,
      JSON.stringify(cronJob)
    );
    
    this.emit('cron:scheduled', { scheduleId, taskId: task.id, cron: cronExpression });
    return scheduleId;
  }
  
  /** Cancel scheduled cron job */
  async cancelCron(scheduleId: string): Promise<boolean> {
    const result = await this.redis.hDel(this.getKey(this.CRON_HASH), scheduleId);
    if (result > 0) {
      this.emit('cron:cancelled', { scheduleId });
      return true;
    }
    return false;
  }
  
  // ============================================================================
  // DEQUEUE OPERATIONS
  // ============================================================================
  
  /** Get next available task from queue */
  async dequeue(
    visibilityTimeout?: number
  ): Promise<QueueMessage | null> {
    const now = Date.now();
    const timeout = visibilityTimeout ?? this.config.defaultTimeout;
    
    // Lua script for atomic pop operation
    const luaScript = `
      local messages = redis.call('zrange', KEYS[1], 0, 0)
      if #messages == 0 then
        return nil
      end
      
      local message = messages[1]
      local parsed = cjson.decode(message)
      
      if parsed.visibleAt > ${now} then
        return nil
      end
      
      redis.call('zrem', KEYS[1], message)
      
      parsed.attempts = parsed.attempts + 1
      parsed.visibleAt = ${now + timeout}
      
      local updated = cjson.encode(parsed)
      redis.call('zadd', KEYS[2], parsed.visibleAt, updated)
      
      return updated
    `;
    
    const result = await this.redis.eval(luaScript, {
      keys: [
        this.getKey(this.PRIORITY_QUEUE),
        this.getKey(this.IN_FLIGHT_SET),
      ],
    });
    
    if (result) {
      const message: QueueMessage = JSON.parse(result as string);
      this.emit('task:dequeued', { taskId: message.task.id, messageId: message.id });
      return message;
    }
    
    return null;
  }
  
  /** Dequeue multiple tasks at once (batch processing) */
  async dequeueBatch(
    count: number,
    visibilityTimeout?: number
  ): Promise<QueueMessage[]> {
    const messages: QueueMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      const message = await this.dequeue(visibilityTimeout);
      if (!message) break;
      messages.push(message);
    }
    
    return messages;
  }
  
  // ============================================================================
  // TASK LIFECYCLE
  // ============================================================================
  
  /** Mark task as completed */
  async complete(messageId: string): Promise<void> {
    await this.redis.zRem(this.getKey(this.IN_FLIGHT_SET), messageId);
    this.emit('task:completed', { messageId });
  }
  
  /** Mark task as failed - move to DLQ if max retries exceeded */
  async fail(
    message: QueueMessage,
    error: string,
    maxRetries: number
  ): Promise<'retry' | 'deadletter'> {
    await this.redis.zRem(this.getKey(this.IN_FLIGHT_SET), message.id);
    
    if (message.attempts < maxRetries) {
      // Retry with exponential backoff
      const delay = this.calculateRetryDelay(message.attempts);
      message.visibleAt = Date.now() + delay;
      
      await this.redis.zAdd(this.getKey(this.DELAYED_QUEUE), [{
        score: message.visibleAt,
        value: JSON.stringify(message),
      }]);
      
      this.emit('task:retry', {
        taskId: message.task.id,
        attempt: message.attempts,
        nextAttempt: message.visibleAt,
      });
      
      return 'retry';
    } else {
      // Move to dead letter queue
      const deadMessage = {
        ...message,
        failedAt: new Date(),
        finalError: error,
      };
      
      await this.redis.lPush(
        this.getKey(this.DEAD_LETTER_QUEUE),
        JSON.stringify(deadMessage)
      );
      
      this.emit('task:deadletter', {
        taskId: message.task.id,
        messageId: message.id,
        error,
      });
      
      return 'deadletter';
    }
  }
  
  /** Requeue a message (for retry or reprocessing) */
  async requeue(
    message: QueueMessage,
    options?: { delay?: number; priority?: TaskPriority }
  ): Promise<void> {
    await this.redis.zRem(this.getKey(this.IN_FLIGHT_SET), message.id);
    
    message.visibleAt = Date.now() + (options?.delay ?? 0);
    message.priority = options?.priority ?? message.priority;
    
    await this.redis.zAdd(this.getKey(this.PRIORITY_QUEUE), [{
      score: message.priority,
      value: JSON.stringify(message),
    }]);
    
    this.emit('task:requeued', { taskId: message.task.id, messageId: message.id });
  }
  
  /** Extend visibility timeout for in-flight task */
  async extendVisibility(
    messageId: string,
    extensionMs: number
  ): Promise<boolean> {
    const entries = await this.redis.zRangeWithScores(
      this.getKey(this.IN_FLIGHT_SET),
      0,
      -1
    );
    
    for (const entry of entries) {
      const message: QueueMessage = JSON.parse(entry.value);
      if (message.id === messageId) {
        message.visibleAt = Date.now() + extensionMs;
        await this.redis.zRem(this.getKey(this.IN_FLIGHT_SET), entry.value);
        await this.redis.zAdd(this.getKey(this.IN_FLIGHT_SET), [{
          score: message.visibleAt,
          value: JSON.stringify(message),
        }]);
        return true;
      }
    }
    
    return false;
  }
  
  // ============================================================================
  // QUEUE MANAGEMENT
  // ============================================================================
  
  /** Get queue depth by priority */
  async getQueueDepth(): Promise<Record<TaskPriority, number>> {
    const depths: Record<number, number> = {};
    
    for (const priority of Object.values(TaskPriority).filter(v => typeof v === 'number')) {
      const count = await this.redis.zCount(
        this.getKey(this.PRIORITY_QUEUE),
        priority as number,
        priority as number
      );
      depths[priority as number] = count;
    }
    
    return depths;
  }
  
  /** Get total queue depth */
  async getTotalDepth(): Promise<number> {
    const [priorityCount, delayedCount] = await Promise.all([
      this.redis.zCard(this.getKey(this.PRIORITY_QUEUE)),
      this.redis.zCard(this.getKey(this.DELAYED_QUEUE)),
    ]);
    
    return priorityCount + delayedCount;
  }
  
  /** Get in-flight task count */
  async getInFlightCount(): Promise<number> {
    return await this.redis.zCard(this.getKey(this.IN_FLIGHT_SET));
  }
  
  /** Get dead letter queue size */
  async getDeadLetterCount(): Promise<number> {
    return await this.redis.lLen(this.getKey(this.DEAD_LETTER_QUEUE));
  }
  
  /** Peek at next task without dequeuing */
  async peek(): Promise<QueueMessage | null> {
    const results = await this.redis.zRange(this.getKey(this.PRIORITY_QUEUE), 0, 0);
    if (results.length > 0) {
      return JSON.parse(results[0]);
    }
    return null;
  }
  
  /** Purge all queues (dangerous!) */
  async purge(): Promise<void> {
    await Promise.all([
      this.redis.del(this.getKey(this.PRIORITY_QUEUE)),
      this.redis.del(this.getKey(this.DELAYED_QUEUE)),
      this.redis.del(this.getKey(this.IN_FLIGHT_SET)),
      this.redis.del(this.getKey(this.DEAD_LETTER_QUEUE)),
      this.redis.del(this.getKey(this.CRON_HASH)),
    ]);
    
    this.emit('queue:purged');
  }
  
  /** Republish expired in-flight tasks */
  async republishExpired(): Promise<number> {
    const now = Date.now();
    const expired = await this.redis.zRangeByScore(
      this.getKey(this.IN_FLIGHT_SET),
      0,
      now
    );
    
    let republished = 0;
    for (const entry of expired) {
      const message: QueueMessage = JSON.parse(entry);
      await this.redis.zRem(this.getKey(this.IN_FLIGHT_SET), entry);
      
      // Requeue with same priority
      await this.redis.zAdd(this.getKey(this.PRIORITY_QUEUE), [{
        score: message.priority,
        value: JSON.stringify({ ...message, visibleAt: now }),
      }]);
      
      republished++;
      this.emit('task:republished', { taskId: message.task.id, messageId: message.id });
    }
    
    return republished;
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  /** Start background processor for delayed tasks */
  private startDelayedProcessor(): void {
    this.delayedInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const now = Date.now();
        const ready = await this.redis.zRangeByScore(
          this.getKey(this.DELAYED_QUEUE),
          0,
          now
        );
        
        for (const entry of ready) {
          const message: QueueMessage = JSON.parse(entry);
          await this.redis.zRem(this.getKey(this.DELAYED_QUEUE), entry);
          
          await this.redis.zAdd(this.getKey(this.PRIORITY_QUEUE), [{
            score: message.priority,
            value: JSON.stringify({ ...message, visibleAt: now }),
          }]);
          
          this.emit('task:ready', { taskId: message.task.id, messageId: message.id });
        }
      } catch (err) {
        this.emit('error', err);
      }
    }, 1000) as unknown as number;
  }
  
  /** Start background processor for cron jobs */
  private startCronProcessor(): void {
    this.cronInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const cronJobs = await this.redis.hGetAll(this.getKey(this.CRON_HASH));
        const now = Date.now();
        
        for (const [scheduleId, jobJson] of Object.entries(cronJobs)) {
          const job = JSON.parse(jobJson);
          
          if (job.nextRun <= now) {
            // Enqueue the cron task
            await this.enqueue(job.task, job.workflowId, {
              priority: job.priority,
            });
            
            // Update next run time
            job.nextRun = this.calculateNextRun(job.cron);
            await this.redis.hSet(
              this.getKey(this.CRON_HASH),
              scheduleId,
              JSON.stringify(job)
            );
            
            this.emit('cron:triggered', { scheduleId, taskId: job.task.id });
          }
        }
      } catch (err) {
        this.emit('error', err);
      }
    }, 60000) as unknown as number; // Check every minute
  }
  
  /** Calculate retry delay with exponential backoff */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = this.config.maxRetryDelay || 60000;
    
    switch (this.config.retryBackoff) {
      case 'fixed':
        return baseDelay;
      case 'linear':
        return Math.min(baseDelay * attempt, maxDelay);
      case 'exponential':
      default:
        return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    }
  }
  
  /** Calculate next run time from cron expression */
  private calculateNextRun(cronExpression: string): number {
    // Simple cron parser - in production use node-cron or similar
    // For now, assume every minute if "* * * * *"
    if (cronExpression === '* * * * *') {
      return Date.now() + 60000;
    }
    // Default to 1 hour
    return Date.now() + 3600000;
  }
  
  /** Get prefixed key name */
  private getKey(name: string): string {
    const prefix = this.config.redisPrefix ?? 'claw';
    return `${prefix}:${name}`;
  }
}

/** Factory function to create queue */
export async function createTaskQueue(
  redis: RedisClientType,
  config: SchedulerConfig
): Promise<TaskQueue> {
  const queue = new TaskQueue(redis, config);
  await queue.initialize();
  return queue;
}
