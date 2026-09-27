import type { User, WithID } from "./main";
import { SQL } from "bun";

const db = new SQL("sqlite://db.sqlite");

export async function initDB() {
    try {
        await db`PRAGMA journal_mode = WAL;`;
        await db`PRAGMA busy_timeout = 5000;`;
        await db`PRAGMA synchronous = NORMAL;`;

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
            test_cases TEXT,
            language TEXT DEFAULT 'c',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;

        // Migration: add new columns if they don't exist
        try { await db`ALTER TABLE debug_questions ADD COLUMN question_type TEXT DEFAULT 'full_edit'`; } catch { }
        try { await db`ALTER TABLE debug_questions ADD COLUMN answer_meta TEXT`; } catch { }
        try { await db`ALTER TABLE debug_questions ADD COLUMN test_cases TEXT`; } catch { }
        try { await db`ALTER TABLE debug_questions ADD COLUMN language TEXT DEFAULT 'c'`; } catch { }
        try { await db`ALTER TABLE debug_questions ADD COLUMN set_name TEXT`; } catch { }

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

        await db`CREATE TABLE IF NOT EXISTS debug_submission_grades (
            session_id INTEGER,
            question_id INTEGER,
            is_correct BOOLEAN DEFAULT 0,
            PRIMARY KEY (session_id, question_id)
        )`;

        // Performance Indexes
        await db`CREATE INDEX IF NOT EXISTS idx_logs_session_type ON system_logs(exam_session_id, log_type)`;
        await db`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp)`;
        await db`CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON exam_sessions(user_id, status)`;
        await db`CREATE INDEX IF NOT EXISTS idx_systems_status ON systems(status)`;
        await db`CREATE INDEX IF NOT EXISTS idx_users_role_name ON users(role, name)`;

        // Check for default super admin
        const superAdmins = await db`SELECT * FROM users WHERE role = 'superadmin' LIMIT 1`;
        if (superAdmins.length === 0) {
            console.log("Creating default superadmin...");
            const hashedPassword = await Bun.password.hash("bankai", { algorithm: "argon2id" });
            await db`INSERT INTO users (name, role, year, branch, college, phone, password)
                VALUES ('fayaz', 'superadmin', 0, 'ADMIN', 'ADMIN', '0000000000', ${hashedPassword})`;
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
        let pass = user.password;
        if (pass && !pass.startsWith("$argon2id$")) {
            pass = await Bun.password.hash(pass, { algorithm: "argon2id" });
        }
        await db`INSERT INTO users (name, role, year, branch, college, phone, password)
            VALUES (${user.name}, ${user.role}, ${user.year}, ${user.branch}, ${user.college}, ${user.phone}, ${pass})`;
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

        const users = (await db`SELECT id, name, role, year, branch, college, phone, created_at FROM users WHERE 
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

export async function getUserAuth(name: string) {
    try {
        const users = (await db`SELECT id, name, role, year, branch, college, phone, password FROM users WHERE name = ${name}`) as (WithID<User> & { password?: string })[];
        return { user: users[0] || null };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error", user: null };
    }
}

export async function updateUserPassword(id: number, passwordHash: string) {
    try {
        await db`UPDATE users SET password = ${passwordHash} WHERE id = ${id}`;
        return { success: true };
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
        const users = (await db`SELECT id, name, role, year, branch, college, phone, created_at FROM users WHERE id = ${id}`) as WithID<User>[];
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

export async function getStudentQuestions(levelId?: number | null) {
    try {
        if (levelId) {
            const { level } = await getDebugLevelById(levelId);
            if (level && Array.isArray(level.question_ids) && level.question_ids.length > 0) {
                const allQ = await db`SELECT id, title, description, code_snippet, difficulty, question_type, language, set_name FROM debug_questions`;
                const idSet = new Set(level.question_ids);
                const questions = allQ.filter((q: any) => idSet.has(q.id));
                return { questions };
            }
        }
        const questions = await db`SELECT id, title, description, code_snippet, difficulty, question_type, language, set_name FROM debug_questions`;
        return { questions };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function getAllDebugQuestions() {
    try {
        const questions = await db`SELECT * FROM debug_questions`;
        // Parse answer_meta JSON
        for (const q of questions) {
            try { if (q.answer_meta) q.answer_meta = JSON.parse(q.answer_meta); } catch { q.answer_meta = null; }
            try { if (q.test_cases) q.test_cases = JSON.parse(q.test_cases); } catch { q.test_cases = []; }
        }
        return { questions };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function createDebugQuestion(data: any) {
    try {
        const questionType = data.question_type || 'full_edit';
        const answerMeta = data.answer_meta ? JSON.stringify(data.answer_meta) : null;
        const testCases = data.test_cases ? JSON.stringify(data.test_cases) : null;
        const language = data.language || 'c';
        const setName = data.set_name || null;
        await db`INSERT INTO debug_questions (title, description, code_snippet, difficulty, question_type, answer_meta, test_cases, language, set_name) 
            VALUES (${data.title}, ${data.description}, ${data.code_snippet}, ${data.difficulty}, ${questionType}, ${answerMeta}, ${testCases}, ${language}, ${setName})`;
        return {};
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function updateDebugQuestion(id: number, data: any) {
    try {
        const questionType = data.question_type || 'full_edit';
        const answerMeta = data.answer_meta ? JSON.stringify(data.answer_meta) : null;
        const testCases = data.test_cases ? JSON.stringify(data.test_cases) : null;
        const language = data.language || 'c';
        const setName = data.set_name !== undefined ? data.set_name : null;
        await db`UPDATE debug_questions SET 
            title = ${data.title}, description = ${data.description}, 
            code_snippet = ${data.code_snippet}, difficulty = ${data.difficulty},
            question_type = ${questionType}, answer_meta = ${answerMeta},
            test_cases = ${testCases}, language = ${language}, set_name = ${setName}
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

export async function getDebugQuestionById(id: number) {
    try {
        const questions = await db`SELECT * FROM debug_questions WHERE id = ${id}`;
        if (questions.length > 0) {
            const q = questions[0];
            try { if (q.answer_meta) q.answer_meta = JSON.parse(q.answer_meta); } catch { q.answer_meta = null; }
            try { if (q.test_cases) q.test_cases = JSON.parse(q.test_cases); } catch { q.test_cases = []; }
        }
        return { question: questions[0] };
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

export async function getTypingLevelById(id: number) {
    try {
        const levels = await db`SELECT * FROM typing_levels WHERE id = ${id}`;
        return { level: levels[0] };
    } catch (error) { return { error: error instanceof Error ? error.message : "Unknown error" }; }
}

export async function getTypingResults(options: {
    college?: string,
    branch?: string,
    year?: number,
    level_id?: number,
    status?: string
} = {}) {
    const college = options.college ?? null;
    const branch = options.branch ?? null;
    const year = options.year ?? null;
    const levelId = options.level_id ?? null;
    const status = options.status ?? null;

    try {
        // Get all typing exam sessions
        const sessions = await db`SELECT es.*, 
            u.name as user_name, u.branch, u.college, u.year as user_year, u.phone,
            s.code as system_code, s.assigned_level_id, s.exam_type,
            tl.name as level_name
            FROM exam_sessions es
            LEFT JOIN users u ON es.user_id = u.id
            LEFT JOIN systems s ON es.system_id = s.id
            LEFT JOIN typing_levels tl ON s.assigned_level_id = tl.id
            WHERE es.exam_mode = 'typing' AND
                (${college} IS NULL OR u.college = ${college}) AND
                (${branch} IS NULL OR u.branch = ${branch}) AND
                (${year} IS NULL OR u.year = ${year}) AND
                (${levelId} IS NULL OR s.assigned_level_id = ${levelId}) AND
                (${status} IS NULL OR es.status = ${status})
            ORDER BY es.start_time DESC
        `;

        if (sessions.length === 0) return { results: [] };

        const allLogs = await db`SELECT * FROM system_logs 
            WHERE exam_session_id IN (
                SELECT es.id FROM exam_sessions es
                LEFT JOIN users u ON es.user_id = u.id
                LEFT JOIN systems s ON es.system_id = s.id
                WHERE es.exam_mode = 'typing' AND
                    (${college} IS NULL OR u.college = ${college}) AND
                    (${branch} IS NULL OR u.branch = ${branch}) AND
                    (${year} IS NULL OR u.year = ${year}) AND
                    (${levelId} IS NULL OR s.assigned_level_id = ${levelId}) AND
                    (${status} IS NULL OR es.status = ${status})
            ) 
            AND log_type = 'TYPING_RESULT'
            ORDER BY timestamp ASC`;

        const logsBySession = new Map<number, any[]>();
        for (const log of allLogs) {
            if (!logsBySession.has(log.exam_session_id)) {
                logsBySession.set(log.exam_session_id, []);
            }
            logsBySession.get(log.exam_session_id)!.push(log);
        }

        const results: any[] = [];

        for (const session of sessions) {
            // Get TYPING_RESULT logs for this session
            const logs = logsBySession.get(session.id) || [];

            const attempts: any[] = [];
            let bestWpm = 0;
            let bestAccuracy = 0;
            let anyPassed = false;

            for (const log of logs) {
                let data: any = {};
                try { data = typeof log.data === 'string' ? JSON.parse(log.data) : (log.data || {}); } catch { }

                const attempt = {
                    attempt_num: data.attempt || attempts.length + 1,
                    wpm: data.wpm || 0,
                    raw_wpm: data.raw_wpm || 0,
                    accuracy: data.accuracy || 0,
                    consistency: data.consistency || 0,
                    correct_chars: data.correct_chars || 0,
                    incorrect_chars: data.incorrect_chars || 0,
                    extra_chars: data.extra_chars || 0,
                    missed_chars: data.missed_chars || 0,
                    time_elapsed: data.time_elapsed || 0,
                    time_limit: data.time_limit || 0,
                    words_completed: data.words_completed || 0,
                    passed: data.passed || false,
                    wpm_history: data.wpm_history || [],
                    timestamp: data.timestamp || log.timestamp
                };

                if (attempt.wpm > bestWpm) bestWpm = attempt.wpm;
                if (attempt.accuracy > bestAccuracy) bestAccuracy = attempt.accuracy;
                if (attempt.passed) anyPassed = true;

                attempts.push(attempt);
            }

            results.push({
                session_id: session.id,
                user_id: session.user_id,
                user_name: session.user_name,
                branch: session.branch,
                college: session.college,
                year: session.user_year,
                phone: session.phone,
                system_code: session.system_code,
                level_name: (session as any).level_name || 'N/A',
                status: session.status,
                start_time: session.start_time,
                end_time: session.end_time,
                attempts,
                best_wpm: bestWpm,
                best_accuracy: bestAccuracy,
                passed: anyPassed,
                total_attempts: attempts.length
            });
        }

        return { results };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
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

// --- LOGS ---

export async function getAllLogs(options: {
    limit?: number,
    offset?: number,
    log_type?: string,
    session_id?: number,
    user_id?: number,
    system_code?: string,
    search?: string
} = {}) {
    try {
        const limit = options.limit || 100;
        const offset = options.offset || 0;
        const searchPattern = options.search ? `%${options.search}%` : null;

        const logs = await db`SELECT sl.*, u.name as user_name, u.branch, u.college, u.year
            FROM system_logs sl
            LEFT JOIN users u ON sl.user_id = u.id
            WHERE
                (${options.log_type} IS NULL OR sl.log_type = ${options.log_type}) AND
                (${options.session_id} IS NULL OR sl.exam_session_id = ${options.session_id}) AND
                (${options.user_id} IS NULL OR sl.user_id = ${options.user_id}) AND
                (${options.system_code} IS NULL OR sl.system_code = ${options.system_code}) AND
                (${searchPattern} IS NULL OR (u.name LIKE ${searchPattern} OR sl.system_code LIKE ${searchPattern} OR sl.log_type LIKE ${searchPattern}))
            ORDER BY sl.timestamp DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const countResult = await db`SELECT COUNT(*) as count FROM system_logs sl
            LEFT JOIN users u ON sl.user_id = u.id
            WHERE
                (${options.log_type} IS NULL OR sl.log_type = ${options.log_type}) AND
                (${options.session_id} IS NULL OR sl.exam_session_id = ${options.session_id}) AND
                (${options.user_id} IS NULL OR sl.user_id = ${options.user_id}) AND
                (${options.system_code} IS NULL OR sl.system_code = ${options.system_code}) AND
                (${searchPattern} IS NULL OR (u.name LIKE ${searchPattern} OR sl.system_code LIKE ${searchPattern} OR sl.log_type LIKE ${searchPattern}))
        `;

        // Parse data JSON for each log
        for (const log of logs) {
            try { if (log.data && typeof log.data === 'string') log.data = JSON.parse(log.data); } catch { }
        }

        return { logs, total: countResult[0]?.count || 0 };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getLogTypes() {
    try {
        const types = await db`SELECT DISTINCT log_type FROM system_logs WHERE log_type IS NOT NULL ORDER BY log_type`;
        return { types: types.map((t: any) => t.log_type) };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function batchCreateLogs(logs: Array<{ exam_session_id: number, user_id: number, system_code: string, log_type: string, data: any, timestamp?: string }>) {
    try {
        let created = 0;
        for (const log of logs) {
            const logData = typeof log.data === 'string' ? log.data : JSON.stringify(log.data);
            const ts = log.timestamp || new Date().toISOString();
            await db`INSERT INTO system_logs (exam_session_id, user_id, system_code, log_type, data, timestamp)
                VALUES (${log.exam_session_id}, ${log.user_id}, ${log.system_code}, ${log.log_type}, ${logData}, ${ts})`;
            created++;
        }
        return { created };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

// --- EXAM SESSIONS (Enhanced) ---

export async function getAllExamSessions(options: {
    limit?: number,
    offset?: number,
    exam_mode?: string,
    status?: string,
    user_id?: number,
    search?: string
} = {}) {
    try {
        const limit = options.limit || 100;
        const offset = options.offset || 0;
        const searchPattern = options.search ? `%${options.search}%` : null;

        const sessions = await db`SELECT es.*, 
            u.name as user_name, u.branch, u.college, u.year as user_year, u.phone,
            s.code as system_code
            FROM exam_sessions es
            LEFT JOIN users u ON es.user_id = u.id
            LEFT JOIN systems s ON es.system_id = s.id
            WHERE
                (${options.exam_mode} IS NULL OR es.exam_mode = ${options.exam_mode}) AND
                (${options.status} IS NULL OR es.status = ${options.status}) AND
                (${options.user_id} IS NULL OR es.user_id = ${options.user_id}) AND
                (${searchPattern} IS NULL OR (u.name LIKE ${searchPattern} OR s.code LIKE ${searchPattern}))
            ORDER BY es.start_time DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const countResult = await db`SELECT COUNT(*) as count FROM exam_sessions es
            LEFT JOIN users u ON es.user_id = u.id
            LEFT JOIN systems s ON es.system_id = s.id
            WHERE
                (${options.exam_mode} IS NULL OR es.exam_mode = ${options.exam_mode}) AND
                (${options.status} IS NULL OR es.status = ${options.status}) AND
                (${options.user_id} IS NULL OR es.user_id = ${options.user_id}) AND
                (${searchPattern} IS NULL OR (u.name LIKE ${searchPattern} OR s.code LIKE ${searchPattern}))
        `;

        return { sessions, total: countResult[0]?.count || 0 };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getExamSessionById(id: number) {
    try {
        const sessions = await db`SELECT es.*, 
            u.name as user_name, u.branch, u.college, u.year as user_year, u.phone,
            s.code as system_code
            FROM exam_sessions es
            LEFT JOIN users u ON es.user_id = u.id
            LEFT JOIN systems s ON es.system_id = s.id
            WHERE es.id = ${id}
        `;
        return { session: sessions[0] };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getSessionLogs(sessionId: number) {
    try {
        const logs = await db`SELECT * FROM system_logs WHERE exam_session_id = ${sessionId} ORDER BY timestamp ASC`;
        for (const log of logs) {
            try { if (log.data && typeof log.data === 'string') log.data = JSON.parse(log.data); } catch { }
        }
        return { logs };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

// --- RESULTS (from logs) ---

export async function getExamResults(options: {
    exam_mode?: string,
    college?: string,
    branch?: string,
    year?: number,
    level_id?: number
} = {}) {
    const examMode = options.exam_mode ?? null;
    const college = options.college ?? null;
    const branch = options.branch ?? null;
    const year = options.year ?? null;
    const levelId = options.level_id ?? null;

    try {
        // Get all completed exam sessions with user info
        const sessions = await db`SELECT es.*, 
            u.name as user_name, u.branch, u.college, u.year as user_year, u.phone,
            s.code as system_code, s.assigned_level_id, s.exam_type,
            dl.name as level_name
            FROM exam_sessions es
            LEFT JOIN users u ON es.user_id = u.id
            LEFT JOIN systems s ON es.system_id = s.id
            LEFT JOIN debug_levels dl ON s.assigned_level_id = dl.id
            WHERE
                (${examMode} IS NULL OR es.exam_mode = ${examMode}) AND
                (${college} IS NULL OR u.college = ${college}) AND
                (${branch} IS NULL OR u.branch = ${branch}) AND
                (${year} IS NULL OR u.year = ${year}) AND
                (${levelId} IS NULL OR s.assigned_level_id = ${levelId})
            ORDER BY es.start_time DESC
        `;

        if (sessions.length === 0) return { results: [], error: null };

        // Get all submission grades using the same filters via subquery to avoid array expansion issues
        const allGrades = await db`SELECT g.* FROM debug_submission_grades g
            WHERE g.session_id IN (
                SELECT es.id FROM exam_sessions es
                LEFT JOIN users u ON es.user_id = u.id
                LEFT JOIN systems s ON es.system_id = s.id
                WHERE
                    (${examMode} IS NULL OR es.exam_mode = ${examMode}) AND
                    (${college} IS NULL OR u.college = ${college}) AND
                    (${branch} IS NULL OR u.branch = ${branch}) AND
                    (${year} IS NULL OR u.year = ${year}) AND
                    (${levelId} IS NULL OR s.assigned_level_id = ${levelId})
            )`;
        const gradesMap = new Map<number, Map<number, boolean>>();
        allGrades.forEach((g: any) => {
            if (!gradesMap.has(g.session_id)) gradesMap.set(g.session_id, new Map());
            gradesMap.get(g.session_id)!.set(g.question_id, g.is_correct === 1);
        });

        // Get all questions to have difficulty info
        const { questions } = await getAllDebugQuestions();
        const questionMap = new Map<number, any>((questions || []).map((q: any) => [q.id, q]));

        // For each session, get submission logs to compute results
        const results: any[] = [];
        for (const session of sessions) {
            const logs = await db`SELECT * FROM system_logs 
                WHERE exam_session_id = ${session.id} 
                AND (log_type = 'SUBMIT' OR log_type = 'AUTO_SUBMIT_TIMEOUT' OR log_type = 'AUTO_SUBMIT_FINAL' OR log_type = 'EXAM_START' OR log_type = 'EXAM_FINISH' OR log_type = 'DISQUALIFIED')
                ORDER BY timestamp ASC`;

            let submitted = 0;
            let autoSubmitted = 0;
            let startTime: string | null = null;
            let endTime: string | null = null;
            let disqualified = false;
            let totalScore = 0;
            const submissions: any[] = [];
            const sessionGradesMap = gradesMap.get(session.id) || new Map();

            for (const log of logs) {
                let data: any = {};
                try { data = typeof log.data === 'string' ? JSON.parse(log.data) : (log.data || {}); } catch { }

                if (log.log_type === 'EXAM_START') {
                    startTime = data.timestamp || log.timestamp;
                } else if (log.log_type === 'EXAM_FINISH') {
                    endTime = data.timestamp || log.timestamp;
                } else if (log.log_type === 'DISQUALIFIED') {
                    disqualified = true;
                    endTime = data.timestamp || log.timestamp;
                } else if (log.log_type === 'SUBMIT' || log.log_type === 'AUTO_SUBMIT_TIMEOUT' || log.log_type === 'AUTO_SUBMIT_FINAL') {
                    const isAuto = log.log_type !== 'SUBMIT';
                    if (isAuto) autoSubmitted++; else submitted++;

                    const qId = data.question_id;
                    const qInfo = questionMap.get(qId);
                    const isCorrect = sessionGradesMap.get(qId) || false;

                    // Difficulty Points: Easy=5, Medium=10, Hard=15
                    if (isCorrect && qInfo) {
                        const difficulty = qInfo.difficulty?.toLowerCase();
                        if (difficulty === 'easy') totalScore += 5;
                        else if (difficulty === 'medium') totalScore += 10;
                        else if (difficulty === 'hard') totalScore += 15;
                        else totalScore += 5; // Default for others
                    }

                    submissions.push({
                        question_id: qId,
                        question_title: data.question_title || qInfo?.title,
                        answer: data.answer,
                        question_type: data.question_type || qInfo?.question_type,
                        marked_lines: data.marked_lines,
                        added_lines: data.added_lines,
                        timestamp: data.timestamp || log.timestamp,
                        auto: isAuto,
                        reason: data.reason,
                        is_correct: isCorrect,
                        difficulty: qInfo?.difficulty
                    });
                }
            }

            results.push({
                session_id: session.id,
                user_id: session.user_id,
                user_name: session.user_name,
                branch: session.branch,
                college: session.college,
                year: session.user_year,
                phone: session.phone,
                system_code: session.system_code,
                exam_mode: session.exam_mode,
                level_name: session.level_name || 'N/A',
                level_id: session.assigned_level_id,
                status: session.status,
                start_time: startTime || session.start_time,
                end_time: endTime || session.end_time,
                submitted,
                auto_submitted: autoSubmitted,
                total_questions: submitted + autoSubmitted,
                disqualified,
                submissions,
                total_score: totalScore
            });
        }

        return { results };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function gradeSubmission(sessionId: number, questionId: number, isCorrect: boolean) {
    try {
        const val = isCorrect ? 1 : 0;
        await db`INSERT INTO debug_submission_grades (session_id, question_id, is_correct)
            VALUES (${sessionId}, ${questionId}, ${val})
            ON CONFLICT(session_id, question_id) 
            DO UPDATE SET is_correct = ${val}`;

        // Localized score update for this session only (no global DB scan)
        await db`UPDATE exam_sessions SET score = (
            SELECT COALESCE(SUM(CASE WHEN is_correct = 1 THEN 10 ELSE 0 END), 0)
            FROM debug_submission_grades WHERE session_id = ${sessionId}
        ) WHERE id = ${sessionId}`;

        return { success: true };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getResultGroupOptions() {
    try {
        const colleges = await db`SELECT DISTINCT u.college FROM exam_sessions es LEFT JOIN users u ON es.user_id = u.id WHERE u.college IS NOT NULL AND u.college != '' ORDER BY u.college`;
        const branches = await db`SELECT DISTINCT u.branch FROM exam_sessions es LEFT JOIN users u ON es.user_id = u.id WHERE u.branch IS NOT NULL AND u.branch != '' ORDER BY u.branch`;
        const years = await db`SELECT DISTINCT u.year FROM exam_sessions es LEFT JOIN users u ON es.user_id = u.id WHERE u.year IS NOT NULL ORDER BY u.year`;
        const levels = await db`SELECT DISTINCT dl.id, dl.name FROM exam_sessions es LEFT JOIN systems s ON es.system_id = s.id LEFT JOIN debug_levels dl ON s.assigned_level_id = dl.id WHERE dl.id IS NOT NULL ORDER BY dl.name`;
        const modes = await db`SELECT DISTINCT exam_mode FROM exam_sessions WHERE exam_mode IS NOT NULL ORDER BY exam_mode`;

        return {
            colleges: colleges.map((c: any) => c.college),
            branches: branches.map((b: any) => b.branch),
            years: years.map((y: any) => y.year),
            levels: levels.map((l: any) => ({ id: l.id, name: l.name })),
            modes: modes.map((m: any) => m.exam_mode)
        };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getTypingResultGroupOptions() {
    try {
        const colleges = await db`SELECT DISTINCT u.college FROM exam_sessions es LEFT JOIN users u ON es.user_id = u.id WHERE es.exam_mode = 'typing' AND u.college IS NOT NULL AND u.college != '' ORDER BY u.college`;
        const branches = await db`SELECT DISTINCT u.branch FROM exam_sessions es LEFT JOIN users u ON es.user_id = u.id WHERE es.exam_mode = 'typing' AND u.branch IS NOT NULL AND u.branch != '' ORDER BY u.branch`;
        const years = await db`SELECT DISTINCT u.year FROM exam_sessions es LEFT JOIN users u ON es.user_id = u.id WHERE es.exam_mode = 'typing' AND u.year IS NOT NULL ORDER BY u.year`;
        const levels = await db`SELECT DISTINCT tl.id, tl.name FROM exam_sessions es LEFT JOIN systems s ON es.system_id = s.id LEFT JOIN typing_levels tl ON s.assigned_level_id = tl.id WHERE es.exam_mode = 'typing' AND tl.id IS NOT NULL ORDER BY tl.name`;

        return {
            colleges: colleges.map((c: any) => c.college),
            branches: branches.map((b: any) => b.branch),
            years: years.map((y: any) => y.year),
            levels: levels.map((l: any) => ({ id: l.id, name: l.name }))
        };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}