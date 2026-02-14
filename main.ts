import { jwtVerify, SignJWT } from "jose";
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
    routes: {
        "/create": {
            OPTIONS: () => Res(null, { status: 204 }),
            POST: async req => {
                try {
                    const { payload } = await verifyJWT(req.headers.get("Authorization") ?? "invalid");
                    if (payload) {
                        if (typeof payload === "object") {
                            if (payload.role !== "admin") {
                                return Res("Unauthorized", { status: 403 });
                            }
                        }
                    }
                    const cred = (await req.json()) as User;
                    if (typeof cred !== "object")
                        return Res("Please fill in all details",
                            { status: 403 })

                    const { error } = await db.getUser(cred);
                    if (!error)
                        return Res(`User exists: ${error}`, { status: 403 });

                    const { error: err } = await db.createUser(cred);
                    if (err)
                        return Res(`User creation failed: ${err}`, { status: 403 });

                    const { users, error: errr } = await db.getUser(cred);
                    if (errr)
                        return Res(`: ${errr}`, { status: 403 });
                    if (users instanceof Array) {
                        const user = users[0]!;
                        if (!user || !user.id || !user.name || !user.role)
                            return Res(`internal error`, { status: 500 });
                        const payload = {
                            id: user.id,
                            name: user.name,
                            role: user.role,
                        }
                        const token = await new SignJWT(payload)
                            .setProtectedHeader({ alg: "HS256" })
                            .sign(secret);
                        return Res(token, { status: 200 });
                    } else {
                        return Res(`internal error`, { status: 500 });
                    }
                } catch (error) {
                    if (error instanceof SyntaxError) {
                        return Res("Please fill in all details",
                            { status: 403 })
                    }
                    return Res(`internal error: ${error}`, { status: 500 });
                }
            },
        },
        "/login": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: () => {
                return Res(Bun.file("./build/login.html"));
            },
            POST: async req => {
                try {
                    const cred = (await req.json()) as User;
                    if (typeof cred !== "object")
                        return Res("Please fill in all details",
                            { status: 403 })

                    const { users, error } = await db.getUser(cred);
                    if (error)
                        return Res(`Failed to login: ${error}`, { status: 403 });
                    if (users instanceof Array) {
                        const user = users[0]!;
                        if (!user || !user.id || !user.name || !user.role)
                            return Res(`internal error`, { status: 500 });
                        const payload = {
                            id: user.id,
                            name: user.name,
                            role: user.role,
                        }
                        const token = await new SignJWT(payload)
                            .setProtectedHeader({ alg: "HS256" })
                            .sign(secret);
                        return Res(token, { status: 200 });
                    }
                    return Res(`internal error`, { status: 500 });
                } catch {
                    return Res("")
                }
            },
        },

        "/debug": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: () => {
                return Res(Bun.file("./build/debug.html"));
            },
        },

        "/": Response.redirect("/login"),

        "/favicon.ico": Bun.file("./favicon.ico"),
    },

    fetch() {
        return Res("Not Found", { status: 404 });
    },
});

console.log("Running server at http://localhost:" + server.port);
console.log("Also accesible at: " + server.hostname)

function Res(body: any, init?: ResponseInit) {
    const res = new Response(body, init);
    res.headers.append("Access-Control-Allow-Origin", "*");
    res.headers.append("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.append("Access-Control-Allow-Headers", "Content-Type");
    return res
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
