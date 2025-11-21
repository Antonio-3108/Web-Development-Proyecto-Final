import { Injectable, signal } from '@angular/core';
import Peer from 'peerjs';
export interface PlayerState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  flipX: boolean;
  isDashing?: boolean;
  isAttacking?: boolean;
  attackType?: 'normal' | 'dash' | 'up' | 'down';
  percent?: number;
  stocks?: number;
  timestamp?: number;
}
type EventHandler = (data?: any) => void;
@Injectable({
  providedIn: 'root'
})
export class MultiplayerService {
  readonly peerId = signal<string | null>(null);
  readonly connected = signal(false);
  readonly role = signal<'host' | 'client' | null>(null);
  readonly error = signal<string | null>(null);
  readonly latency = signal<number | null>(null);
  private peer: any = null; 
  private conn: any = null; 
  private connToClient: any = null; 
  private hostIdInternal: string | null = null;
  private remoteStateHandler?: (s: PlayerState) => void;
  private eventHandlers = new Map<string, EventHandler>();
  private lastPingTs = 0;
  private pingIntervalHandle: any = null;
  private heartbeatIntervalHandle: any = null;
  private lastHeartbeatReceived = 0;
  private connectionCheckIntervalHandle: any = null;
  constructor() {}
  private generateShortId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  async host(): Promise<string> {
    this.disconnect(); 
    this.role.set('host');
    this.error.set(null);
    return new Promise<string>((resolve, reject) => {
      try {
        const shortId = this.generateShortId();
        this.peer = new Peer(shortId, {
          host: '0.peerjs.com',
          port: 443,
          path: '/',
          secure: true,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
              {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
              },
              {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
              }
            ]
          }
        });
        this.peer.on('open', (id: string) => {
          this.peerId.set(id);
          this.hostIdInternal = id;
          resolve(id);
        });
        this.peer.on('error', (err: any) => {
          if (err.type === 'network' || err.type === 'peer-unavailable') {
            this.error.set('Problema de conexión temporal');
          } else {
            this.error.set(String(err));
            reject(err);
          }
        });
        this.peer.on('disconnected', () => {
          try {
            this.peer.reconnect();
          } catch (e) {
          }
        });
        this.peer.on('connection', (connection: any) => {
          if (this.connToClient) {
            try { this.connToClient.close(); } catch (e) {}
          }
          this.connToClient = connection;
          connection.on('open', () => {
            this.setupConnectionHandlers(connection, 'client');
          });
          connection.on('error', (err: any) => {
            this.error.set(String(err));
          });
        });
      } catch (err) {
        this.error.set(String(err));
        reject(err);
      }
    });
  }
  async connect(hostId: string): Promise<void> {
    this.disconnect();
    this.role.set('client');
    this.error.set(null);
    return new Promise<void>((resolve, reject) => {
      try {
        this.peer = new Peer({
          host: '0.peerjs.com',
          port: 443,
          path: '/',
          secure: true,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
              {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
              },
              {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
              }
            ]
          }
        });
        this.peer.on('open', (id: string) => {
          this.peerId.set(id);
          const connection = this.peer.connect(hostId, { reliable: true });
          this.conn = connection;
          connection.on('open', () => {
            this.setupConnectionHandlers(connection, 'host');
            resolve();
          });
          connection.on('error', (err: any) => {
            this.error.set(String(err));
            reject(err);
          });
        });
        this.peer.on('error', (err: any) => {
          if (err.type === 'network' || err.type === 'peer-unavailable') {
            this.error.set('Problema de conexión temporal');
          } else {
            this.error.set(String(err));
            reject(err);
          }
        });
        this.peer.on('disconnected', () => {
          try {
            this.peer.reconnect();
          } catch (e) {
          }
        });
      } catch (err) {
        this.error.set(String(err));
        reject(err);
      }
    });
  }
  private setupConnectionHandlers(connection: any, otherRole: 'host' | 'client') {
    this.connected.set(true);
    if (otherRole === 'host') {
      this.conn = connection;
    } else {
      this.connToClient = connection;
    }
    connection.on('data', (raw: any) => {
      let msg: any = raw;
      if (typeof raw === 'string') {
        try { msg = JSON.parse(raw); } catch { msg = raw; }
      }
      if (msg && typeof msg === 'object' && msg.type) {
        switch (msg.type) {
          case 'state':
            if (this.remoteStateHandler) {
              try { this.remoteStateHandler(msg.payload as PlayerState); } catch (e) { }
            }
            this.lastHeartbeatReceived = Date.now();
            break;
          case 'event':
            this.handleIncomingEvent(msg.event, msg.data);
            break;
          case 'ping':
            this.sendRaw({ type: 'pong', ts: msg.ts });
            break;
          case 'pong':
            if (msg.ts && this.lastPingTs) {
              const now = Date.now();
              const rtt = now - msg.ts;
              this.latency.set(Math.round(rtt / 2));
            }
            break;
          case 'heartbeat':
            this.lastHeartbeatReceived = Date.now();
            this.sendRaw({ type: 'heartbeat_ack' });
            break;
          case 'heartbeat_ack':
            this.lastHeartbeatReceived = Date.now();
            break;
          default:
        }
      } else {
        if (msg && typeof msg === 'object' && 'x' in msg && 'y' in msg) {
          if (this.remoteStateHandler) this.remoteStateHandler(msg as PlayerState);
        }
      }
    });
    connection.on('close', () => {
      this.connected.set(false);
      this.stopPing();
    });
    connection.on('error', (err: any) => {
      this.error.set(String(err));
      this.connected.set(false);
      this.stopPing();
    });
    this.startPing();
    this.startHeartbeat();
    this.startConnectionCheck();
  }
  private sendRaw(obj: any) {
    try {
      const dst = this.conn || this.connToClient;
      if (!dst) {
        return;
      }
      if (!dst.open) {
        return;
      }
      dst.send(JSON.stringify(obj));
    } catch (err) {
    }
  }
  sendPlayerState(state: PlayerState) {
    this.sendRaw({ type: 'state', payload: state });
  }
  onRemoteState(cb: (s: PlayerState) => void) {
    this.remoteStateHandler = cb;
  }
  sendEvent(event: string, data?: any) {
    this.sendRaw({ type: 'event', event, data });
  }
  onEvent(event: string, handler: EventHandler) {
    this.eventHandlers.set(event, handler);
  }
  private handleIncomingEvent(event: string, data: any) {
    const h = this.eventHandlers.get(event);
    if (h) {
      try { h(data); } catch (e) { }
    }
  }
  disconnect() {
    try {
      this.stopPing();
      this.stopHeartbeat();
      this.stopConnectionCheck();
      this.connected.set(false);
      this.role.set(null);
      if (this.conn) {
        try { this.conn.close(); } catch (e) {}
        this.conn = null;
      }
      if (this.connToClient) {
        try { this.connToClient.close(); } catch (e) {}
        this.connToClient = null;
      }
      if (this.peer) {
        try { this.peer.destroy(); } catch (e) {}
        this.peer = null;
      }
      this.peerId.set(null);
      this.latency.set(null);
      this.error.set(null);
      this.hostIdInternal = null;
    } catch (err) {
    }
  }
  private startPing() {
    this.stopPing();
    this.pingIntervalHandle = setInterval(() => {
      const dst = this.conn || this.connToClient;
      if (!dst || dst.open === false) return;
      const ts = Date.now();
      this.lastPingTs = ts;
      this.sendRaw({ type: 'ping', ts });
    }, 2000);
  }
  private stopPing() {
    if (this.pingIntervalHandle) {
      clearInterval(this.pingIntervalHandle);
      this.pingIntervalHandle = null;
    }
    this.lastPingTs = 0;
  }
  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastHeartbeatReceived = Date.now();
    this.heartbeatIntervalHandle = setInterval(() => {
      const dst = this.conn || this.connToClient;
      if (!dst || !dst.open) return;
      this.sendRaw({ type: 'heartbeat', ts: Date.now() });
    }, 5000); 
  }
  private stopHeartbeat() {
    if (this.heartbeatIntervalHandle) {
      clearInterval(this.heartbeatIntervalHandle);
      this.heartbeatIntervalHandle = null;
    }
    this.lastHeartbeatReceived = 0;
  }
  private startConnectionCheck() {
    this.stopConnectionCheck();
    this.connectionCheckIntervalHandle = setInterval(() => {
      const dst = this.conn || this.connToClient;
      if (!dst || !dst.open) {
        return;
      }
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatReceived;
      if (timeSinceLastHeartbeat > 15000 && this.lastHeartbeatReceived > 0) {
        this.error.set('Conexión inestable - sin respuesta del otro jugador');
      }
    }, 3000); 
  }
  private stopConnectionCheck() {
    if (this.connectionCheckIntervalHandle) {
      clearInterval(this.connectionCheckIntervalHandle);
      this.connectionCheckIntervalHandle = null;
    }
  }
}
