
const API_BASE = "http://localhost:3000";

export async function api(path: string, method: string = "GET", body: any = null, token: string = "") {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};

	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}

	const options: RequestInit = {
		method,
		headers,
	};

	if (body) {
		options.body = JSON.stringify(body);
	}

	try {
		const res = await fetch(`${API_BASE}${path}`, options);
		if (res.status === 204) return null;

		const data = await res.json();

		if (!res.ok) {
			throw new Error(data.error || data.message || "API Error");
		}

		return data.result;
	} catch (err: any) {
		throw new Error(err.message || "Network Error");
	}
}
