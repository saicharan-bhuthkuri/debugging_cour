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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        await db`CREATE TABLE IF NOT EXISTS debug_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            code_snippet TEXT,
            difficulty TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        await db`CREATE TABLE IF NOT EXISTS debug_levels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            order_num INTEGER,
            question_ids TEXT, 
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

        await db`CREATE TABLE IF NOT EXISTS typing_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            level_id INTEGER,
            wpm REAL,
            accuracy REAL,
            duration INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        await db`CREATE TABLE IF NOT EXISTS debug_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            level_id INTEGER,
            score INTEGER,
            total INTEGER,
            status TEXT,
            time_taken INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            SELECT s.*, u.name as assigned_to_name 
            FROM systems s 
            LEFT JOIN users u ON s.assigned_to = u.id
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
            status = COALESCE(${data.status}, status),
            assigned_to = COALESCE(${data.assigned_to}, assigned_to),
            login_otp = COALESCE(${data.login_otp}, login_otp),
            exam_type = COALESCE(${data.exam_type}, exam_type)
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

export async function getSystemByCode(code: string) {
    try {
        const systems = await db`SELECT * FROM systems WHERE code = ${code}`;
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
        return { questions };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function createDebugQuestion(data: any) {
    try {
        await db`INSERT INTO debug_questions (title, description, code_snippet, difficulty) 
            VALUES (${data.title}, ${data.description}, ${data.code_snippet}, ${data.difficulty})`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function updateDebugQuestion(id: number, data: any) {
    try {
        await db`UPDATE debug_questions SET 
            title = ${data.title}, description = ${data.description}, 
            code_snippet = ${data.code_snippet}, difficulty = ${data.difficulty} 
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
        await db`INSERT INTO debug_levels (name, order_num, question_ids) VALUES (${data.name}, ${data.order}, ${qIds})`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function updateDebugLevel(id: number, data: any) {
    try {
        const qIds = JSON.stringify(data.question_ids || []);
        await db`UPDATE debug_levels SET name = ${data.name}, order_num = ${data.order}, question_ids = ${qIds} WHERE id = ${id}`;
        return {};
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

// --- RESULTS ---

export async function getTypingResults() {
    try {
        const results = await db`
            SELECT r.*, u.name as user_name, l.name as level_name
            FROM typing_results r
            JOIN users u ON r.user_id = u.id
            JOIN typing_levels l ON r.level_id = l.id
            ORDER BY r.created_at DESC
        `;
        return { results };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function getDebugResults() {
    try {
        const results = await db`
            SELECT r.*, u.name as user_name, l.name as level_name
            FROM debug_results r
            JOIN users u ON r.user_id = u.id
            JOIN debug_levels l ON r.level_id = l.id
            ORDER BY r.created_at DESC
        `;
        return { results };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}