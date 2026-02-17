import type { User, WithID } from "./main";
import { SQL } from "bun";

const db = new SQL("sqlite://db.sqlite");

export async function initDB() {
    try {
        await db`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            role TEXT,
            year INTEGER,
            branch TEXT,
            college TEXT,
            phone TEXT,
            password TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        await db`CREATE TABLE IF NOT EXISTS systems (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            status TEXT DEFAULT 'offline',
            assigned_to INTEGER,
            login_otp TEXT,
            exam_type TEXT DEFAULT 'debug',
            assigned_level_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        await db`CREATE TABLE IF NOT EXISTS debug_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            code_snippet TEXT,
            difficulty TEXT,
            question_type TEXT DEFAULT 'full_edit',
            answer_meta TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        // Migration: add new columns if they don't exist
        try { await db`ALTER TABLE debug_questions ADD COLUMN question_type TEXT DEFAULT 'full_edit'`; } catch { }
        try { await db`ALTER TABLE debug_questions ADD COLUMN answer_meta TEXT`; } catch { }

        await db`CREATE TABLE IF NOT EXISTS debug_levels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            order_num INTEGER,
            question_ids TEXT,
            duration INTEGER DEFAULT 900,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        await db`CREATE TABLE IF NOT EXISTS typing_levels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            content TEXT,
            time_limit INTEGER,
            passing_accuracy INTEGER,
            attempts_allowed INTEGER,
            order_num INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        await db`CREATE TABLE IF NOT EXISTS exam_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            system_id INTEGER,
            exam_mode TEXT,
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_time DATETIME,
            score INTEGER,
            status TEXT DEFAULT 'ongoing'
        )`;

        await db`CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_session_id INTEGER,
            user_id INTEGER,
            system_code TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            log_type TEXT,
            data TEXT
        )`;

        // Check for default super admin
        const superAdmins = await db`SELECT * FROM users WHERE role = 'superadmin' LIMIT 1`;
        if (superAdmins.length === 0) {
            console.log("Creating default superadmin...");
            await db`INSERT INTO users (name, role, year, branch, college, phone, password)
                VALUES ('fayaz', 'superadmin', 0, 'ADMIN', 'ADMIN', '0000000000', 'bankai')`;
        }

    } catch (error) {
        if (error instanceof SQL.SQLiteError) {
            return { error: error.message }
        } else {
            return { error: "unexpected error while initializing database" };
        }
    }
}

export async function resetSystemsStatusOnStart() {
    try {
        await db`UPDATE systems SET status = 'offline' WHERE status != 'exam'`;
    } catch (e) {
        console.error("Failed to reset system statuses:", e);
    }
}

export async function createUser(user: User) {
    try {
        await db`INSERT INTO users (name, role, year, branch, college, phone, password)
            VALUES (${user.name}, ${user.role}, ${user.year}, ${user.branch}, ${user.college}, ${user.phone}, ${user.password})`;
        return {}
    } catch (error) {
        if (error instanceof SQL.SQLiteError) {
            return { error: error.message }
        } else {
            return { error: "unexpected error while creating user" };
        }
    }
}

export async function userExists(user: Partial<User>) {
    try {
        // If checking by name/phone/etc (login check usually)
        // Adjust logic if needed, but keeping original for now
        const users = await db`SELECT * FROM users WHERE
            name = ${user.name} AND year = ${user.year}
            AND branch = ${user.branch} AND college = ${user.college}
            AND phone = ${user.phone}
            `;
        if (users instanceof Array && users.length > 0) return { users };
        return { error: "User not found" };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getAllUsers(options: {
    limit?: number,
    offset?: number,
    college?: string,
    branch?: string,
    role?: string,
    search?: string
} = {}) {
    try {
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        const searchPattern = options.search ? `%${options.search}%` : null;

        // Note: Bun's SQL might not support complex dynamic queries easily with template tags if we want to conditionally add WHERE clauses.
        // Using the "OR IS NULL" pattern is a safe way to handle optional params in raw SQL.

        const users = (await db`SELECT * FROM users WHERE 
            (${options.college} IS NULL OR college = ${options.college}) AND
            (${options.branch} IS NULL OR branch = ${options.branch}) AND
            (${options.role} IS NULL OR role = ${options.role}) AND
            (${searchPattern} IS NULL OR (name LIKE ${searchPattern} OR phone LIKE ${searchPattern} OR college LIKE ${searchPattern} OR branch LIKE ${searchPattern}))
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `) as WithID<User>[];

        const countResult = await db`SELECT COUNT(*) as count FROM users WHERE 
            (${options.college} IS NULL OR college = ${options.college}) AND
            (${options.branch} IS NULL OR branch = ${options.branch}) AND
            (${options.role} IS NULL OR role = ${options.role}) AND
            (${searchPattern} IS NULL OR (name LIKE ${searchPattern} OR phone LIKE ${searchPattern} OR college LIKE ${searchPattern} OR branch LIKE ${searchPattern}))
        `;

        const total = countResult[0]?.count || 0;

        return { users, total };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getUniqueUserFields() {
    try {
        const colleges = await db`SELECT DISTINCT college FROM users WHERE college IS NOT NULL AND college != '' ORDER BY college`;
        const branches = await db`SELECT DISTINCT branch FROM users WHERE branch IS NOT NULL AND branch != '' ORDER BY branch`;
        return {
            colleges: colleges.map((c: any) => c.college),
            branches: branches.map((b: any) => b.branch)
        };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getUserById(id: number) {
    try {
        const users = (await db`SELECT * FROM users WHERE id = ${id}`) as WithID<User>[];
        return { users };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function deleteUserById(id: number) {
    try {
        const res = await db`DELETE FROM users WHERE id = ${id}`
        return { res }
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function updateUser(id: number, user: Partial<User>) {
    try {
        const res = await db`UPDATE users SET
            name = COALESCE(${user.name}, name),
            role = COALESCE(${user.role}, role),
            year = COALESCE(${user.year}, year),
            branch = COALESCE(${user.branch}, branch),
            college = COALESCE(${user.college}, college),
            phone = COALESCE(${user.phone}, phone)
            WHERE id = ${id}`;
        return { res };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

// --- SYSTEMS ---

export async function getAllSystems() {
    try {
        const systems = await db`
            SELECT s.*, u.name as assigned_to_name, dl.name as level_name, dl.duration as level_duration
            FROM systems s 
            LEFT JOIN users u ON s.assigned_to = u.id
            LEFT JOIN debug_levels dl ON s.assigned_level_id = dl.id
        `;
        return { systems };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function createSystem(data: any) {
    try {
        await db`INSERT INTO systems (code, status, exam_type) VALUES (${data.code}, ${data.status}, ${data.exam_type})`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function updateSystem(id: number, data: any) {
    try {
        await db`UPDATE systems SET 
            status = CASE WHEN ${data.status} IS NULL THEN status ELSE ${data.status} END,
            assigned_to = CASE WHEN ${data.assigned_to === undefined} THEN assigned_to ELSE ${data.assigned_to} END,
            login_otp = CASE WHEN ${data.login_otp === undefined} THEN login_otp ELSE ${data.login_otp} END,
            exam_type = CASE WHEN ${data.exam_type === undefined} THEN exam_type ELSE ${data.exam_type} END,
            assigned_level_id = CASE WHEN ${data.assigned_level_id === undefined} THEN assigned_level_id ELSE ${data.assigned_level_id} END
            WHERE id = ${id}`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function resetSystem(id: number, status: string) {
    try {
        await db`UPDATE systems SET 
            status = ${status},
            assigned_to = NULL,
            login_otp = NULL
            WHERE id = ${id}`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function deleteSystem(id: number) {
    try {
        await db`DELETE FROM systems WHERE id = ${id}`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function assignSystemToUserStrict(systemId: number, userId: number, otp: string, examType: string, levelId: number | null) {
    try {
        const systems = await db`UPDATE systems SET 
            status = 'booked',
            assigned_to = ${userId},
            login_otp = ${otp},
            exam_type = ${examType},
            assigned_level_id = ${levelId}
            WHERE id = ${systemId} AND (status = 'online' OR status = 'offline')
            RETURNING *`;

        if (systems.length === 0) {
            return { error: "System is already booked or offline" };
        }
        return { system: systems[0] };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function bulkUpdateSystems(ids: number[], data: any) {
    try {
        // We use a transaction or multiple updates if the driver/engine is tricky with sets of IDs and different values.
        // But for common values (exam_type, level), it's easy.
        // If data.generate_otp is true, we have to do it differently or in a loop.

        const status = data.status || null;
        const exam_type = data.exam_type || null;
        const assigned_level_id = data.assigned_level_id || null;
        const isReset = data.reset === true;
        const singleOtp = data.generate_otp ? Math.floor(10000 + Math.random() * 90000).toString() : null;

        for (const id of ids) {
            await db`UPDATE systems SET 
                status = COALESCE(${status}, status),
                login_otp = CASE 
                    WHEN ${singleOtp} IS NOT NULL THEN ${singleOtp}
                    WHEN ${isReset} = 1 OR ${isReset} = true THEN NULL
                    ELSE login_otp
                END,
                assigned_to = CASE 
                    WHEN ${isReset} = 1 OR ${isReset} = true THEN NULL 
                    ELSE assigned_to 
                END,
                exam_type = COALESCE(${exam_type}, exam_type),
                assigned_level_id = COALESCE(${assigned_level_id}, assigned_level_id)
                WHERE id = ${id} AND status != 'exam'`;
        }
        return { otp: singleOtp };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getSystemByCode(code: string) {
    try {
        const systems = await db`
            SELECT s.*, u.name as assigned_to_name 
            FROM systems s 
            LEFT JOIN users u ON s.assigned_to = u.id
            WHERE s.code = ${code}
        `;
        return { system: systems[0] };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function getSystemById(id: number) {
    try {
        const systems = await db`
            SELECT s.*, u.name as assigned_to_name 
            FROM systems s 
            LEFT JOIN users u ON s.assigned_to = u.id
            WHERE s.id = ${id}
        `;
        return { system: systems[0] };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

// --- DEBUG ---

export async function getAllDebugQuestions() {
    try {
        const questions = await db`SELECT * FROM debug_questions`;
        // Parse answer_meta JSON
        for (const q of questions) {
            try { if (q.answer_meta) q.answer_meta = JSON.parse(q.answer_meta); } catch { q.answer_meta = null; }
        }
        return { questions };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function createDebugQuestion(data: any) {
    try {
        const questionType = data.question_type || 'full_edit';
        const answerMeta = data.answer_meta ? JSON.stringify(data.answer_meta) : null;
        await db`INSERT INTO debug_questions (title, description, code_snippet, difficulty, question_type, answer_meta) 
            VALUES (${data.title}, ${data.description}, ${data.code_snippet}, ${data.difficulty}, ${questionType}, ${answerMeta})`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function updateDebugQuestion(id: number, data: any) {
    try {
        const questionType = data.question_type || 'full_edit';
        const answerMeta = data.answer_meta ? JSON.stringify(data.answer_meta) : null;
        await db`UPDATE debug_questions SET 
            title = ${data.title}, description = ${data.description}, 
            code_snippet = ${data.code_snippet}, difficulty = ${data.difficulty},
            question_type = ${questionType}, answer_meta = ${answerMeta}
            WHERE id = ${id}`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function deleteDebugQuestion(id: number) {
    try {
        await db`DELETE FROM debug_questions WHERE id = ${id}`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function getAllDebugLevels() {
    try {
        const levels = await db`SELECT * FROM debug_levels ORDER BY order_num`;
        // Parse question_ids
        for (const l of levels) {
            try { l.question_ids = JSON.parse(l.question_ids); } catch { l.question_ids = []; }
        }
        return { levels };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function createDebugLevel(data: any) {
    try {
        const qIds = JSON.stringify(data.question_ids || []);
        const duration = data.duration || 900;
        await db`INSERT INTO debug_levels (name, order_num, question_ids, duration) VALUES (${data.name}, ${data.order}, ${qIds}, ${duration})`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function updateDebugLevel(id: number, data: any) {
    try {
        const qIds = JSON.stringify(data.question_ids || []);
        const duration = data.duration || 900;
        await db`UPDATE debug_levels SET name = ${data.name}, order_num = ${data.order}, question_ids = ${qIds}, duration = ${duration} WHERE id = ${id}`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function getDebugLevelById(id: number) {
    try {
        const levels = await db`SELECT * FROM debug_levels WHERE id = ${id}`;
        if (levels.length > 0) {
            try { levels[0].question_ids = JSON.parse(levels[0].question_ids); } catch { levels[0].question_ids = []; }
        }
        return { level: levels[0] };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function deleteDebugLevel(id: number) {
    try {
        await db`DELETE FROM debug_levels WHERE id = ${id}`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

// --- TYPING ---

export async function getAllTypingLevels() {
    try {
        const levels = await db`SELECT * FROM typing_levels ORDER BY order_num`;
        return { levels };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function createTypingLevel(data: any) {
    try {
        const qIds = JSON.stringify(data.content || "");
        await db`INSERT INTO typing_levels (name, content, time_limit, passing_accuracy, attempts_allowed, order_num) 
            VALUES (${data.name}, ${data.content}, ${data.time_limit}, ${data.passing_accuracy}, ${data.attempts_allowed}, ${data.order})`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function updateTypingLevel(id: number, data: any) {
    try {
        await db`UPDATE typing_levels SET 
            name = ${data.name}, content = ${data.content}, time_limit = ${data.time_limit}, 
            passing_accuracy = ${data.passing_accuracy}, attempts_allowed = ${data.attempts_allowed}, order_num = ${data.order}
            WHERE id = ${id}`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function deleteTypingLevel(id: number) {
    try {
        await db`DELETE FROM typing_levels WHERE id = ${id}`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

// --- EXAM SESSIONS & LOGS ---

export async function createExamSession(data: { user_id: number, system_id: number, exam_mode: string }) {
    try {
        const session = await db`INSERT INTO exam_sessions (user_id, system_id, exam_mode, status) 
            VALUES (${data.user_id}, ${data.system_id}, ${data.exam_mode}, 'ongoing')
            RETURNING id`;
        return { id: session[0]?.id };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function updateExamSession(id: number, data: any) {
    try {
        await db`UPDATE exam_sessions SET 
            end_time = COALESCE(${data.end_time}, end_time),
            score = COALESCE(${data.score}, score),
            status = COALESCE(${data.status}, status)
            WHERE id = ${id}`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function createSystemLog(data: { exam_session_id: number, user_id: number, system_code: string, log_type: string, data: any }) {
    try {
        const logData = JSON.stringify(data.data);
        await db`INSERT INTO system_logs (exam_session_id, user_id, system_code, log_type, data) 
            VALUES (${data.exam_session_id}, ${data.user_id}, ${data.system_code}, ${data.log_type}, ${logData})`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

// --- RESULTS (STUBS) ---

export async function getTypingResults() {
    return { results: [] };
}

export async function getDebugResults() {
    return { results: [] };
}