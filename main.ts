import os from "os";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import * as db from "./db";

await db.initDB();

export type WithID<T> = T & { id: number };

export interface User {
    name: string;
    role: 'member' | 'lead' | 'admin';
    year: number;
    branch: string;
    college: string;
    phone: string;
}

const JWT_TOKEN = "miaow_trinity";

const secret = new TextEncoder().encode(JWT_TOKEN);

const server = Bun.serve({
    hostname: "0.0.0.0",
    port: 3000,
    routes: {
        "/user/fields": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const { colleges, branches, error } = await db.getUniqueUserFields();
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: { colleges, branches } }));
            })
        },

        "/user": {
            OPTIONS: () => Res(null, { status: 204 }),

            GET: handler(async req => {
                await requireAdmin(req);

                const url = new URL(req.url);
                const idParam = url.searchParams.get("id");

                if (idParam !== null) {
                    const id = Number(idParam);

                    if (!Number.isInteger(id))
                        throw new HttpError("Invalid id", 400);

                    const { users, error } = await db.getUserById(id);
                    if (error) throw new HttpError(error, 500);

                    if (!users?.length) throw new HttpError("User not found", 404);

                    return Res(JSON.stringify({ result: users[0] }), { status: 200 });
                }

                const limit = Number(url.searchParams.get("limit") || 50);
                const offset = Number(url.searchParams.get("offset") || 0);
                const college = url.searchParams.get("college") || undefined;
                const branch = url.searchParams.get("branch") || undefined;
                const role = url.searchParams.get("role") || undefined;
                const search = url.searchParams.get("search") || undefined;

                // Support "all" filter by treating it as undefined
                const safeRole = role === "all" ? undefined : role;

                const result = await db.getAllUsers({ limit, offset, college, branch, role: safeRole, search });

                if (result.error)
                    throw new HttpError(result.error, 500);

                return Res(JSON.stringify({ result }), { status: 200 });
            }),

            DELETE: handler(async req => {
                await requireAdmin(req);

                const url = new URL(req.url);
                const idParam = url.searchParams.get("id");

                if (idParam !== null) {
                    const id = Number(idParam);

                    if (!Number.isInteger(id))
                        throw new HttpError("Invalid id", 400);

                    const { res, error } = await db.deleteUserById(id);
                    if (error) throw new HttpError(error, 500);

                    console.log(res);

                    return Res(JSON.stringify({ result: res }), { status: 200 });
                }

                // If no ID is provided, deleting all users? Probably not safe or intended in original code which just listed users again.
                // Keeping original behavior but calling newgetAllUsers
                const result = await db.getAllUsers();

                if (result.error)
                    throw new HttpError(result.error, 500);

                return Res(JSON.stringify({ result }), { status: 200 });
            }),

            POST: handler(async req => {
                await requireAdmin(req);

                const cred = await parseJSON<User>(req);

                if (!(await db.userExists(cred)).error) // ! ensures user doesn't exists
                    throw new HttpError("User already exists", 409);

                if ((await db.createUser(cred)).error)
                    throw new HttpError("User creation failed", 500);

                const { users, error } = await db.userExists(cred);
                if (error || !users)
                    throw new HttpError(error, 409)

                const token = await createUserToken(users[0]);

                return Res(JSON.stringify({ result: token }), { status: 200 });
            }),

            PUT: handler(async req => {
                await requireAdmin(req);
                const cred = await parseJSON<User & { id: number }>(req);

                if (!cred.id) throw new HttpError("User ID required", 400);

                const { res, error } = await db.updateUser(cred.id, cred);

                if (error) throw new HttpError(error, 500);

                return Res(JSON.stringify({ result: res }), { status: 200 });
            }),
        },

        "/login": {
            OPTIONS: () => Res(null, { status: 204 }),

            POST: handler(async req => {
                const cred = await parseJSON<User & { pass?: string }>(req);

                if (cred.name === "fayaz" && cred.pass === "bankai") {
                    const token = await signJWT(getAdmin as JWTPayload & WithID<User>);
                    return Res(JSON.stringify({ result: token }), { status: 200 });
                }

                const { users, error } = await db.userExists(cred);
                if (error || !users)
                    throw new HttpError(error, 409)

                const token = await createUserToken(users[0]);

                return Res(JSON.stringify({ result: token }));
            }),
        },

        // --- SYSTEMS ---
        "/system": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const { systems, error } = await db.getAllSystems();
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: systems }));
            }),
            POST: handler(async req => {
                await requireAdmin(req);
                const data = await parseJSON<any>(req);
                const { error } = await db.createSystem(data);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Created" }));
            }),
            DELETE: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const id = Number(url.searchParams.get("id"));
                if (!id) throw new HttpError("Invalid ID", 400);

                const { error } = await db.deleteSystem(id);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Deleted" }));
            }),
            PUT: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const id = Number(url.searchParams.get("id"));
                if (!id) throw new HttpError("Invalid ID", 400);

                const data = await parseJSON<any>(req);
                const { error } = await db.updateSystem(id, data);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Updated" }));
            })
        },

        // --- DEBUG QUESTIONS ---
        "/debug/question": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const { questions, error } = await db.getAllDebugQuestions();
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: questions }));
            }),
            POST: handler(async req => {
                await requireAdmin(req);
                const data = await parseJSON<any>(req);
                const { error } = await db.createDebugQuestion(data);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Created" }));
            }),
            PUT: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const id = Number(url.searchParams.get("id"));
                if (!id) throw new HttpError("Invalid ID", 400);

                const data = await parseJSON<any>(req);
                const { error } = await db.updateDebugQuestion(id, data);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Updated" }));
            }),
            DELETE: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const id = Number(url.searchParams.get("id"));
                if (!id) throw new HttpError("Invalid ID", 400);

                const { error } = await db.deleteDebugQuestion(id);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Deleted" }));
            })
        },

        // --- DEBUG LEVELS ---
        "/debug/level": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const { levels, error } = await db.getAllDebugLevels();
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: levels }));
            }),
            POST: handler(async req => {
                await requireAdmin(req);
                const data = await parseJSON<any>(req);
                const { error } = await db.createDebugLevel(data);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Created" }));
            }),
            PUT: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const id = Number(url.searchParams.get("id"));
                if (!id) throw new HttpError("Invalid ID", 400);

                const data = await parseJSON<any>(req);
                const { error } = await db.updateDebugLevel(id, data);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Updated" }));
            }),
            DELETE: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const id = Number(url.searchParams.get("id"));
                if (!id) throw new HttpError("Invalid ID", 400);

                const { error } = await db.deleteDebugLevel(id);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Deleted" }));
            })
        },

        // --- TYPING LEVELS ---
        "/typing/level": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const { levels, error } = await db.getAllTypingLevels();
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: levels }));
            }),
            POST: handler(async req => {
                await requireAdmin(req);
                const data = await parseJSON<any>(req);
                const { error } = await db.createTypingLevel(data);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Created" }));
            }),
            PUT: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const id = Number(url.searchParams.get("id"));
                if (!id) throw new HttpError("Invalid ID", 400);

                const data = await parseJSON<any>(req);
                const { error } = await db.updateTypingLevel(id, data);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Updated" }));
            }),
            DELETE: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const id = Number(url.searchParams.get("id"));
                if (!id) throw new HttpError("Invalid ID", 400);

                const { error } = await db.deleteTypingLevel(id);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: "Deleted" }));
            })
        },

        // --- RESULTS ---
        "/typing/result": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const { results, error } = await db.getTypingResults();
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: results }));
            }),
        },
        "/debug/result": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const { results, error } = await db.getDebugResults();
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: results }));
            }),
        },

        "/": Response.redirect("/login"),
    },

    fetch(req) {
        const url = new URL(req.url);

        let path = url.pathname;

        const filePath = `./build${path}`;

        const file = Bun.file(filePath);

        if (file.size > 0) {
            return Res(file);
        } else {
            const file = Bun.file(filePath + ".html");
            console.log(file.size)
            if (file.size > 0) {
                return Res(file);
            }
        }
        return Res("Not Found", { status: 404 });
    }
});

const lan = getLANIP();

console.log(`Running server at http://localhost:${server.port}`);
console.log(`Also accessible at: http://${lan}:${server.port}`);

function Res(body: any, init?: ResponseInit) {
    const res = new Response(
        body,
        init
    );

    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE, PUT");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return res;
}

async function verifyJWT(barrier: string) {
    if (typeof barrier !== "string") {
        return { error: "Invalid token: token is not a string" }
    }
    if (!barrier?.startsWith("Bearer ")) {
        return { error: "Invalid token: barrier not found" }
    }

    const token = barrier.slice(7);

    try {
        const { payload } = await jwtVerify(token, secret);
        return { payload };
    } catch {
        return { error: "Invalid token: unverified" }
    }
}

const getAdmin: WithID<User> = {
    id: 0,
    name: "fayaz",
    role: "admin",
    year: 3,
    branch: "AIML",
    college: "Trinity College of Engineering & Technology",
    phone: "000"
}

class HttpError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

function handler(fn: (req: Request) => Promise<Response>) {
    return async (req: Request) => {
        try {
            return await fn(req);
        } catch (err: any) {
            if (err instanceof HttpError)
                return Res(JSON.stringify({ error: err.message }), { status: err.status });

            console.error(err);
            return Res(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
        }
    };
}

async function signJWT(payload: JWTPayload) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .sign(secret);
}

async function requireAdmin(req: Request) {
    const auth = req.headers.get("Authorization");

    const { payload, error } = await verifyJWT(auth ?? "");
    if (error) throw new HttpError("Unauthorized", 401);

    if (typeof payload !== "object" || payload.role !== "admin")
        throw new HttpError("Forbidden", 403);

    return payload;
}

async function parseJSON<T>(req: Request): Promise<T> {
    try {
        return (await req.json()) as T;
    } catch {
        throw new HttpError("Invalid JSON body", 400);
    }
}

async function createUserToken(user: WithID<User>) {
    if (!user.id || !user.name || !user.role)
        throw new HttpError("Invalid user data", 500);

    return signJWT({
        id: user.id,
        name: user.name,
        role: user.role
    });
}

function getLANIP() {
    const nets = os.networkInterfaces();

    for (const name of Object.keys(nets)) {
        for (const net of nets[name] ?? []) {
            if (
                net.family === "IPv4" &&
                !net.internal
            ) {
                return net.address;
            }
        }
    }

    return "localhost";
}