import { ClusterManager } from '../Core/ClusterManager.js';
import { RedisClient } from '../Util/RedisClient.js';

export interface HeartbeatOptions {
    interval?: number;
    timeout?: number;
}

export class HeartbeatManager {
    public manager?: ClusterManager;
    public redis: RedisClient;
    public options: Required<HeartbeatOptions>;
    private checkInterval?: any;

    constructor(options: HeartbeatOptions = {}) {
        this.options = {
            interval: options.interval || 10000,
            timeout: options.timeout || 30000
        };
        this.redis = new RedisClient();
    }

    public build(manager: ClusterManager) {
        this.manager = manager;
        // @ts-ignore
        this.manager.heartbeat = this;
        this.start();
    }

    public start() {
        this.checkInterval = setInterval(() => this.checkClusters(), this.options.interval);
        this.manager?._debug("[Heartbeat] Redis-backed monitoring started");
    }

    private async checkClusters() {
        if (!this.manager) return;
        for (const [id, cluster] of this.manager.clusters) {
            if (!cluster.thread) continue;
            
            const lastHeartbeat = await this.redis.get(`hb:cluster:${id}`);
            if (!lastHeartbeat && cluster.ready) {
                this.manager._debug(`[Heartbeat] Cluster ${id} missed heartbeat, respawning...`);
                cluster.respawn();
            }
        }
    }

    public stop() {
        if (this.checkInterval) clearInterval(this.checkInterval);
    }
}
