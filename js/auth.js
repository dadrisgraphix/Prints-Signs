// js/auth.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('error-message');

    // Check if user is already logged in
    checkExistingSession();

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // This looks for either "email" or "login-username" to prevent the "null" error
        const usernameInput = document.getElementById('email') || document.getElementById('login-username');
        const passwordInput = document.getElementById('password') || document.getElementById('login-password');

        if (!usernameInput || !passwordInput) {
            console.error("Could not find the input fields. Check your HTML IDs.");
            return;
        }

        const rawUsername = usernameInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        // If the user types "davy", this turns it into the hidden email we used to create the account
        let loginEmail = rawUsername;
        if (!rawUsername.includes('@')) {
            const safeUsername = rawUsername.replace(/[^a-z0-9]/g, '');
            loginEmail = `${safeUsername}@dadrisprints.local`;
        }

        // UI Loading State
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';
        errorMessage.classList.add('hidden');

        try {
            // 1. Authenticate with Supabase
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: password,
            });

            if (authError) throw authError;

            // 2. Fetch User Profile to get their Role
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('role, branch_id')
                .eq('id', authData.user.id)
                .single();

            if (profileError) throw new Error('Could not find user profile. Contact Admin.');

            // 3. Route based on role
            routeUser(profileData.role);

        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    });

    async function checkExistingSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
            if (profile) routeUser(profile.role);
        }
    }

    function routeUser(role) {
        const userRole = (role || '').toUpperCase();
        if (userRole === 'OWNER' || userRole === 'ADMIN') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'branch.html';
        }
    }
});