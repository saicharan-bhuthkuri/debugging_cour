let loginStatus = $state(false);
let token = $state("");

export function getLoginStatus() {
    return loginStatus;
}

export function getToken() {
    return token;
}

export function setToken(token_val: string | null) {
    loginStatus = token_val ? true : false;
    if (token_val) {
        token = token_val;
        localStorage.setItem('isLoggedin', 'true');
        localStorage.setItem('login_token', token_val);
    } else {
        token = "";
        localStorage.setItem('isLoggedin', 'false');
        localStorage.removeItem('login_token');
    }
}

export function initAuth() {
    loginStatus = localStorage.getItem('isLoggedin') === 'true';
    token = localStorage.getItem('login_token') ?? "";
}
