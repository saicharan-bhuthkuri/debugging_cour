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

                const { users, error } = await db.getAllUsers();

                if (error)
                    throw new HttpError(error, 500);

                return Res(JSON.stringify({ result: users }), { status: 200 });
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

                const { users, error } = await db.getAllUsers();

                if (error)
                    throw new HttpError(error, 500);

                return Res(JSON.stringify({ result: users }), { status: 200 });
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