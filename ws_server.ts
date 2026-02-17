import { type ServerWebSocket } from "bun";
import * as db from "./db";

export interface WSData {
	role: "admin" | "superadmin" | "system";
	id: number;
	name: string;
}

export class WebSocketManager {
	private connectedSystems = new Map<number, ServerWebSocket<WSData>>();
	private connectedAdmins = new Set<ServerWebSocket<WSData>>();
	public connectedClients = new Set<ServerWebSocket<WSData>>(); // Track all?

	constructor() {
		// Bind methods to ensure 'this' context works if passed as callbacks
		this.open = this.open.bind(this);
		this.message = this.message.bind(this);
		this.close = this.close.bind(this);
	}

	public getStatus() {
		return {
			admins: this.connectedAdmins.size,
			systems: this.connectedSystems.size
		};
	}

	public isSystemConnected(id: number) {
		return this.connectedSystems.has(id);
	}

	// Broadcast to strictly Admins
	public broadcastAdmins(msg: any) {
		const data = JSON.stringify(msg);
		for (const ws of this.connectedAdmins) {
			if (ws.readyState === 1) ws.send(data);
		}
	}

	// Broadcast to specific System
	public sendToSystem(systemId: number, msg: any) {
		const ws = this.connectedSystems.get(systemId);
		if (ws && ws.readyState === 1) {
			ws.send(JSON.stringify(msg));
			return true;
		}
		return false;
	}

	// Broadcast to everyone (Admins + Systems)
	public broadcastAll(msg: any) {
		const data = JSON.stringify(msg);
		for (const ws of this.connectedAdmins) {
			if (ws.readyState === 1) ws.send(data);
		}
		for (const ws of this.connectedSystems.values()) {
			if (ws.readyState === 1) ws.send(data);
		}
	}

	public disconnectSystem(id: number) {
		const ws = this.connectedSystems.get(id);
		if (ws) {
			// Send close message first?
			ws.close();
			this.connectedSystems.delete(id);
			// Don't need to manually update DB/broadcast here as close() handler will likely be called?
			// Wait, close() handler is async.
			// If we close manually, the close handler will trigger.
			// But we might want to send a reason before closing.
		}
	}

	// WS Handler: Open
	public async open(ws: ServerWebSocket<WSData>) {
		console.log(`Client connected: ${ws.data.role} (${ws.data.name})`);

		if (ws.data.role === "system") {
			const existing = this.connectedSystems.get(ws.data.id);
			this.connectedSystems.set(ws.data.id, ws);
			if (existing) existing.close();

			const { system } = await db.getSystemById(ws.data.id);

			if (system) {
				// Only set to online if not in a persistent state
				if (system.status !== 'exam' && system.status !== 'booked' && system.status !== 'completed') {
					await db.updateSystem(ws.data.id, { status: "online" });
				}

				// Re-fetch to get freshest data (including assigned_to_name) for broadcast
				const { system: freshSystem } = await db.getSystemById(ws.data.id);

				// Broadcast to ALL
				this.broadcastAll({
					type: "system_online",
					id: ws.data.id,
					data: freshSystem || system
				});
			}

		} else if (ws.data.role === "admin" || ws.data.role === "superadmin") {
			this.connectedAdmins.add(ws);

			// Send initial state to this admin
			ws.send(JSON.stringify({ type: "admin_count", count: this.connectedAdmins.size }));

			// Notify other admins (and potentially systems if needed?)
			this.broadcastAdmins({ type: "admin_count", count: this.connectedAdmins.size });
		}
	}

	// WS Handler: Message
	public message(ws: ServerWebSocket<WSData>, message: string | Buffer) {
		// Handle incoming messages if needed (e.g. heartbeat)
	}

	// WS Handler: Close
	public async close(ws: ServerWebSocket<WSData>) {
		console.log(`Client disconnected: ${ws.data.role} (${ws.data.name})`);

		if (ws.data.role === "system") {
			const current = this.connectedSystems.get(ws.data.id);
			if (current && current !== ws) return;

			this.connectedSystems.delete(ws.data.id);

			// Check if we should mark as offline
			const { system } = await db.getSystemById(ws.data.id);
			if (system && system.status !== 'exam' && system.status !== 'booked' && system.status !== 'completed') {
				// Update DB to offline
				await db.updateSystem(ws.data.id, { status: "offline" });

				// Re-fetch for broadcast
				const { system: updated } = await db.getSystemById(ws.data.id);
				this.broadcastAdmins({
					type: "system_offline",
					id: ws.data.id,
					data: updated || { ...system, status: "offline" }
				});
			}
			// For exam/booked/completed — status stays, no broadcast needed

		} else if (ws.data.role === "admin" || ws.data.role === "superadmin") {
			this.connectedAdmins.delete(ws);
			this.broadcastAdmins({ type: "admin_count", count: this.connectedAdmins.size });
		}
	}
}

export const wsManager = new WebSocketManager();
