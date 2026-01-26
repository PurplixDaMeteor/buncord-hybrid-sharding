export interface ChildProcessOptions {
    clusterData: Record<string, any> | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
    cwd?: string;
}

export class Child {
    file: string;
    process: import("bun").Subprocess | null;
    options: ChildProcessOptions;
    args: string[];

    constructor(file: string, options: ChildProcessOptions) {
        this.file = file;
        this.process = null;
        this.options = options;
        this.args = options.args || [];
    }

    public spawn() {
        const env = { 
            ...process.env, 
            ...this.options.env,
            ...(this.options.clusterData as any)
        };

        // Convert all env values to string for Bun.spawn
        const stringEnv: Record<string, string> = {};
        for (const [key, value] of Object.entries(env)) {
            stringEnv[key] = String(value);
        }

        this.process = Bun.spawn({
            cmd: ["bun", "run", this.file, ...this.args],
            env: stringEnv,
            cwd: this.options.cwd,
            stdout: "inherit",
            stderr: "inherit",
            ipc: (message) => {
                this._onMessage(message);
            },
            onExit: (proc, exitCode, signalCode) => {
                this._onExit(exitCode ?? 0);
            }
        });

        return this;
    }

    private _messageListeners: ((message: any) => void)[] = [];
    private _exitListeners: ((exitCode: number) => void)[] = [];
    private _errorListeners: ((error: Error) => void)[] = [];

    public on(event: 'message' | 'exit' | 'error', listener: (...args: any[]) => void) {
        if (event === 'message') this._messageListeners.push(listener);
        if (event === 'exit') this._exitListeners.push(listener);
        if (event === 'error') this._errorListeners.push(listener);
        return this;
    }

    private _onMessage(message: any) {
        for (const listener of this._messageListeners) listener(message);
    }

    private _onExit(exitCode: number) {
        for (const listener of this._exitListeners) listener(exitCode);
    }

    public kill() {
        this.process?.kill();
        this.process = null;
        this._messageListeners = [];
        this._exitListeners = [];
        this._errorListeners = [];
    }

    public send(message: any) {
        return new Promise<void>((resolve, reject) => {
            try {
                this.process?.send(message);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    public get killed() {
        return !this.process || this.process.killed;
    }
}

export class ChildClient {
    public send(message: any) {
        return new Promise<void>((resolve, reject) => {
            try {
                process.send?.(message);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    public getData() {
        return process.env;
    }
}
