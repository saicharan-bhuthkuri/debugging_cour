
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

	let resolvedToken = token;
	if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
		const adminTok = localStorage.getItem("admin_token");
		if (adminTok) {
			resolvedToken = adminTok;
		}
	}
	if (!resolvedToken && typeof localStorage !== "undefined") {
		resolvedToken = localStorage.getItem("admin_token") || localStorage.getItem("login_token") || "";
	}

	if (resolvedToken) {
		headers["Authorization"] = `Bearer ${resolvedToken}`;
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
			if ((res.status === 401 || res.status === 403) && typeof window !== "undefined") {
				const isLoginRoute = window.location.pathname.includes("/admin/login") || window.location.pathname === "/login";
				if (!isLoginRoute && window.location.pathname.startsWith("/admin")) {
					localStorage.removeItem("login_token");
					localStorage.removeItem("admin_token");
					window.location.href = "/admin/login";
				}
			}
			throw new Error(data.error || data.message || "API Error");
		}

		return data.result;
	} catch (err: any) {
		throw new Error(err.message || "Network Error");
	}
}
