const INSFORGE_API = 'https://iznwab88.us-east.insforge.app/api/auth';
const ADMIN_EMAIL = 'admin@richasharma.com'; // Hardcoded admin email for demo

async function loginWithPassword(email, password) {
    const res = await fetch(`${INSFORGE_API}/sessions?client_type=mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Login failed');
    if (data.requireEmailVerification) throw new Error('Email verification required. Please check dashboard settings.');

    saveSession(data);
    return data;
}

async function signupUser(email, password, name) {
    const res = await fetch(`${INSFORGE_API}/users?client_type=mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Signup failed');
    if (data.requireEmailVerification) throw new Error('Signup successful, but email verification is required by the server.');

    saveSession(data);

    // Auto-create profile in the public schema
    if (data.user && data.accessToken) {
        try {
            await fetch('https://iznwab88.us-east.insforge.app/api/database/records/profiles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.accessToken}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify([{ id: data.user.id, email: data.user.email, name: name }])
            });
        } catch (e) {
            console.error("Could not auto-create profile:", e);
        }
    }

    return data;
}

function saveSession(data) {
    if (data.accessToken) {
        localStorage.setItem('auth_token', data.accessToken);
        localStorage.setItem('auth_refresh', data.refreshToken);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
    }
}

function logoutUser() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_refresh');
    localStorage.removeItem('auth_user');
    window.location.reload();
}

function getCurrentUser() {
    const userStr = localStorage.getItem('auth_user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

function isAdmin() {
    const user = getCurrentUser();
    // Assuming the first registered user or a specific email is the admin
    return user && user.email === ADMIN_EMAIL;
}

// Ensure the UI updates based on login state when the script loads
document.addEventListener("DOMContentLoaded", () => {
    updateUIForAuth();
});

function updateUIForAuth() {
    const user = getCurrentUser();
    const isUserAdmin = isAdmin();

    // 1. Navbar Updates
    const adminNav = document.getElementById('adminNav');
    if (adminNav) {
        adminNav.style.display = isUserAdmin ? 'block' : 'none';
    }

    const authButtonsContainer = document.querySelector('.auth-buttons');
    if (authButtonsContainer) {
        if (user) {
            authButtonsContainer.innerHTML = `
                <span style="color: var(--text-secondary); margin-right: 15px; font-size: 0.9rem;">
                    Hi, ${user.email.split('@')[0]}
                </span>
                <button class="neon-btn" onclick="logoutUser()" style="padding: 8px 15px; font-size: 0.9rem;">Logout</button>
            `;
        } else {
            // Unauthenticated state
            authButtonsContainer.innerHTML = `
                <button class="neon-btn" onclick="openAuthModal()" style="padding: 8px 15px; font-size: 0.9rem;">Login / Sign Up</button>
                <a href="login.html" style="margin-left: 15px; font-size: 0.85rem; color: var(--text-secondary); text-decoration: none;">Admin</a>
            `;
        }
    }

    // 2. Comments Section Updates (in story.html)
    const newCommentForm = document.getElementById('newCommentForm');
    const loginPrompt = document.getElementById('loginToCommentPrompt');
    if (newCommentForm && loginPrompt) {
        if (user) {
            newCommentForm.style.display = 'flex';
            loginPrompt.style.display = 'none';
            // Pre-fill user name if possible
            const nameInput = newCommentForm.querySelector('input[type="text"]');
            if (nameInput) {
                nameInput.value = user.name || user.email.split('@')[0];
                nameInput.readOnly = true;
                nameInput.style.opacity = '0.7';
            }
        } else {
            newCommentForm.style.display = 'none';
            loginPrompt.style.display = 'block';
        }
    }
}

// Modal Logic
function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'flex';
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
}

async function handleUserAuth(e, isLogin) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;
    const errorDiv = document.getElementById('authError');
    const submitBtn = form.querySelector('button[type="submit"]');

    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerText = 'Processing...';

    try {
        if (isLogin) {
            await loginWithPassword(email, password);
        } else {
            const name = form.querySelector('input[type="text"]').value;
            await signupUser(email, password, name);
            // Auto login after signup might not work if verification is required, but SDK handles that if verified.
        }
        closeAuthModal();
        window.location.reload();
    } catch (err) {
        errorDiv.innerText = err.message;
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerText = isLogin ? 'Login' : 'Sign Up';
    }
}

function toggleAuthMode() {
    const loginForm = document.getElementById('loginFormContent');
    const signupForm = document.getElementById('signupFormContent');
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'flex';
        signupForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'flex';
    }
}
