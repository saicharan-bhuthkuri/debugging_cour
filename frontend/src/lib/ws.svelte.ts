
let socket: WebSocket | null = $state(null);
let connected = $state(false);

type Listener = (data: any) => void;
const listeners = new Set<Listener>();

// Export reactive state
export const state = {
	get connected() { return connected; }
};

export function isConnected() {
	return connected;
}

export function connect(token: string) {
	if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

	let host = 'localhost';
	if (typeof window !== 'undefined') {
		host = window.location.hostname;
	}

	const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';

	// Use dynamic host for LAN access
	socket = new WebSocket(`${protocol}//${host}:3000?token=${token}`);

	socket.onopen = () => {
		console.log("WS Connected");
		connected = true;
	};

	socket.onmessage = (event) => {
		try {
			const data = JSON.parse(event.data);
			listeners.forEach(l => l(data));
		} catch (e) {
			console.error("WS Parse Error", e);
		}
	};

	socket.onclose = () => {
		console.log("WS Disconnected");
		connected = false;
		socket = null;
		// Simple reconnect logic
		setTimeout(() => connect(token), 3000);
	};
}

export function subscribe(callback: Listener) {
	listeners.add(callback);
	return () => {
		listeners.delete(callback);
	};
}

export function send(data: any) {
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(data));
	}
}
