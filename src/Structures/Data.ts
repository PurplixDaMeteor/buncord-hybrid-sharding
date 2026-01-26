export function getInfo() {
    const shardList: number[] = [];
    const parseShardList = process.env?.SHARD_LIST?.split(',') || [];
    parseShardList.forEach(c => shardList.push(Number(c)));
    
    const data: ClusterClientData = {
        SHARD_LIST: shardList,
        TOTAL_SHARDS: Number(process.env.TOTAL_SHARDS),
        CLUSTER_COUNT: Number(process.env.CLUSTER_COUNT),
        CLUSTER: Number(process.env.CLUSTER),
        CLUSTER_MANAGER_MODE: 'process',
        MAINTENANCE: process.env.MAINTENANCE,
        CLUSTER_QUEUE_MODE: process.env.CLUSTER_QUEUE_MODE,
        FIRST_SHARD_ID: shardList[0] as number,
        LAST_SHARD_ID: shardList[shardList.length - 1] as number,
        HEARTBEAT_INTERVAL: Number(process.env.HEARTBEAT_INTERVAL) || 10000,
    };
    
    return data;
}

export interface ClusterClientData {
    SHARD_LIST: number[];
    TOTAL_SHARDS: number;
    LAST_SHARD_ID: number;
    FIRST_SHARD_ID: number;
    CLUSTER_COUNT: number;
    MAINTENANCE?: string;
    CLUSTER_QUEUE_MODE?: 'auto' | string | undefined;
    CLUSTER: number;
    CLUSTER_MANAGER_MODE: 'process';
    HEARTBEAT_INTERVAL: number;
}
