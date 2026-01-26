import { Cluster } from "../Core/Cluster.js";
import { ClusterManager } from "../Core/ClusterManager.js";
import { chunkArray, fetchRecommendedShards } from "../Util/Util.js";

export type ReClusterRestartMode = 'rolling';

export interface ReClusterOptions {
    delay?: number;
    timeout?: number;
    totalShards?: number | 'auto';
    totalClusters?: number;
    shardsPerClusters?: number;
    shardList?: number[];
    shardClusterList?: number[][];
}

export class ReClusterManager {
    options: ReClusterOptions;
    onProgress: boolean = false;
    manager?: ClusterManager;

    constructor(options: ReClusterOptions = {}) {
        this.options = options;
    }

    build(manager: ClusterManager) {
        // @ts-ignore
        manager.recluster = this;
        this.manager = manager;
        return this;
    }

    public async start(options?: ReClusterOptions) {
        const {
            delay = 7000,
            timeout = 300000,
            totalClusters,
            shardsPerClusters,
            shardClusterList,
            shardList = this.manager?.shardList,
        } = options || {};
        let totalShards = options?.totalShards;

        if (this.onProgress) throw new Error('Zero Downtime Reclustering is already in progress');
        if (!this.manager) throw new Error('Manager is missing on ReClusterManager');

        if (totalShards) {
            if (totalShards === 'auto' || totalShards === -1) {
                if (!this.manager?.token) throw new Error('Token must be defined on manager for auto totalShards');
                totalShards = await fetchRecommendedShards(this.manager.token);
            }
            this.manager.totalShards = totalShards as number;
        }

        if (totalClusters) this.manager.totalClusters = totalClusters;
        if (shardsPerClusters) {
            this.manager.shardsPerClusters = shardsPerClusters;
            this.manager.totalClusters = Math.ceil(this.manager.totalShards / this.manager.shardsPerClusters);
        }

        if (shardList) this.manager.shardList = shardList;
        if (shardClusterList) this.manager.shardClusterList = shardClusterList;
        else {
            this.manager.shardClusterList = chunkArray(
                this.manager.shardList,
                Math.ceil(this.manager.shardList.length / this.manager.totalClusters),
            );
        }

        this.onProgress = true;
        this.manager._debug(`[ReCluster] Starting zero-downtime rolling restart...`);

        try {
            for (let i = 0; i < this.manager.totalClusters; i++) {
                const clusterId = this.manager.clusterList[i] || i;
                const newShards = this.manager.shardClusterList[i] as number[];
                
                this.manager._debug(`[ReCluster] Spawning replacement for cluster ${clusterId}...`);
                const newCluster = this.manager.createCluster(clusterId, newShards, this.manager.totalShards, true);
                
                await newCluster.spawn(timeout);
                
                const oldCluster = this.manager.clusters.get(clusterId);
                if (oldCluster) {
                    oldCluster.kill({ force: true, reason: 'rolling restart replacement' });
                }
                
                this.manager.clusters.set(clusterId, newCluster);
                this.manager._debug(`[ReCluster] Cluster ${clusterId} replaced successfully`);
                
                if (delay > 0 && i < this.manager.totalClusters - 1) {
                    await new Promise(r => globalThis.setTimeout(r, delay));
                }
            }
        } finally {
            this.onProgress = false;
        }

        return { success: true };
    }
}
