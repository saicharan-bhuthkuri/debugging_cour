export interface User {
    name: string;
    role: "member" | "lead" | "admin";
    year: number;
    branch: string;
    college: string;
    phone: string;
}

