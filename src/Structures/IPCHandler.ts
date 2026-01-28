import type { Cluster } from '../Core/Cluster.ts';
import type { ClusterClient } from '../Core/ClusterClient.ts';
import type { ClusterManager } from '../Core/ClusterManager.ts';
import { messageType } from '../types/shared.ts';
import { makePlainError } from '../Util/Util.ts';
import type { Child, ChildClient } from './Child.ts';
import type { RawMessage } from './IPCMessage.ts';
import type { ResolveMessage } from './PromiseHandler.ts';

export class ClusterHandler {
    manager: ClusterManager;
    cluster: Cluster;
    ipc: Child;
    constructor(manager: ClusterManager, cluster: Cluster, ipc: Child) {
        this.manager = manager;
        this.cluster = cluster;
        this.ipc = ipc;
    }

    handleMessage(message: RawMessage & { _eval?: string; options?: any; maintenance?: string }) {
        if (message._type === messageType.CLIENT_READY) {
            this.cluster.ready = true;
            this.cluster.emit('ready');
            this.cluster.manager._debug('Ready', this.cluster.id);
            return;
        }
        if (message._type === messageType.CLIENT_BROADCAST_REQUEST) {
            this.cluster.manager
                .broadcastEval(message._eval!, message.options)
                ?.then(results => {
                    return this.ipc.send({
                        nonce: message.nonce,
                        _type: messageType.CLIENT_BROADCAST_RESPONSE,
                        _result: results,
                    });
                })
                .catch(err => {
                    return this.ipc.send({
                        nonce: message.nonce,
                        _type: messageType.CLIENT_BROADCAST_RESPONSE,
                        _error: makePlainError(err as Error),
                    });
                });
            return;
        }
        if (message._type === messageType.CLIENT_MANAGER_EVAL_REQUEST) {
            this.cluster.manager.evalOnManager(message._eval!).then(result => {
                if (result._error) {
                    return this.ipc.send({
                        nonce: message.nonce,
                        _type: messageType.CLIENT_MANAGER_EVAL_RESPONSE,
                        _error: makePlainError(result._error as Error),
                    });
                }
                return this.ipc.send({
                    nonce: message.nonce,
                    _type: messageType.CLIENT_MANAGER_EVAL_RESPONSE,
                    _result: result._result,
                });
            });
            return;
        }
        if (message._type === messageType.CLIENT_EVAL_RESPONSE) {
            this.cluster.manager.promise.resolve(message as ResolveMessage);
            return;
        }
        if (message._type === messageType.CLIENT_RESPAWN_ALL) {
            this.cluster.manager.respawnAll(message.options);
            return;
        }
        if (message._type === messageType.CLIENT_RESPAWN) {
            this.cluster.respawn(message.options);
            return;
        }
        if (message._type === messageType.CLIENT_MAINTENANCE) {
            this.cluster.triggerMaintenance(message.maintenance);
            return;
        }
        if (message._type === messageType.CLIENT_MAINTENANCE_ALL) {
            this.cluster.manager.triggerMaintenance(message.maintenance ?? '');
            return;
        }
        if (message._type === messageType.CLIENT_SPAWN_NEXT_CLUSTER) {
            this.cluster.manager.queue.next();
            return;
        }
        if (message._type === messageType.HEARTBEAT_ACK) {
            // Heartbeat system now handles acks internally via Redis if needed, or we just ignore here
            return;
        }
        if (message._type === messageType.CUSTOM_REPLY) {
            this.cluster.manager.promise.resolve(message as ResolveMessage);
            return;
        }
        return true;
    }
}

export class ClusterClientHandler<DiscordClient> {
    client: ClusterClient<DiscordClient>;
    ipc: ChildClient | null;
    constructor(client: ClusterClient<DiscordClient>, ipc: ChildClient | null) {
        this.client = client;
        this.ipc = ipc;
    }

    public async handleMessage(message: ResolveMessage & { _eval?: string; options?: any; date?: number; maintenance?: string }) {
        if (message._type === messageType.CLIENT_EVAL_REQUEST) {
            try {
                if (!message._eval) throw new Error('Eval Script not provided');
                this.client._respond('eval', {
                    _eval: message._eval,
                    _result: await this.client._eval(message._eval),
                    _type: messageType.CLIENT_EVAL_RESPONSE,
                    nonce: message.nonce,
                });
            } catch (err) {
                this.client._respond('eval', {
                    _eval: message._eval,
                    _error: makePlainError(err as Error),
                    _type: messageType.CLIENT_EVAL_RESPONSE,
                    nonce: message.nonce,
                });
            }
            return null;
        }
        if (message._type === messageType.CLIENT_MANAGER_EVAL_RESPONSE) {
            this.client.promise.resolve({ _result: message._result, _error: message._error, nonce: message.nonce });
            return null;
        }
        if (message._type === messageType.CLIENT_BROADCAST_RESPONSE) {
            this.client.promise.resolve({ _result: message._result, _error: message._error, nonce: message.nonce });
            return null;
        }
        if (message._type === messageType.HEARTBEAT) {
            this.client.send({ _type: messageType.HEARTBEAT_ACK, date: message.date });
            return null;
        }
        if (message._type === messageType.CLIENT_MAINTENANCE_DISABLE) {
            this.client.maintenance = false;
            this.client.triggerClusterReady();
            return null;
        }
        if (message._type === messageType.CLIENT_MAINTENANCE_ENABLE) {
            this.client.maintenance = message.maintenance || true;
            return null;
        }
        if (message._type === messageType.CUSTOM_REPLY) {
            this.client.promise.resolve(message);
            return null;
        }
        return true;
    }
}
