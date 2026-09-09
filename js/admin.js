// ==========================================
// ADMIN DASHBOARD LOGIC
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    // Load initial data for the dashboard
    loadDashboardStats();
    loadAdminPayments();
});

// UI: Navigation & View Switching
function toggleView(viewId, btnElement) {
    // 1. Hide all views
    document.querySelectorAll('.view-section').forEach(el => {
        el.classList.remove('block');
        el.classList.add('hidden');
    });
    
    // 2. Show the target view
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('block');
    }

    // 3. Reset all sidebar buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-gray-800', 'border-green-500');
        btn.classList.add('border-transparent');
    });

    // 4. Highlight active button
    if (btnElement) {
        btnElement.classList.remove('border-transparent');
        btnElement.classList.add('bg-gray-800', 'border-green-500');
        
        // Update header title
        const titleEl = document.getElementById('current-view-title');
        if (titleEl) {
            titleEl.innerText = btnElement.innerText.replace(/[^\w\s-]/g, '').trim();
        }
    }

    // 5. Load data based on view
    if (viewId === 'view-dashboard') loadDashboardStats();
    if (viewId === 'view-branch-sales' || viewId === 'view-detailed-branch-sales') loadDetailedBranchSales();
    if (viewId === 'view-branches') loadBranches();
    if (viewId === 'view-staff') loadStaff();
    if (viewId === 'view-customers') loadCustomers();
    if (viewId === 'view-projects') loadProjects();
    if (viewId === 'view-payments') loadAdminPayments();
}

// DATA: Load Overview Stats & Individual Branch Performance
async function loadDashboardStats() {
    // 1. Fetch Branches, Projects, Customers, and Payments
    const { data: branches } = await supabase.from('branches').select('id, name');
    const { data: projects } = await supabase.from('projects').select('*');
    const { data: customers } = await supabase.from('customers').select('id, branch_id');
    const { data: payments } = await supabase.from('payments').select('*');

    // Mappings
    const branchStats = {};
    if (branches) {
        branches.forEach(b => {
            branchStats[b.id] = {
                name: b.name,
                sales: 0,
                paid: 0,
                activeProjects: 0
            };
        });
    }

    // Customer branch lookup map
    const customerBranchMap = {};
    if (customers) {
        customers.forEach(c => { customerBranchMap[c.id] = c.branch_id; });
    }

    // Dates for filtering
    const todayStr = new Date().toISOString().split('T')[0];
    const yDay = new Date();
    yDay.setDate(yDay.getDate() - 1);
    const yesterdayStr = yDay.toISOString().split('T')[0];

    const labelToday = document.getElementById('label-date-today');
    const labelYesterday = document.getElementById('label-date-yesterday');
    if (labelToday) labelToday.innerText = todayStr;
    if (labelYesterday) labelYesterday.innerText = yesterdayStr;

    // Company-wide Financial Aggregators
    let totalCompanySales = 0, totalCompanyPaid = 0;
    let todaySales = 0, todayPaid = 0;
    let yesterdaySales = 0, yesterdayPaid = 0;

    // Pipeline Counters
    let sPending = 0, sDesign = 0, sRevision = 0, sProduction = 0, sCompleted = 0;

    // A) Process Projects (Sales, Pipeline & Branch attribution)
    if (projects) {
        projects.forEach(p => {
            const amount = Number(p.total_amount) || 0;
            totalCompanySales += amount;

            // Determine branch ID (Project branch or Customer branch fallback)
            const bId = p.branch_id || customerBranchMap[p.customer_id];
            if (bId && branchStats[bId]) {
                branchStats[bId].sales += amount;
                branchStats[bId].activeProjects += 1;
            }

            // Date filtering
            const createdDate = p.created_at ? p.created_at.split('T')[0] : '';
            if (createdDate === todayStr) todaySales += amount;
            if (createdDate === yesterdayStr) yesterdaySales += amount;

            // Operational Stages
            const status = (p.status || 'PENDING').toUpperCase();
            if (status === 'PENDING') sPending++;
            else if (status === 'DESIGN') sDesign++;
            else if (status === 'REVISION') sRevision++;
            else if (status === 'PRODUCTION') sProduction++;
            else if (status === 'COMPLETED') sCompleted++;
        });
    }

    // B) Process Payments Ledger (Collections & Branch attribution)
    if (payments) {
        payments.forEach(pay => {
            const paid = Number(pay.amount) || 0;
            totalCompanyPaid += paid;

            const bId = pay.branch_id;
            if (bId && branchStats[bId]) {
                branchStats[bId].paid += paid;
            }

            const payDate = pay.created_at ? pay.created_at.split('T')[0] : (pay.date || '');
            if (payDate === todayStr) todayPaid += paid;
            if (payDate === yesterdayStr) yesterdayPaid += paid;
        });
    }

    // C) Render Company-wide Metrics
    const setElemText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    setElemText('stat-total-sales', `KSh ${totalCompanySales.toLocaleString()}`);
    setElemText('stat-total-paid', `KSh ${totalCompanyPaid.toLocaleString()}`);
    setElemText('stat-total-balance', `KSh ${Math.max(0, totalCompanySales - totalCompanyPaid).toLocaleString()}`);

    setElemText('stat-today-sales', `KSh ${todaySales.toLocaleString()}`);
    setElemText('stat-today-paid', `KSh ${todayPaid.toLocaleString()}`);
    setElemText('stat-today-balance', `KSh ${Math.max(0, todaySales - todayPaid).toLocaleString()}`);

    setElemText('stat-yesterday-sales', `KSh ${yesterdaySales.toLocaleString()}`);
    setElemText('stat-yesterday-paid', `KSh ${yesterdayPaid.toLocaleString()}`);
    setElemText('stat-yesterday-balance', `KSh ${Math.max(0, yesterdaySales - yesterdayPaid).toLocaleString()}`);

    // D) Render Branch Performance Table
    const branchTbody = document.getElementById('table-branch-performance');
    if (branchTbody) {
        branchTbody.innerHTML = '';
        const branchList = Object.values(branchStats);

        if (branchList.length === 0) {
            branchTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No branch data available.</td></tr>';
        } else {
            branchList.forEach(b => {
                const balance = Math.max(0, b.sales - b.paid);
                branchTbody.innerHTML += `
                    <tr class="hover:bg-gray-50 transition">
                        <td class="p-4 font-bold text-gray-800">${b.name}</td>
                        <td class="p-4 font-semibold text-gray-700">KSh ${b.sales.toLocaleString()}</td>
                        <td class="p-4 font-semibold text-green-600">KSh ${b.paid.toLocaleString()}</td>
                        <td class="p-4 font-semibold text-red-600">KSh ${balance.toLocaleString()}</td>
                        <td class="p-4">
                            <span class="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded text-xs font-bold">
                                ${b.activeProjects} Projects
                            </span>
                        </td>
                    </tr>
                `;
            });
        }
    }

    // E) Pipeline Stages
    setElemText('stat-stage-pending', sPending);
    setElemText('stat-stage-design', sDesign);
    setElemText('stat-stage-revision', sRevision);
    setElemText('stat-stage-production', sProduction);
    setElemText('stat-stage-completed', sCompleted);
}

// DATA: Load Detailed Branch Sales & Expenses View
async function loadDetailedBranchSales() {
    const tbody = document.getElementById('table-detailed-branch-sales');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">Loading branch data...</td></tr>';

    try {
        // Fetch data
        const { data: branches } = await supabase.from('branches').select('id, name');
        const { data: projects } = await supabase.from('projects').select('branch_id, total_amount, created_at');
        const { data: payments } = await supabase.from('payments').select('branch_id, amount');
        
        // Soft-fetch expenses in case table doesn't exist yet
        let expenses = [];
        try {
            const expRes = await supabase.from('expenses').select('branch_id, amount');
            if (expRes.data) expenses = expRes.data;
        } catch (e) {
            console.warn("Expenses table query skipped/failed:", e);
        }

        if (!branches || branches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">No branches found.</td></tr>';
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        let html = '';

        branches.forEach(branch => {
            let todaySales = 0;
            let totalSales = 0;
            let totalPaid = 0;
            let totalExpenses = 0;

            // Calculate Projects/Sales
            if (projects) {
                projects.filter(p => p.branch_id === branch.id).forEach(p => {
                    const amount = Number(p.total_amount) || 0;
                    totalSales += amount;
                    if (p.created_at && p.created_at.split('T')[0] === todayStr) {
                        todaySales += amount;
                    }
                });
            }

            // Calculate Payments
            if (payments) {
                payments.filter(pay => pay.branch_id === branch.id).forEach(pay => {
                    totalPaid += (Number(pay.amount) || 0);
                });
            }

            // Calculate Expenses
            if (expenses && expenses.length > 0) {
                expenses.filter(exp => exp.branch_id === branch.id).forEach(exp => {
                    totalExpenses += (Number(exp.amount) || 0);
                });
            }

            const balance = Math.max(0, totalSales - totalPaid);

            html += `
                <tr class="hover:bg-gray-50 transition border-b">
                    <td class="p-4 font-bold text-gray-800">${branch.name}</td>
                    <td class="p-4 font-semibold text-blue-600">KSh ${todaySales.toLocaleString()}</td>
                    <td class="p-4 font-medium text-gray-700">KSh ${totalSales.toLocaleString()}</td>
                    <td class="p-4 font-bold text-green-600">KSh ${totalPaid.toLocaleString()}</td>
                    <td class="p-4 font-bold ${balance > 0 ? 'text-red-600' : 'text-gray-500'}">KSh ${balance.toLocaleString()}</td>
                    <td class="p-4 font-medium text-orange-600">KSh ${totalExpenses.toLocaleString()}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (err) {
        console.error("Error loading detailed branch sales:", err);
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error: ${err.message}</td></tr>`;
    }
}

// DATA: Load Branches
async function loadBranches() {
    const { data, error } = await supabase.from('branches').select('*');
    const tbody = document.getElementById('table-branches');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
        return;
    }

    if (data) {
        data.forEach(b => {
            tbody.innerHTML += `<tr><td class="p-4 font-medium">${b.name}</td><td class="p-4 text-gray-500">${new Date(b.created_at).toLocaleDateString()}</td></tr>`;
        });
    }
}

// DATA: Load Staff
async function loadStaff() {
    const { data, error } = await supabase.from('profiles').select('*, branches(name)');
    const tbody = document.getElementById('table-staff');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
        return;
    }

    if (data) {
        data.forEach(s => {
            const branchName = s.branches?.name || 'Global / Unassigned';
            const formattedRole = s.role ? s.role.replace('_', ' ') : 'Staff';
            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition">
                    <td class="p-4 font-medium text-gray-800">${s.full_name || 'N/A'}</td>
                    <td class="p-4 text-gray-600 capitalize">${formattedRole}</td>
                    <td class="p-4 text-gray-500">${branchName}</td>
                </tr>`;
        });
    }
}

// DATA: Load Customers
async function loadCustomers() {
    const tbody = document.getElementById('table-customers');
    if (!tbody) return;

    // 1. Fetch all branches and create a lookup map
    const { data: branches } = await supabase.from('branches').select('id, name');
    const branchMap = {};
    if (branches) {
        branches.forEach(b => branchMap[String(b.id)] = b.name);
    }

    // 2. Fetch customers
    const { data: customers, error } = await supabase.from('customers').select('*');

    if (error) {
        console.error("Error loading customers:", error);
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    if (!customers || customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-500">No customers found.</td></tr>';
        return;
    }

    customers.forEach(c => {
        const customerName = c.name || c.full_name || 'Unknown Customer';
        const activeBranchId = c.branch_id || c.branch || c.branchId || c.store_id;
        const branchName = activeBranchId && branchMap[String(activeBranchId)] 
            ? branchMap[String(activeBranchId)] 
            : 'Unassigned / Global';

        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition">
                <td class="p-4 font-medium text-gray-800">${customerName}</td>
                <td class="p-4 text-gray-600">${c.phone || 'N/A'}</td>
                <td class="p-4">
                    <span class="bg-gray-100 border border-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-semibold">
                        ${branchName}
                    </span>
                </td>
            </tr>
        `;
    });
}

// DATA: Load All Projects with Dynamic Paid Amounts from Ledger
async function loadProjects() {
    const tbody = document.getElementById('table-projects');
    if (!tbody) return;

    // 1. Fetch Projects, Customers, Branches, and Payments in parallel
    const [
        { data: projects, error: pError },
        { data: customers },
        { data: branches },
        { data: payments }
    ] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('customers').select('id, name, branch_id'),
        supabase.from('branches').select('id, name'),
        supabase.from('payments').select('project_id, amount')
    ]);

    if (pError) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error: ${pError.message}</td></tr>`;
        return;
    }

    // 2. Build Lookup Maps
    const customerMap = {};
    if (customers) customers.forEach(c => customerMap[c.id] = c);

    const branchMap = {};
    if (branches) branches.forEach(b => branchMap[b.id] = b.name);

    // Group total amounts paid by project_id
    const projectPaidMap = {};
    if (payments) {
        payments.forEach(pay => {
            const pId = pay.project_id;
            if (pId) {
                projectPaidMap[pId] = (projectPaidMap[pId] || 0) + (Number(pay.amount) || 0);
            }
        });
    }

    // 3. Render Projects Table
    tbody.innerHTML = '';
    
    if (!projects || projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No projects found.</td></tr>';
        return;
    }

    projects.forEach(p => {
        const customer = customerMap[p.customer_id];
        const customerName = customer ? customer.name : 'Unknown Customer';
        
        // Match branch via project -> customer -> default
        const branchId = p.branch_id || (customer ? customer.branch_id : null);
        const branchName = branchId && branchMap[branchId] ? branchMap[branchId] : 'Unassigned';

        const totalAmt = Number(p.total_amount) || 0;
        
        // Sum from payments ledger (falls back to column if not found)
        const paidAmt = projectPaidMap[p.id] !== undefined 
            ? projectPaidMap[p.id] 
            : (Number(p.paid_amount) || 0);

        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition">
                <td class="p-4 font-mono text-xs font-bold text-gray-500">${p.project_code || p.id}</td>
                <td class="p-4">
                    <div class="font-bold text-gray-800">${p.title || p.name || 'Untitled Project'}</div>
                    <div class="text-xs text-gray-500">${customerName}</div>
                </td>
                <td class="p-4">
                    <span class="bg-gray-100 border border-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-semibold">
                        ${branchName}
                    </span>
                </td>
                <td class="p-4">
                    <span class="bg-yellow-100 text-yellow-800 border border-yellow-200 px-2.5 py-0.5 rounded text-xs font-bold uppercase">
                        ${p.status || 'PENDING'}
                    </span>
                </td>
                <td class="p-4">
                    <div class="text-sm font-semibold text-gray-800">Total: KSh ${totalAmt.toLocaleString()}</div>
                    <div class="text-xs font-bold text-green-600">Paid: KSh ${paidAmt.toLocaleString()}</div>
                </td>
            </tr>
        `;
    });
}

// DATA: Load Payments
async function loadAdminPayments() {
    const tbody = document.getElementById('table-payments');
    if (!tbody) return;

    const { data, error } = await supabase
        .from('payments')
        .select('*, projects(title, customers(name))')
        .order('created_at', { ascending: false });

    tbody.innerHTML = '';
    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
        return;
    }

    if (data) {
        data.forEach(pay => {
            const payAmt = Number(pay.amount) || 0;
            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition">
                    <td class="p-4 font-mono text-gray-700">${pay.display_id || pay.id.substring(0,8)}</td>
                    <td class="p-4 font-bold text-gray-800">${pay.projects?.customers?.name || 'Unknown'}</td>
                    <td class="p-4 text-gray-600">${pay.projects?.title || 'Unknown'}</td>
                    <td class="p-4 text-green-600 font-bold">KSh ${payAmt.toLocaleString()}</td>
                    <td class="p-4">
                        <span class="px-2 py-1 bg-gray-100 rounded text-xs uppercase">${pay.method || 'N/A'}</span> 
                        <span class="text-xs text-gray-500">${pay.reference_id || ''}</span>
                    </td>
                    <td class="p-4 text-gray-500">${new Date(pay.created_at).toLocaleDateString()}</td>
                </tr>`;
        });
    }
}

// Auth: Logout
async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

// ==========================================
// MODALS & FORMS LOGIC
// ==========================================

// General Modal Toggle
function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.toggle('hidden');
}

// Open Staff Modal & Load Branches into Dropdown
async function openStaffModal() {
    const branchSelect = document.getElementById('staff-branch');
    if (!branchSelect) return;

    branchSelect.innerHTML = '<option value="">Loading branches...</option>';
    
    const { data: branches } = await supabase.from('branches').select('id, name');
    
    if (branches && branches.length > 0) {
        branchSelect.innerHTML = '';
        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        });
    } else {
        branchSelect.innerHTML = '<option value="">No branches found</option>';
    }
    toggleModal('modal-staff');
}

// Submit New Staff Profile & Create Login
async function handleCreateStaff(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('staff-name').value;
    const rawUsername = document.getElementById('staff-username').value.trim().toLowerCase();
    const password = document.getElementById('staff-password').value;
    const rawRole = document.getElementById('staff-role').value;
    const branchId = document.getElementById('staff-branch').value;

    const formattedRole = rawRole ? rawRole.toLowerCase().replace(/\s+/g, '_') : 'staff';
    const safeUsername = rawUsername.replace(/[^a-z0-9]/g, '');
    const generatedEmail = `${safeUsername}@dadris.com`;

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: generatedEmail,
        password: password,
        options: {
            data: {
                full_name: fullName,
                role: formattedRole,
                branch_id: branchId || null,
                username: safeUsername
            }
        }
    });

    if (authError) return alert("Error creating account: " + authError.message);

    // 2. Insert Profile
    if (authData?.user) {
        const { error: profileError } = await supabase.from('profiles').upsert([{ 
            id: authData.user.id,
            full_name: fullName, 
            role: formattedRole, 
            branch_id: branchId ? branchId : null 
        }]);

        if (profileError) return alert("Profile insert error: " + profileError.message);
    }

    alert(`Success! Created staff profile for ${fullName}.\nLogin ID: ${safeUsername}`);
    toggleModal('modal-staff');
    document.getElementById('form-staff').reset();
    loadStaff(); 
}

// Submit New Branch
async function handleBranchSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('branch-name').value;
    
    const code = name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 5) || 'BR';

    const { error } = await supabase.from('branches').insert([{ 
        name: name,
        code: code
    }]);
    
    if (error) return alert("Error creating branch: " + error.message);

    alert(`Success! Created branch: ${name}`);
    toggleModal('modal-branch');
    document.getElementById('form-branch').reset();
    loadBranches(); 
}