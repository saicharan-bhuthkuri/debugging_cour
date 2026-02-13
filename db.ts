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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;
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
        await db`INSERT INTO users (name, role, year, branch, college, phone)
            VALUES (${user.name}, ${user.role}, ${user.year}, ${user.branch}, ${user.college}, ${user.phone})`;
        return {}
    } catch (error) {
        if (error instanceof SQL.SQLiteError) {
            return { error: error.message }
        } else {
            return { error: "unexpected error while creating user" };
        }
    }
}

export async function getUser(user: User) {
    try {
        const users = await db`SELECT * FROM users WHERE
            name = ${user.name} AND year = ${user.year}
            AND branch = ${user.branch} AND college = ${user.college}
            AND phone = ${user.phone}
            `;
        if (users instanceof Array && users.length > 0) return { users };
        return { error: "User not found" };
    } catch (error) {
        if (error instanceof SQL.SQLiteError) {
            return { error: error.message }
        } else {
            return { error: "unexpected error while getting id" };
        }
    }
}

export async function getAllUsers() {
    try {
        const users = (await db`SELECT * FROM users`) as WithID<User>[];
        return { users };
    } catch (error) {
        if (error instanceof SQL.SQLiteError) {
            return { error: error.message }
        } else {
            return { error: "unexpected error while getting users" };
        }
    }
}
