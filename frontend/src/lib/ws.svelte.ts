let socket: WebSocket | null = $state(null);
let connected = $state(false);
let reconnectTimer: any = null;
let shouldReconnect = true;

type Listener = (data: any) => void;
const listeners = new Set<Listener>();

// Export reactive state
export const state = {
	get connected() { return connected; }
};

export function isConnected() {
	return connected;
}

export function disconnect() {
	shouldReconnect = false;
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (socket) {
		socket.onclose = null;
		socket.onerror = null;
		socket.close();
		socket = null;
	}
	connected = false;
}

export function connect(token: string) {
	if (!token) return;
	shouldReconnect = true;

	if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

	let host = 'localhost';
	if (typeof window !== 'undefined') {
		host = window.location.hostname;
	}

	const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const isDev = import.meta.env.DEV;
	const port = isDev ? "3000" : window.location.port;

	try {
		socket = new WebSocket(`${protocol}//${host}${port ? `:${port}` : ""}?token=${token}`);

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

		socket.onerror = (err) => {
			console.warn("WS Error:", err);
		};

		socket.onclose = () => {
			console.log("WS Disconnected");
			connected = false;
			socket = null;
			if (shouldReconnect) {
				if (reconnectTimer) clearTimeout(reconnectTimer);
				reconnectTimer = setTimeout(() => connect(token), 3000);
			}
		};
	} catch (e) {
		console.error("WS connection setup failed", e);
	}
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
