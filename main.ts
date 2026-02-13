import { jwtVerify, SignJWT } from "jose";
import * as db from "./db";

await db.initDB();
console.log(await db.getAllUsers());

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

const server = Bun.serve({
    routes: {
        "/create": {
            POST: async req => {
                try {
                    const { payload } = await verifyJWT(req.headers.get("Authorization") ?? "invalid");
                    if (payload) {
                        if (typeof payload === "object") {
                            if (payload.role !== "admin") {
                                return new Response("Unauthorized", { status: 403 });
                            }
                        }
                    }
                    const cred = (await req.json()) as User;
                    if (typeof cred !== "object")
                        return new Response("Please fill in all details",
                            { status: 403 })

                    const { error } = await db.getUser(cred);
                    if (!error)
                        return new Response(`User exists: ${error}`, { status: 403 });

                    const { error: err } = await db.createUser(cred);
                    if (err)
                        return new Response(`User creation failed: ${err}`, { status: 403 });

                    const { users, error: errr } = await db.getUser(cred);
                    if (errr)
                        return new Response(`: ${errr}`, { status: 403 });
                    if (users instanceof Array) {
                        const user = users[0]!;
                        if (!user || !user.id || !user.name || !user.role)
                            return new Response(`internal error`, { status: 500 });
                        const payload = {
                            id: user.id,
                            name: user.name,
                            role: user.role,
                        }
                        const token = await new SignJWT(payload)
                            .setProtectedHeader({ alg: "HS256" })
                            .sign(secret);
                        return new Response(token, { status: 200 });
                    } else {
                        return new Response(`internal error`, { status: 500 });
                    }
                } catch (error) {
                    if (error instanceof SyntaxError) {
                        return new Response("Please fill in all details",
                            { status: 403 })
                    }
                    return new Response(`internal error: ${error}`, { status: 500 });
                }
            },
        },
        "/login": {
            GET: () => {
                return new Response(Bun.file("./build/login.html"));
            },
            POST: async req => {
                try {
                    const cred = (await req.json()) as User;
                    if (typeof cred !== "object")
                        return new Response("Please fill in all details",
                            { status: 403 })

                    const { users, error } = await db.getUser(cred);
                    if (error)
                        return new Response(`Failed to login: ${error}`, { status: 403 });
                    if (users instanceof Array) {
                        const user = users[0]!;
                        if (!user || !user.id || !user.name || !user.role)
                            return new Response(`internal error`, { status: 500 });
                        const payload = {
                            id: user.id,
                            name: user.name,
                            role: user.role,
                        }
                        const token = await new SignJWT(payload)
                            .setProtectedHeader({ alg: "HS256" })
                            .sign(secret);
                        return new Response(token, { status: 200 });
                    }
                    return new Response(`internal error`, { status: 500 });
                } catch {
                    return new Response("")
                }
            },
        },

        "/debug": {
            GET: () => {
                return new Response(Bun.file("./build/debug.html"));
            },
        },

        "/": Response.redirect("/login"),

        "/favicon.ico": Bun.file("./favicon.ico"),
    },

    fetch() {
        return new Response("Not Found", { status: 404 });
    },
});

console.log("Running server at http://localhost:" + server.port);
console.log("Also accesible at: " + server.hostname)
