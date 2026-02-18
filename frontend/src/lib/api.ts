
let BASE_URL = "http://localhost:3000";

if (typeof window !== "undefined") {
	const isDev = import.meta.env.DEV;
	const port = isDev ? "3000" : window.location.port;
	BASE_URL = `${window.location.protocol}//${window.location.hostname}${port ? `:${port}` : ""}`;
}

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
		// Remove leading slash if present to avoid double slash
		const cleanPath = path.startsWith("/") ? path : "/" + path;
		const res = await fetch(`${BASE_URL}${cleanPath}`, options);

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
