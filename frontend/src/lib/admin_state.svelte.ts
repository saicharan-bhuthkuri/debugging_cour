
let adminCount = $state(0);
let systems = $state<any[]>([]);

export function setAdminCount(n: number) {
	adminCount = n;
}

export function getAdminCount() {
	return adminCount;
}

export function setSystems(list: any[]) {
	systems = list;
}

export function getSystems() {
	return systems;
}

export function updateSystem(id: number, data: any) {
	const idx = systems.findIndex(s => s.id === id);
	if (idx !== -1) {
		// Create a new object to ensure reactivity triggers if deep proxy is tricky
		systems[idx] = { ...systems[idx], ...data };
	}
}

export function addSystem(sys: any) {
	systems = [...systems, sys];
}

export function upsertSystem(id: number, data: any) {
	const idx = systems.findIndex(s => s.id === id);
	if (idx !== -1) {
		systems[idx] = { ...systems[idx], ...data };
	} else if (data) {
		systems = [...systems, { id, ...data }];
	}
}

export function removeSystem(id: number) {
	systems = systems.filter(s => s.id !== id);
}
