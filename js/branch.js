let currentUserBranchId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = 'index.html';

    const { data: profile } = await supabase.from('profiles').select(`*, branches (name)`).eq('id', session.user.id).single();

    if (profile) {
        currentUserBranchId = profile.branch_id;
        document.getElementById('user-role-display').innerText = profile.full_name || 'Staff';
        document.getElementById('sidebar-branch-name').innerText = profile.branches?.name || 'Dadris Prints & Signs';
    }

    // Initial Load
    refreshAllData();

    // Enable Supabase Realtime Subscriptions
    setupRealtime();

    document.getElementById('form-new-sale').addEventListener('submit', handleNewSale);
    document.getElementById('form-new-client').addEventListener('submit', handleNewClient);
    document.getElementById('form-add-payment').addEventListener('submit', handleRecordPayment);
    document.getElementById('form-password').addEventListener('submit', handlePasswordChange);
});

// Realtime Listener
function setupRealtime() {
    supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => refreshAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => refreshAllData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => refreshAllData())
        .subscribe();
}

function refreshAllData() {
    loadDashboardStats();
    loadBranchProjects();
    loadBoards();
    loadPayments();
    loadClients();
}

// UI: Tab Switching
function toggleView(viewId, btnElement) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-gray-800', 'text-white', 'font-medium');
        btn.classList.add('text-gray-400');
    });
    
    if(btnElement) {
        btnElement.classList.remove('text-gray-400');
        btnElement.classList.add('bg-gray-800', 'text-white', 'font-medium');
    }

    refreshAllData();
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

async function handlePasswordChange(e) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: document.getElementById('new-password').value });
    if (error) alert("Error: " + error.message);
    else {
        alert("Password updated!");
        document.getElementById('modal-password').classList.add('hidden');
        document.getElementById('form-password').reset();
    }
}

// DATA: Load Overview Stats
async function loadDashboardStats() {
    const { data: projects } = await supabase.from('projects').select('*');
    const { data: payments } = await supabase.from('payments').select('amount, created_at');

    let totalSales = 0, totalPaid = 0, todaySales = 0, todayPaid = 0;
    let sDesign = 0, sProd = 0, sFab = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    if (projects) {
        projects.forEach(p => {
            const amount = Number(p.total_amount) || 0;
            totalSales += amount;
            if (p.created_at && p.created_at.split('T')[0] === todayStr) todaySales += amount;

            const status = (p.status || 'PENDING').toUpperCase();
            if (status === 'PENDING' || status === 'DESIGN') sDesign++;
            if (status === 'PRODUCTION') sProd++;
            if (status === 'FABRICATION') sFab++;
        });
    }

    if (payments) {
        payments.forEach(pay => {
            const amount = Number(pay.amount) || 0;
            totalPaid += amount;
            if (pay.created_at && pay.created_at.split('T')[0] === todayStr) todayPaid += amount;
        });
    }

    document.getElementById('stat-today-sales').innerText = `KSh ${todaySales.toLocaleString()}`;
    document.getElementById('stat-today-paid').innerText = `KSh ${todayPaid.toLocaleString()}`;
    document.getElementById('stat-today-balance').innerText = `KSh ${Math.max(0, todaySales - todayPaid).toLocaleString()}`;
    document.getElementById('stat-total-sales').innerText = `KSh ${totalSales.toLocaleString()}`;
    document.getElementById('stat-total-paid').innerText = `KSh ${totalPaid.toLocaleString()}`;
    document.getElementById('stat-total-balance').innerText = `KSh ${Math.max(0, totalSales - totalPaid).toLocaleString()}`;
    
    document.getElementById('stat-design').innerText = sDesign;
    document.getElementById('stat-production').innerText = sProd;
    document.getElementById('stat-fabrication').innerText = sFab;
}

// DATA: All Projects Table
async function loadBranchProjects() {
    const tbody = document.getElementById('table-branch-projects');
    const { data: projects } = await supabase.from('projects').select(`*, customers (name), profiles (full_name)`).order('created_at', { ascending: false });
    const { data: payments } = await supabase.from('payments').select('project_id, amount');

    tbody.innerHTML = '';

    if (!projects || projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No projects found.</td></tr>';
        return;
    }

    const paymentTotals = {};
    if (payments) {
        payments.forEach(pay => {
            paymentTotals[pay.project_id] = (paymentTotals[pay.project_id] || 0) + Number(pay.amount);
        });
    }

    projects.forEach(p => {
        const total = Number(p.total_amount) || 0;
        const paid = paymentTotals[p.id] || Number(p.paid_amount) || 0;
        const balance = Math.max(0, total - paid);
        const currentStatus = p.status || 'PENDING';

        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 border-b">
                <td class="p-4">
                    <div class="font-bold text-gray-800">${p.title}</div>
                    <div class="text-xs text-gray-500">${p.customers?.name || 'Unknown Client'}</div>
                </td>
                <td class="p-4 text-sm">${p.profiles?.full_name || 'Unassigned'}</td>
                <td class="p-4">
                    <select onchange="updateStatus('${p.id}', this.value)" class="text-xs font-bold px-2 py-1 border rounded bg-white shadow-sm focus:outline-none">
                        <option value="PENDING" ${currentStatus === 'PENDING' ? 'selected' : ''}>PENDING</option>
                        <option value="DESIGN" ${currentStatus === 'DESIGN' ? 'selected' : ''}>DESIGN</option>
                        <option value="PRODUCTION" ${currentStatus === 'PRODUCTION' ? 'selected' : ''}>PRODUCTION</option>
                        <option value="FABRICATION" ${currentStatus === 'FABRICATION' ? 'selected' : ''}>FABRICATION</option>
                        <option value="COMPLETED" ${currentStatus === 'COMPLETED' ? 'selected' : ''}>COMPLETED</option>
                    </select>
                </td>
                <td class="p-4">
                    <div class="text-sm font-semibold">Total: KSh ${total.toLocaleString()}</div>
                    <div class="text-xs font-bold text-green-600">Paid: KSh ${paid.toLocaleString()}</div>
                    ${balance > 0 ? `<div class="text-xs font-bold text-red-600">Bal: KSh ${balance.toLocaleString()}</div>` : `<div class="text-xs font-bold text-green-700">Fully Paid</div>`}
                </td>
                <td class="p-4 text-right">
                    <button onclick="openPaymentModal('${p.id}')" class="text-xs bg-green-100 text-green-800 hover:bg-green-200 px-3 py-1.5 rounded font-bold transition shadow-sm">
                        + Add Payment
                    </button>
                </td>
            </tr>
        `;
    });
}

// DATA: Kanban Boards
async function loadBoards() {
    const { data: projects } = await supabase.from('projects').select(`*, customers (name), profiles (full_name)`).neq('status', 'COMPLETED').order('created_at', { ascending: true });

    const gridDesign = document.getElementById('grid-design');
    const gridProd = document.getElementById('grid-production');
    const gridFab = document.getElementById('grid-fabrication');

    gridDesign.innerHTML = ''; gridProd.innerHTML = ''; gridFab.innerHTML = '';

    if(projects) {
        projects.forEach(p => {
            const status = p.status || 'PENDING';
            const cardHtml = `
                <div class="bg-white p-5 rounded-lg shadow-md border-t-4 ${getBorderColor(status)}">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-gray-800 text-lg leading-tight">${p.title}</h3>
                        <span class="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-gray-600">${status}</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-1"><strong>Client:</strong> ${p.customers?.name || 'Unknown'}</p>
                    <p class="text-sm text-gray-600 mb-4"><strong>Assigned:</strong> ${p.profiles?.full_name || 'Unassigned'}</p>
                    <div class="pt-3 border-t flex justify-end space-x-2">
                        ${getBoardButtons(p.id, status)}
                    </div>
                </div>
            `;

            if (status === 'PENDING' || status === 'DESIGN') gridDesign.innerHTML += cardHtml;
            else if (status === 'PRODUCTION') gridProd.innerHTML += cardHtml;
            else if (status === 'FABRICATION') gridFab.innerHTML += cardHtml;
        });
    }
    
    if(!gridDesign.innerHTML) gridDesign.innerHTML = '<p class="text-gray-500">No projects in Design.</p>';
    if(!gridProd.innerHTML) gridProd.innerHTML = '<p class="text-gray-500">No projects in Production.</p>';
    if(!gridFab.innerHTML) gridFab.innerHTML = '<p class="text-gray-500">No projects in Fabrication.</p>';
}

function getBorderColor(status) {
    if (status === 'PENDING' || status === 'DESIGN') return 'border-blue-500';
    if (status === 'PRODUCTION') return 'border-purple-500';
    if (status === 'FABRICATION') return 'border-orange-500';
    return 'border-gray-500';
}

function getBoardButtons(id, status) {
    if (status === 'PENDING' || status === 'DESIGN') return `<button onclick="updateStatus('${id}', 'PRODUCTION')" class="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1 rounded font-bold transition">Send to Production &rarr;</button>`;
    if (status === 'PRODUCTION') return `<button onclick="updateStatus('${id}', 'FABRICATION')" class="text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1 rounded font-bold transition">Send to Fabrication &rarr;</button>`;
    if (status === 'FABRICATION') return `<button onclick="updateStatus('${id}', 'COMPLETED')" class="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded font-bold transition">Mark Completed ✓</button>`;
    return '';
}

window.updateStatus = async function(id, newStatus) {
    await supabase.from('projects').update({ status: newStatus }).eq('id', id);
    refreshAllData();
}

// DATA: Payments Ledger
async function loadPayments() {
    const tbody = document.getElementById('table-branch-payments');
    const { data: payments } = await supabase.from('payments').select(`*, projects (title, customers (name))`).order('created_at', { ascending: false });

    tbody.innerHTML = payments?.length ? payments.map(pay => `
        <tr class="hover:bg-gray-50 border-b text-sm">
            <td class="p-4 text-gray-500">${new Date(pay.created_at).toLocaleString()}</td>
            <td class="p-4 font-bold text-gray-800">${pay.projects?.title || 'General Sale'}</td>
            <td class="p-4 text-gray-600">${pay.projects?.customers?.name || 'N/A'}</td>
            <td class="p-4"><span class="bg-gray-100 px-2 py-1 rounded text-xs font-bold">${pay.method || 'CASH'}</span></td>
            <td class="p-4 font-bold text-green-600">KSh ${(Number(pay.amount)||0).toLocaleString()}</td>
        </tr>
    `).join('') : '<tr><td colspan="5" class="p-4 text-center text-gray-500">No payments logged yet.</td></tr>';
}

// DATA: Clients
async function loadClients() {
    const tbody = document.getElementById('table-branch-clients');
    const { data: clients } = await supabase.from('customers').select('*').order('created_at', { ascending: false });

    tbody.innerHTML = clients?.length ? clients.map(c => `
        <tr class="hover:bg-gray-50 border-b">
            <td class="p-4 font-bold text-gray-800">${c.name}</td>
            <td class="p-4 text-gray-600">${c.phone || 'N/A'}</td>
            <td class="p-4"><span class="bg-gray-100 px-2 py-1 rounded text-xs font-bold">${c.type || 'N/A'}</span></td>
            <td class="p-4 text-sm text-gray-500">${new Date(c.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('') : '<tr><td colspan="4" class="p-4 text-center">No clients found.</td></tr>';
}

// MODAL: New Sale Modal
async function openNewSaleModal() {
    const designerSelect = document.getElementById('sale-designer');
    designerSelect.innerHTML = '<option value="">Loading designers...</option>';
    const { data: profiles } = await supabase.from('profiles').select('id, full_name');
    if (profiles && profiles.length === 1) {
        designerSelect.innerHTML = `<option value="${profiles[0].id}" selected>${profiles[0].full_name}</option>`;
    } else {
        designerSelect.innerHTML = '<option value="">-- Select Designer --</option>';
        if (profiles) profiles.forEach(prof => designerSelect.innerHTML += `<option value="${prof.id}">${prof.full_name}</option>`);
    }

    const customerSelect = document.getElementById('sale-customer-id');
    customerSelect.innerHTML = '<option value="">Loading customers...</option>';
    const { data: customers } = await supabase.from('customers').select('id, name').eq('branch_id', currentUserBranchId).order('name', { ascending: true });
    
    customerSelect.innerHTML = '<option value="">-- Select Existing Client --</option>';
    if (customers) customers.forEach(cust => customerSelect.innerHTML += `<option value="${cust.id}">${cust.name}</option>`);

    document.getElementById('modal-new-sale').classList.remove('hidden');
}

// FORM: Submit New Client
async function handleNewClient(e) {
    e.preventDefault();
    
    const name = document.getElementById('client-name').value;
    const phone = document.getElementById('client-phone').value;
    const type = document.getElementById('client-type').value;

    const { error } = await supabase.from('customers').insert([{
        name: name,
        phone: phone,
        type: type,
        branch_id: currentUserBranchId
    }]);

    if (error) return alert("Error saving client: " + error.message);

    document.getElementById('modal-new-client').classList.add('hidden');
    document.getElementById('form-new-client').reset();
    refreshAllData();
    alert("Client added successfully!");
}

// FORM: Submit New Sale
async function handleNewSale(e) {
    e.preventDefault();

    const title = document.getElementById('sale-title').value;
    const customerId = document.getElementById('sale-customer-id').value; 
    const designerId = document.getElementById('sale-designer').value;
    const totalAmount = Number(document.getElementById('sale-total').value);
    const paidAmount = Number(document.getElementById('sale-paid').value);

    if (!customerId) return alert("Please select a client. If it's a new client, add them in the Clients tab first.");

    // 1. Insert Project
    const { data: newProject, error: projErr } = await supabase.from('projects').insert([{
        title: title,
        customer_id: customerId,
        branch_id: currentUserBranchId,
        designer_id: designerId || null,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        status: 'DESIGN'
    }]).select().single();

    if(projErr) return alert("Error saving project: " + projErr.message);

    // 2. Insert Payment Log
    if (paidAmount > 0) {
        await supabase.from('payments').insert([{
            project_id: newProject.id,
            branch_id: currentUserBranchId,
            amount: paidAmount,
            method: 'CASH'
        }]);
    }

    document.getElementById('modal-new-sale').classList.add('hidden');
    document.getElementById('form-new-sale').reset();
    refreshAllData();
}

// ACTION: Record Payment
async function openPaymentModal(selectedProjectId = null) {
    const select = document.getElementById('payment-project-id');
    select.innerHTML = '<option value="">Loading...</option>';

    const { data: projects } = await supabase.from('projects').select('id, title');
    select.innerHTML = '<option value="">-- Select Project --</option>';
    if (projects) {
        projects.forEach(p => {
            const isSelected = selectedProjectId && selectedProjectId === p.id ? 'selected' : '';
            select.innerHTML += `<option value="${p.id}" ${isSelected}>${p.title}</option>`;
        });
    }

    document.getElementById('modal-add-payment').classList.remove('hidden');
}

async function handleRecordPayment(e) {
    e.preventDefault();
    const projectId = document.getElementById('payment-project-id').value;
    const method = document.getElementById('payment-method').value;
    const amount = Number(document.getElementById('payment-amount').value);

    if (!projectId || amount <= 0) return alert("Please enter valid payment details.");

    // 1. Insert into Payments Table
    const { error: payErr } = await supabase.from('payments').insert([{
        project_id: projectId,
        branch_id: currentUserBranchId,
        amount: amount,
        method: method
    }]);

    if (payErr) return alert("Error recording payment: " + payErr.message);

    // 2. Sync Projects paid_amount column
    const { data: proj } = await supabase.from('projects').select('paid_amount').eq('id', projectId).single();
    const newPaidTotal = (Number(proj?.paid_amount) || 0) + amount;
    
    await supabase.from('projects').update({ paid_amount: newPaidTotal }).eq('id', projectId);

    document.getElementById('modal-add-payment').classList.add('hidden');
    document.getElementById('form-add-payment').reset();
    refreshAllData();
}
// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}