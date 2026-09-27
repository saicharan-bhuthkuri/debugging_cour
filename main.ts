import os from "os";
import { extname, join, normalize } from "path";
import { existsSync, statSync } from "fs";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import * as db from "./db";
import { wsManager, type WSData } from "./ws_server";
import { WccRunner } from "./wcc-lib";
import wccfiles from './wcc-lib/wccfiles.zip' with { type: "file" };
import wasiWorkerURL from './wcc-lib/wasi_worker.js' with { type: "file" };

await db.initDB();

// Reset all systems to offline on start, except if they are in exam mode
try {
    await db.resetSystemsStatusOnStart();
    console.log("Systems status normalized for startup.");
} catch (e) {
    console.error("Failed to normalize systems status:", e);
}

export type WithID<T> = T & { id: number };

export interface User {
    name: string;
    role: 'member' | 'lead' | 'admin' | 'superadmin';
    year: number;
    branch: string;
    college: string;
    phone: string;
    password?: string;
}

const JWT_TOKEN = process.env.JWT_SECRET || "miaow_trinity";

const secret = new TextEncoder().encode(JWT_TOKEN);

const ROOT = "./build";

function resolveFile(pathname: string): string | null {
    // Normalize path and prevent directory traversal
    const normalizedPath = normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = join(ROOT, normalizedPath);

    // 1. Try direct match (file or directory/index.html)
    if (existsSync(filePath)) {
        const stat = statSync(filePath);
        if (stat.isFile()) return filePath;

        if (stat.isDirectory()) {
            const indexFile = join(filePath, "index.html");
            if (existsSync(indexFile)) return indexFile;
        }
    }

    // 2. Try .html fallback (Clean URLs)
    // Strip trailing slash if any before appending .html
    if (!extname(filePath)) {
        const htmlPath = filePath.replace(/[\/\\]$/, "") + ".html";
        if (existsSync(htmlPath)) return htmlPath;
    }

    return null;
}

let cachedZipData: Uint8Array | null = null;
async function getZipData(): Promise<Uint8Array> {
    if (!cachedZipData) {
        cachedZipData = new Uint8Array(await Bun.file(wccfiles).arrayBuffer());
    }
    return cachedZipData;
}

// Semaphore to limit concurrent WCC compiler workers to 6
class Semaphore {
    private running = 0;
    private queue: (() => void)[] = [];
    constructor(private max: number) {}
    async acquire(): Promise<() => void> {
        if (this.running < this.max) {
            this.running++;
            return () => this.release();
        }
        return new Promise<() => void>((resolve) => {
            this.queue.push(() => {
                this.running++;
                resolve(() => this.release());
            });
        });
    }
    private release() {
        this.running--;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) next();
        }
    }
}
const wccSemaphore = new Semaphore(6);

async function evaluateCode(source_code: string, question_id: number) {
    const { question } = await db.getDebugQuestionById(question_id);
    if (!question || !question.test_cases || (Array.isArray(question.test_cases) && question.test_cases.length === 0)) {
        return { results: [], message: "No test cases configured." };
    }

    const testCases = question.test_cases;
    const results = [];

    const zip = await getZipData();
    const release = await wccSemaphore.acquire();
    const runner = new WccRunner({
        zip,
        workerURL: wasiWorkerURL as any
    });

    try {
        await runner.readyPromise;
        for (const tc of testCases) {
            try {
                const execResult = await runner.exec(source_code, {
                    stdin: tc.input,
                    timeout: 5000
                });

                const actualOutput = execResult.stdout.trim();
                const expectedOutput = tc.output.trim();
                const pass = actualOutput === expectedOutput;

                results.push({
                    pass: pass,
                    error: pass ? null : (execResult.stderr || (execResult.exitCode !== 0 ? `Exit code ${execResult.exitCode}` : "Wrong Answer"))
                });
            } catch (e: any) {
                results.push({
                    pass: false,
                    error: e.message || "Time limit exceeded or execution error"
                });
            }
        }
    } finally {
        runner.terminate();
        release();
    }
    return { results };
}

const server = Bun.serve<WSData>({
    hostname: "0.0.0.0",
    port: process.env.PORT || 3000,
    websocket: {
        open: (ws) => wsManager.open(ws),
        message: (ws, msg) => wsManager.message(ws, msg),
        close: (ws) => wsManager.close(ws),
    },
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
                const user = await requireAdmin(req);
                if (user.role !== "superadmin") throw new HttpError("Forbidden: Super Admin only", 403);

                const url = new URL(req.url);
                const idParam = url.searchParams.get("id");

                if (idParam !== null) {
                    const id = Number(idParam);
                    if (!Number.isInteger(id)) throw new HttpError("Invalid id", 400);

                    const { res, error } = await db.deleteUserById(id);
                    if (error) throw new HttpError(error, 500);

                    return Res(JSON.stringify({ result: res }), { status: 200 });
                }
                const result = await db.getAllUsers();
                if (result.error) throw new HttpError(result.error, 500);
                return Res(JSON.stringify({ result }), { status: 200 });
            }),

            POST: handler(async req => {
                const admin = await requireAdmin(req);
                const data = await parseJSON<User & { system_id?: number, exam_type?: string, level_id?: number }>(req);

                // Prevent non-superadmin from creating admin/superadmin accounts
                if (data.role && (data.role === "admin" || data.role === "superadmin")) {
                    if (admin.role !== "superadmin") {
                        throw new HttpError("Forbidden: Only Super Admin can create admin accounts", 403);
                    }
                }

                // Check if user exists
                const existing = await db.userExists(data);
                if (!existing.error) throw new HttpError("User already exists", 409);

                // Create user
                const createRes = await db.createUser(data);
                if (createRes.error) throw new HttpError("User creation failed: " + createRes.error, 500);

                const { users } = await db.userExists(data);
                if (!users || users.length === 0) throw new HttpError("Failed to retrieve created user", 500);
                const newUser = users[0];

                // Optional system assignment
                if (data.system_id) {
                    const otp = Math.floor(10000 + Math.random() * 90000).toString();
                    const assignRes = await db.assignSystemToUserStrict(
                        data.system_id,
                        newUser.id,
                        otp,
                        data.exam_type || 'debug',
                        data.level_id || null
                    );

                    if (assignRes.error) {
                        // User creation succeeded but system was taken/offline
                        throw new HttpError("User created successfully, but system assignment failed (Already booked or disconnected). Please refresh available systems list.", 409);
                    }

                    // Success: Broadcast system update
                    await notifySystemUpdate(data.system_id);
                }

                return Res(JSON.stringify({ result: newUser }), { status: 200 });
            }),

            PUT: handler(async req => {
                const user = await requireAdmin(req);
                const cred = await parseJSON<User & { id: number }>(req);

                if (!cred.id) throw new HttpError("User ID required", 400);

                // Only superadmin can edit role to superadmin/admin?
                if (cred.role && (cred.role === "admin" || cred.role === "superadmin")) {
                    if (user.role !== "superadmin") throw new HttpError("Forbidden: Only Super Admin can promote", 403);
                }

                const { res, error } = await db.updateUser(cred.id, cred);

                if (error) throw new HttpError(error, 500);

                return Res(JSON.stringify({ result: res }), { status: 200 });
            }),
        },

        "/login": {
            OPTIONS: () => Res(null, { status: 204 }),

            POST: handler(async req => {
                const body = await parseJSON<any>(req);

                // System Login
                if (body.systemNumber) {
                    const { system, error } = await db.getSystemByCode(body.systemNumber);
                    if (error || !system) throw new HttpError("System not found", 404);

                    // 1. Check if trying to restore session with valid token
                    const auth = req.headers.get("Authorization");
                    if (auth) {
                        const { payload } = await verifyJWT(auth);
                        if (payload && payload.role === 'system' && (payload as any).name === body.systemNumber) {
                            // Valid session restore
                            // Ensure it's online in DB if it was offline
                            if (system.status === 'offline') {
                                await db.updateSystem(system.id, { status: 'online' });
                                await notifySystemUpdate(system.id);
                            }
                            return Res(JSON.stringify({ result: auth.replace("Bearer ", "") }), { status: 200 });
                        }
                    }

                    // If OTP is provided, verify it (Exam Start / Validation)
                    if (body.otp) {
                        if (system.login_otp !== body.otp) throw new HttpError("Invalid OTP", 401);
                    } else {
                        // Code-only login: Just claiming the system (Online Mode)
                        if (system.status !== 'offline') {
                            throw new HttpError("Duplicate System ID", 409);
                        }
                    }

                    const token = await createToken({ id: system.id, name: system.code, role: "system" });

                    // Lock system immediately to prevent race conditions
                    await db.updateSystem(system.id, { status: 'online' });
                    await notifySystemUpdate(system.id);

                    return Res(JSON.stringify({ result: token }), { status: 200 });
                }

                // User/Admin Login
                const cred = body as User & { pass?: string };

                if (!cred.name || !cred.pass) throw new HttpError("Invalid credentials", 400);

                // Check DB with getUserAuth
                const { user, error } = await db.getUserAuth(cred.name);
                if (error || !user || !user.password) throw new HttpError("Invalid credentials", 401);

                let valid = false;
                if (user.password.startsWith("$argon2id$")) {
                    valid = await Bun.password.verify(cred.pass, user.password);
                } else {
                    valid = user.password === cred.pass;
                    if (valid) {
                        // Automatically migrate legacy plaintext password to Argon2id
                        const hashed = await Bun.password.hash(cred.pass, { algorithm: "argon2id" });
                        await db.updateUserPassword(user.id, hashed);
                    }
                }

                if (!valid) throw new HttpError("Invalid credentials", 401);

                if (user.role !== 'admin' && user.role !== 'superadmin') throw new HttpError("Forbidden", 403);

                const token = await createUserToken(user);
                return Res(JSON.stringify({ result: token }));
            }),
        },

        "/system/status": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                const auth = req.headers.get("Authorization");
                const { payload } = await verifyJWT(auth ?? "");
                if (!payload || payload.role !== "system") throw new HttpError("Unauthorized", 401);

                const { system } = await db.getSystemByCode((payload as any).name);
                if (!system) throw new HttpError("System invalid", 404);

                return Res(JSON.stringify({ result: system }), { status: 200 });
            })
        },

        "/system/verify": {
            OPTIONS: () => Res(null, { status: 204 }),
            POST: handler(async req => {
                // Endpoint to verify OTP for a logged-in system
                const auth = req.headers.get("Authorization");
                const { payload } = await verifyJWT(auth ?? "");
                if (!payload || payload.role !== "system") throw new HttpError("Unauthorized", 401);

                const body = await parseJSON<any>(req);
                if (!body.otp) throw new HttpError("OTP Required", 400);

                const { system } = await db.getSystemByCode((payload as any).name);
                if (!system) throw new HttpError("System invalid", 404);

                if (system.login_otp !== body.otp) throw new HttpError("Invalid OTP", 401);

                return Res(JSON.stringify({ result: "Verified" }), { status: 200 });
            })
        },

        "/system/start": {
            OPTIONS: () => Res(null, { status: 204 }),
            POST: handler(async req => {
                const auth = req.headers.get("Authorization");
                const { payload } = await verifyJWT(auth ?? "");
                if (!payload || payload.role !== "system") throw new HttpError("Unauthorized", 401);

                const { system } = await db.getSystemByCode((payload as any).name);
                if (!system) throw new HttpError("System invalid", 404);

                // Fetch level duration
                let levelDuration = 900; // default 15 min
                if (system.assigned_level_id) {
                    const { level } = await db.getDebugLevelById(system.assigned_level_id);
                    if (level && level.duration) levelDuration = level.duration;
                }

                // Create Exam Session
                const { id: sessionId, error } = await db.createExamSession({
                    user_id: system.assigned_to,
                    system_id: system.id,
                    exam_mode: system.exam_type
                });

                if (error) throw new HttpError("Failed to create session", 500);

                // Log Start Event
                await db.createSystemLog({
                    exam_session_id: sessionId,
                    user_id: system.assigned_to,
                    system_code: system.code,
                    log_type: "EXAM_START",
                    data: {
                        timestamp: new Date().toISOString(),
                        exam_mode: system.exam_type,
                        msg: "Exam Started"
                    }
                });

                // Update to EXAM mode
                await db.updateSystem(system.id, { status: 'exam' });

                // Broadcast change
                await notifySystemUpdate(system.id);

                return Res(JSON.stringify({ result: { message: "Started", sessionId, duration: levelDuration } }), { status: 200 });
            })
        },

        "/system/finish": {
            OPTIONS: () => Res(null, { status: 204 }),
            POST: handler(async req => {
                const auth = req.headers.get("Authorization");
                const { payload } = await verifyJWT(auth ?? "");
                if (!payload || payload.role !== "system") throw new HttpError("Unauthorized", 401);

                const { system } = await db.getSystemByCode((payload as any).name);
                if (!system) throw new HttpError("System invalid", 404);

                const body = await parseJSON<any>(req);
                const reason = body?.reason || "normal";
                let sessionId = body?.session_id;

                // Fallback: Find ongoing session if not provided
                if (!sessionId && system.assigned_to) {
                    const { sessions } = await db.getAllExamSessions({
                        user_id: system.assigned_to,
                        status: 'ongoing',
                        limit: 1
                    });
                    if (sessions && sessions.length > 0) {
                        sessionId = sessions[0].id;
                    }
                }

                // Update Exam Session Status
                if (sessionId) {
                    await db.updateExamSession(Number(sessionId), {
                        status: reason === "disqualified" ? "disqualified" : "completed",
                        end_time: new Date().toISOString()
                    });
                }

                if (reason === "disqualified") {
                    // Disqualification: mark as completed but KEEP assigned_to
                    // so admin can push back to exam mode and student can resume
                    await db.updateSystem(system.id, {
                        status: 'completed'
                        // Keep assigned_to and login_otp intact
                    });
                } else {
                    // Normal finish: clear user assignment
                    const newOtp = Math.floor(10000 + Math.random() * 90000).toString();
                    await db.updateSystem(system.id, {
                        status: 'completed',
                        assigned_to: null,
                        login_otp: newOtp
                    });
                }

                // Broadcast change
                await notifySystemUpdate(system.id);

                return Res(JSON.stringify({ result: "Finished" }), { status: 200 });
            })
        },

        "/system/reset": {
            OPTIONS: () => Res(null, { status: 204 }),
            POST: handler(async req => {
                await requireAdmin(req);
                const body = await parseJSON<any>(req);
                const id = body.id;
                if (!id) throw new HttpError("System ID required", 400);

                const { system } = await db.getSystemById(id);
                if (!system) throw new HttpError("System not found", 404);

                if (system.status === 'exam') {
                    throw new HttpError("Cannot reset system while in EXAM mode", 403);
                }

                const isConnected = wsManager.isSystemConnected(id);
                const newStatus = isConnected ? 'online' : 'offline';

                const { error } = await db.resetSystem(id, newStatus);
                if (error) throw new HttpError(error, 500);

                // Fetch updated
                await notifySystemUpdate(id);

                return Res(JSON.stringify({ result: "Reset" }), { status: 200 });
            })
        },

        "/system/log": {
            OPTIONS: () => Res(null, { status: 204 }),
            POST: handler(async req => {
                const auth = req.headers.get("Authorization");
                const { payload } = await verifyJWT(auth ?? "");
                if (!payload || payload.role !== "system") throw new HttpError("Unauthorized", 401);

                const body = await parseJSON<any>(req);
                const { system } = await db.getSystemByCode((payload as any).name);
                if (!system) throw new HttpError("System invalid", 404);

                // Ideally get session from body or active session?
                // User said "log every submitted question", assuming body has session_id

                await db.createSystemLog({
                    exam_session_id: body.session_id || 0,
                    user_id: system.assigned_to,
                    system_code: system.code,
                    log_type: body.type,
                    data: body.data
                });

                // Automated Grading for SUBMIT
                if (body.type === "SUBMIT" && body.data?.question_id && body.data?.answer) {
                    const session_id = body.session_id;
                    const { results } = await evaluateCode(body.data.answer, body.data.question_id);

                    if (results && results.length > 0) {
                        const allPassed = results.every((r: any) => r.pass);
                        if (allPassed) {
                            await db.gradeSubmission(session_id, body.data.question_id, true);
                        } else {
                            // If it failed tests, we mark it as incorrect (or leave it for manual? User said "if all pass, then mark as correct")
                            // Usually if tests fail, it's incorrect.
                            await db.gradeSubmission(session_id, body.data.question_id, false);
                        }
                    }
                }

                return Res(JSON.stringify({ result: "Logged" }), { status: 200 });
            })
        },

        "/system/check": {
            OPTIONS: () => Res(null, { status: 204 }),
            POST: handler(async req => {
                const body = await parseJSON<any>(req);
                if (!body.code) throw new HttpError("System code required", 400);

                let { system } = await db.getSystemByCode(body.code);

                if (!system) {
                    // Auto-register new system
                    console.log(`Auto-registering new system: ${body.code}`);
                    const { error } = await db.createSystem({
                        code: body.code,
                        status: 'offline', // Will be set online by WS
                        exam_type: 'debug'
                    });
                    if (error) throw new HttpError("Failed to register system", 500);
                    const res = await db.getSystemByCode(body.code);
                    system = res.system;
                }

                if (!system) throw new HttpError("System not found", 404);

                // Return public info relevant for UI
                // Fetch level info if assigned
                let levelInfo: any = null;
                if (system.assigned_level_id) {
                    if (system.exam_type === 'typing') {
                        const { level } = await db.getTypingLevelById(system.assigned_level_id);
                        if (level) levelInfo = { id: level.id, name: level.name, duration: level.time_limit || 60 };
                    } else {
                        const { level } = await db.getDebugLevelById(system.assigned_level_id);
                        if (level) levelInfo = { id: level.id, name: level.name, duration: level.duration || 900 };
                    }
                }

                return Res(JSON.stringify({
                    result: {
                        code: system.code,
                        status: system.status,
                        exam_type: system.exam_type,
                        assigned_to_name: (system as any).assigned_to_name,
                        assigned_level_id: system.assigned_level_id,
                        level: levelInfo
                    }
                }));
            })
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
                const user = await requireAdmin(req);
                const url = new URL(req.url);
                const id = Number(url.searchParams.get("id"));
                const force = url.searchParams.get("force") === "true"; // Add force param support

                if (!id) throw new HttpError("Invalid ID", 400);

                // Check system status if not force
                if (!force) {
                    // Get system first (Need getSystemById or filter from all)
                    const { systems } = await db.getAllSystems();
                    const system = systems?.find((s: any) => s.id === id);
                    if (system && (system.status === 'exam' || system.status === 'busy')) {
                        throw new HttpError("Cannot delete system while exam is in progress", 409);
                    }
                }

                if (user.role !== "superadmin" && force) {
                    throw new HttpError("Forbidden: Only Super Admin can force delete", 403);
                }

                const { error } = await db.deleteSystem(id);
                if (error) throw new HttpError(error, 500);

                // Broadcast deletion to all
                wsManager.broadcastAll({ type: "system_deleted", id });
                // Also notify context to disconnect
                wsManager.sendToSystem(id, { type: "unregistered" });
                wsManager.disconnectSystem(id);

                return Res(JSON.stringify({ result: "Deleted" }));
            }),
            PUT: handler(async req => {
                const user = await requireAdmin(req);
                const url = new URL(req.url);
                const id = Number(url.searchParams.get("id"));
                const force = url.searchParams.get("force") === "true";
                if (!id) throw new HttpError("Invalid ID", 400);

                const data = await parseJSON<any>(req);

                // Check current system status
                const { system: currentSystem } = await db.getSystemById(id);
                if (currentSystem && currentSystem.status === 'exam' && !force) {
                    throw new HttpError("System is in EXAM mode. Edits are restricted.", 403);
                }

                // Special handling: setting status to 'online' from completed/booked
                // First reset to offline, then check if system is actually connected
                if (data.status === 'online' && currentSystem &&
                    (currentSystem.status === 'completed' || currentSystem.status === 'booked')) {

                    // Step 1: Reset to offline (clear assignment if coming from completed)
                    const resetData: any = { status: 'offline' };
                    if (currentSystem.status === 'completed') {
                        resetData.assigned_to = null;
                        resetData.login_otp = null;
                    }
                    await db.updateSystem(id, resetData);
                    await notifySystemUpdate(id);

                    // Step 2: Check if system has an active WS connection
                    if (wsManager.isSystemConnected(id)) {
                        // System is connected — promote to online
                        await db.updateSystem(id, { status: 'online' });
                        await notifySystemUpdate(id);
                    }
                    // If not connected, it stays offline

                    return Res(JSON.stringify({ result: "Updated" }));
                }

                const { error } = await db.updateSystem(id, data);
                if (error) throw new HttpError(error, 500);

                // Broadcast to admins & system
                await notifySystemUpdate(id);

                return Res(JSON.stringify({ result: "Updated" }));
            })
        },

        "/system/bulk": {
            OPTIONS: () => Res(null, { status: 204 }),
            POST: handler(async req => {
                await requireAdmin(req);
                const body = await parseJSON<{ ids: number[], data: any }>(req);
                if (!body.ids || !Array.isArray(body.ids)) throw new HttpError("IDs array required", 400);

                // Server-side exam mode check: filter out systems currently in exam mode
                const skippedIds: number[] = [];
                const validIds: number[] = [];
                for (const id of body.ids) {
                    const { system } = await db.getSystemById(id);
                    if (system && system.status === 'exam') {
                        skippedIds.push(id);
                    } else {
                        validIds.push(id);
                    }
                }

                if (validIds.length === 0) {
                    throw new HttpError("All selected systems are in EXAM mode and cannot be updated", 403);
                }

                const { error, otp } = await db.bulkUpdateSystems(validIds, body.data);
                if (error) throw new HttpError(error, 500);

                // Broadcast updates to all admins and systems
                for (const id of validIds) {
                    await notifySystemUpdate(id);
                }

                return Res(JSON.stringify({
                    result: {
                        message: "Bulk update completed",
                        skipped: skippedIds,
                        updated: validIds.length,
                        otp: otp
                    }
                }));
            })
        },

        // --- DEBUG QUESTIONS ---
        "/debug/question": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                // Allow Admin or System
                const auth = req.headers.get("Authorization");
                const { payload } = await verifyJWT(auth ?? "");
                if (!payload || (payload.role !== "admin" && payload.role !== "superadmin" && payload.role !== "system")) {
                    throw new HttpError("Unauthorized", 401);
                }

                // If student system terminal, omit answer_meta and test_cases
                if (payload.role === "system") {
                    const { system } = await db.getSystemByCode((payload as any).name);
                    const { questions, error } = await db.getStudentQuestions(system?.assigned_level_id);
                    if (error) throw new HttpError(error, 500);
                    return Res(JSON.stringify({ result: questions }));
                }

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

        "/debug/run": {
            OPTIONS: () => Res(null, { status: 204 }),
            POST: handler(async req => {
                const auth = req.headers.get("Authorization");
                const { payload } = await verifyJWT(auth ?? "");
                if (!payload) throw new HttpError("Unauthorized", 401);

                // For systems, verify exam mode and time limit
                if (payload.role === "system") {
                    const { system } = await db.getSystemByCode((payload as any).name);
                    if (!system) throw new HttpError("System not found", 404);
                    if (system.status !== "exam") throw new HttpError("System is not in exam mode", 403);

                    if (system.assigned_to) {
                        const { sessions } = await db.getAllExamSessions({
                            user_id: system.assigned_to,
                            status: 'ongoing',
                            limit: 1
                        });
                        if (sessions && sessions.length > 0) {
                            const session = sessions[0];
                            let duration = 900;
                            if (system.assigned_level_id) {
                                const { level } = await db.getDebugLevelById(system.assigned_level_id);
                                if (level?.duration) duration = level.duration;
                            }
                            const elapsed = (Date.now() - new Date(session.start_time).getTime()) / 1000;
                            if (elapsed > duration + 15) {
                                throw new HttpError("Exam time limit exceeded", 403);
                            }
                        }
                    }
                }

                const { source_code, question_id } = await parseJSON<any>(req);
                if (!source_code || !question_id) throw new HttpError("Missing source_code or question_id", 400);

                const { results, message } = await evaluateCode(source_code, question_id);
                if (message) {
                    return Res(JSON.stringify({ result: { results: [], message } }));
                }

                return Res(JSON.stringify({ result: { results } }));
            })
        },

        // --- DEBUG LEVELS ---
        "/debug/level": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                // Allow Admin or System
                const auth = req.headers.get("Authorization");
                const { payload } = await verifyJWT(auth ?? "");
                if (!payload || (payload.role !== "admin" && payload.role !== "superadmin" && payload.role !== "system")) {
                    throw new HttpError("Unauthorized", 401);
                }

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

        // --- TYPING LEVEL: Current (for students) ---
        "/typing/level/current": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                const auth = req.headers.get("Authorization");
                const { payload, error: authErr } = await verifyJWT(auth ?? "");
                if (authErr || !payload) throw new HttpError("Unauthorized", 401);

                // Get the system this user is on
                const systemCode = req.headers.get("x-system-code") || "";
                let system: any = null;

                if (systemCode) {
                    const res = await db.getSystemByCode(systemCode);
                    system = res.system;
                } else {
                    // Find system by user assignment
                    const { systems } = await db.getAllSystems();
                    if (systems) {
                        system = systems.find((s: any) => s.assigned_to === (payload as any).id);
                    }
                }

                if (!system || !system.assigned_level_id) {
                    // Return default typing config
                    return Res(JSON.stringify({ result: { name: "Typing Test", time_limit: 60, passing_accuracy: 90, attempts_allowed: 2, content: "" } }));
                }

                // Check if this is a typing exam
                if (system.exam_type === 'typing') {
                    const { level } = await db.getTypingLevelById(system.assigned_level_id);
                    if (level) {
                        return Res(JSON.stringify({ result: level }));
                    }
                }

                return Res(JSON.stringify({ result: { name: "Typing Test", time_limit: 60, passing_accuracy: 90, attempts_allowed: 2, content: "" } }));
            })
        },

        // --- ADMIN: TYPING RESULTS ---
        "/admin/typing/results": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const options: any = {};
                if (url.searchParams.get("college")) options.college = url.searchParams.get("college");
                if (url.searchParams.get("branch")) options.branch = url.searchParams.get("branch");
                if (url.searchParams.get("year")) options.year = Number(url.searchParams.get("year"));
                if (url.searchParams.get("level_id")) options.level_id = Number(url.searchParams.get("level_id"));
                if (url.searchParams.get("status")) options.status = url.searchParams.get("status");

                const { results, error } = await db.getTypingResults(options);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: results }));
            })
        },

        "/admin/typing/results/options": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const { colleges, branches, years, levels, error } = await db.getTypingResultGroupOptions() as any;
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: { colleges, branches, years, levels } }));
            })
        },

        // --- ADMIN: LOGS ---
        "/admin/logs": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const options: any = {};
                if (url.searchParams.get('log_type')) options.log_type = url.searchParams.get('log_type');
                if (url.searchParams.get('session_id')) options.session_id = parseInt(url.searchParams.get('session_id')!);
                if (url.searchParams.get('user_id')) options.user_id = parseInt(url.searchParams.get('user_id')!);
                if (url.searchParams.get('system_code')) options.system_code = url.searchParams.get('system_code');
                if (url.searchParams.get('search')) options.search = url.searchParams.get('search');
                if (url.searchParams.get('limit')) options.limit = parseInt(url.searchParams.get('limit')!);
                if (url.searchParams.get('offset')) options.offset = parseInt(url.searchParams.get('offset')!);

                const { logs, total, error } = await db.getAllLogs(options);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: { logs, total } }));
            })
        },

        "/admin/logs/types": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const { types, error } = await db.getLogTypes();
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: types }));
            })
        },

        // --- ADMIN: SESSIONS ---
        "/admin/sessions": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const options: any = {};
                if (url.searchParams.get('exam_mode')) options.exam_mode = url.searchParams.get('exam_mode');
                if (url.searchParams.get('status')) options.status = url.searchParams.get('status');
                if (url.searchParams.get('user_id')) options.user_id = parseInt(url.searchParams.get('user_id')!);
                if (url.searchParams.get('search')) options.search = url.searchParams.get('search');
                if (url.searchParams.get('limit')) options.limit = parseInt(url.searchParams.get('limit')!);
                if (url.searchParams.get('offset')) options.offset = parseInt(url.searchParams.get('offset')!);

                const { sessions, total, error } = await db.getAllExamSessions(options);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: { sessions, total } }));
            })
        },

        "/admin/session/detail": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const id = url.searchParams.get('id');
                if (!id) throw new HttpError("Session ID required", 400);

                const { session, error } = await db.getExamSessionById(parseInt(id));
                if (error) throw new HttpError(error, 500);
                if (!session) throw new HttpError("Session not found", 404);

                const { logs, error: logsError } = await db.getSessionLogs(parseInt(id));
                if (logsError) throw new HttpError(logsError, 500);

                return Res(JSON.stringify({ result: { session, logs } }));
            })
        },

        // --- ADMIN: RESULTS ---
        "/admin/results": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const options: any = {};
                if (url.searchParams.get('exam_mode')) options.exam_mode = url.searchParams.get('exam_mode');
                if (url.searchParams.get('college')) options.college = url.searchParams.get('college');
                if (url.searchParams.get('branch')) options.branch = url.searchParams.get('branch');
                if (url.searchParams.get('year')) options.year = parseInt(url.searchParams.get('year')!);
                if (url.searchParams.get('level_id')) options.level_id = parseInt(url.searchParams.get('level_id')!);

                const { results, error } = await db.getExamResults(options);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: results }));
            })
        },

        "/admin/results/grade": {
            OPTIONS: () => Res(null, { status: 204 }),
            POST: handler(async req => {
                await requireAdmin(req);
                const body = await parseJSON<any>(req);
                const { session_id, question_id, is_correct } = body;
                if (!session_id || !question_id) throw new HttpError("Missing required fields", 400);

                const { success, error } = await db.gradeSubmission(session_id, question_id, is_correct);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: { success } }));
            })
        },

        "/admin/results/options": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const { colleges, branches, years, levels, modes, error } = await db.getResultGroupOptions() as any;
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: { colleges, branches, years, levels, modes } }));
            })
        },

        // --- BATCH LOG SUBMISSION (for offline sync) ---
        "/system/log/batch": {
            OPTIONS: () => Res(null, { status: 204 }),
            POST: handler(async req => {
                const auth = req.headers.get("Authorization");
                const { payload } = await verifyJWT(auth ?? "");
                if (!payload || payload.role !== "system") throw new HttpError("Unauthorized", 401);

                const { system } = await db.getSystemByCode((payload as any).name);
                if (!system) throw new HttpError("System invalid", 404);

                const body = await parseJSON<any>(req);
                if (!body.logs || !Array.isArray(body.logs)) throw new HttpError("logs array required", 400);

                const logsToCreate = body.logs.map((log: any) => ({
                    exam_session_id: log.session_id || 0,
                    user_id: system.assigned_to,
                    system_code: system.code,
                    log_type: log.type,
                    data: log.data,
                    timestamp: log.data?.timestamp
                }));

                const { created, error } = await db.batchCreateLogs(logsToCreate);
                if (error) throw new HttpError(error, 500);
                return Res(JSON.stringify({ result: { created } }), { status: 200 });
            })
        },

        // --- QUESTION BY ID (for results inspection) ---
        "/debug/question/get": {
            OPTIONS: () => Res(null, { status: 204 }),
            GET: handler(async req => {
                await requireAdmin(req);
                const url = new URL(req.url);
                const id = url.searchParams.get('id');
                if (!id) throw new HttpError("Question ID required", 400);

                const { questions } = await db.getAllDebugQuestions();
                const question = questions?.find((q: any) => q.id === parseInt(id));
                if (!question) throw new HttpError("Question not found", 404);
                return Res(JSON.stringify({ result: question }));
            })
        },

        "/": Response.redirect("/login"),
    },

    async fetch(req, server) {
        const url = new URL(req.url);

        // Upgrade to WS
        if (url.searchParams.has("token")) {
            const token = url.searchParams.get("token") || "";
            const { payload, error } = await verifyJWT("Bearer " + token);
            if (!error && payload) {
                const wsData: WSData = {
                    role: payload.role as any,
                    id: (payload as any).id,
                    name: (payload as any).name
                };
                if (server.upgrade(req, { data: wsData })) {
                    return;
                }
            }
        }

        let pathname = url.pathname;

        if (pathname === "/") pathname = "/index.html";

        const file = resolveFile(pathname);

        if (file) {
            return Res(Bun.file(file));
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

class HttpError extends Error {
    status: number;
    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

async function notifySystemUpdate(id: number) {
    const { system } = await db.getSystemById(id);
    if (system) {
        wsManager.broadcastAdmins({ type: "system_updated", id, data: system });
        wsManager.sendToSystem(id, { type: "update", data: system });
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
        .setIssuedAt()
        .setExpirationTime("12h")
        .sign(secret);
}

async function requireAdmin(req: Request) {
    const auth = req.headers.get("Authorization");

    const { payload, error } = await verifyJWT(auth ?? "");
    if (error) throw new HttpError("Unauthorized", 401);

    if (typeof payload !== "object" || (payload.role !== "admin" && payload.role !== "superadmin"))
        throw new HttpError("Forbidden", 403);

    // Verify user exists in DB (Enforce immediate logout/delete effect)
    const { users } = await db.getUserById((payload as any).id);
    if (!users || users.length === 0) throw new HttpError("User no longer exists", 401);

    return users[0] as WithID<User>;
}

async function createToken(payload: any) {
    return signJWT(payload);
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