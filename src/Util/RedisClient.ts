import { createClient, type RedisClientType } from 'redis';

export class RedisClient {
    public client: RedisClientType;
    private isConnected = false;

    constructor(url: string = process.env.REDIS_URL || 'redis://localhost:6379') {
        this.client = createClient({
            url,
            socket: {
                reconnectStrategy: (retries) => {
                    return Math.min(retries * 100, 3000);
                },
            },
        });

        this.setupEvents();
    }

    private setupEvents() {
        this.client.on('connect', () => {
            this.isConnected = true;
        });

        this.client.on('error', (err) => {
            this.isConnected = false;
        });

        this.client.on('reconnecting', () => {
        });
    }

    async connect(): Promise<void> {
        if (!this.isConnected) {
            await this.client.connect();
        }
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
        const serialized = JSON.stringify(value);

        if (ttl) {
            await this.client.setEx(key, ttl, serialized);
        } else {
            await this.client.set(key, serialized);
        }
    }

    async get<T>(key: string): Promise<T | null> {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async publish(channel: string, message: any): Promise<void> {
        await this.client.publish(channel, JSON.stringify(message));
    }

    async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
        const subscriber = this.client.duplicate();
        await subscriber.connect();

        await subscriber.subscribe(channel, (message) => {
            callback(JSON.parse(message));
        });
    }

    async disconnect(): Promise<void> {
        if (this.isConnected) {
            await this.client.disconnect();
            this.isConnected = false;
        }
    }
}
