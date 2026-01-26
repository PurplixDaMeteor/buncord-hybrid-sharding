import { ClusterManager } from "../Core/ClusterManager.js";
import { Plugin } from "../types/shared.js";

export interface QueueManagerOptions {
    maxParallelSpawns?: number;
    spawnDelay?: number;
}

export class QueueManager implements Plugin {
    public manager?: ClusterManager;
    public options: QueueManagerOptions;
    private queue: any[] = [];
    private processing = false;

    constructor(options: QueueManagerOptions = {}) {
        this.options = options;
    }

    public build(manager: ClusterManager) {
        this.manager = manager;
        // @ts-ignore
        this.manager.queueManager = this;
        this.manager._debug("[QueueManager] Plugin initialized");
    }

    public add(task: () => Promise<any>) {
        this.queue.push(task);
        this.process();
    }

    private async process() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const task = this.queue.shift();
            try {
                await task();
            } catch (err) {
                this.manager?._debug(`[QueueManager] Task failed: ${err}`);
            }
            if (this.options.spawnDelay) {
                await new Promise(resolve => setTimeout(resolve, this.options.spawnDelay));
            }
        }

        this.processing = false;
    }
}
