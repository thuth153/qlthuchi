
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Fuel, Calendar, Car, BarChart3, Filter } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import Pagination from '../components/Pagination';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function FuelManagement() {
    const [activeTab, setActiveTab] = useState('logs'); // 'logs' | 'report' | 'vehicles'
    const [vehicles, setVehicles] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Forms
    const [newVehicleName, setNewVehicleName] = useState('');
    const [logForm, setLogForm] = useState({ vehicle_id: '', amount: '', log_date: new Date().toISOString().split('T')[0] });

    // Report Filters
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [reportMonth, setReportMonth] = useState('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch Vehicles
        const { data: vData } = await supabase.from('vehicles').select('*').order('created_at', { ascending: true });
        setVehicles(vData || []);

        // Fetch Logs
        const { data: lData } = await supabase
            .from('fuel_logs')
            .select(`
            *,
            vehicles (name)
        `)
            .order('log_date', { ascending: false });
        setLogs(lData || []);

        setLoading(false);
    };

    const handleAddVehicle = async () => {
        if (!newVehicleName.trim()) return;
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('vehicles').insert([{ user_id: user.id, name: newVehicleName }]);
        if (!error) {
            setNewVehicleName('');
            fetchData();
        } else alert(error.message);
    };

    const handleDeleteVehicle = async (id) => {
        if (!window.confirm('Xóa xe này sẽ xóa tất cả lịch sử đổ xăng của nó. Tiếp tục?')) return;
        await supabase.from('vehicles').delete().eq('id', id);
        fetchData();
    };

    const handleAddLog = async (e) => {
        e.preventDefault();
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Insert fuel log
        const { error: fuelError } = await supabase.from('fuel_logs').insert([{
            user_id: user.id,
            vehicle_id: logForm.vehicle_id,
            amount: Number(logForm.amount),
            log_date: logForm.log_date
        }]);

        if (fuelError) {
            alert('Lỗi khi thêm ghi chú đổ xăng: ' + fuelError.message);
            return;
        }

        // 2. Auto-create expense entry in Thu Chi module
        try {
            // Check if "Xăng xe" category exists
            let { data: existingCategory } = await supabase
                .from('expense_categories')
                .select('id')
                .eq('user_id', user.id)
                .eq('name', 'Xăng xe')
                .eq('type', 'expense')
                .single();

            // If not exists, create it
            if (!existingCategory) {
                const { data: newCategory, error: catError } = await supabase
                    .from('expense_categories')
                    .insert([{ user_id: user.id, name: 'Xăng xe', type: 'expense' }])
                    .select()
                    .single();

                if (catError) {
                    console.error('Could not create Xăng xe category:', catError);
                } else {
                    existingCategory = newCategory;
                }
            }

            // Create expense entry
            if (existingCategory) {
                await supabase.from('expenses').insert([{
                    user_id: user.id,
                    transaction_date: logForm.log_date,
                    type: 'expense',
                    category_id: existingCategory.id,
                    amount: Number(logForm.amount),
                    note: `Đổ xăng - ${vehicles.find(v => v.id === logForm.vehicle_id)?.name || 'Xe'}`
                }]);
            }
        } catch (expenseError) {
            console.error('Error creating expense entry:', expenseError);
            // Don't fail the whole operation if expense creation fails
        }

        // 3. Reset form and refresh
        setLogForm({ ...logForm, amount: '' }); // Reset amount only
        fetchData();
        alert('Đã thêm ghi chú đổ xăng và tự động ghi vào Thu Chi!');
    };

    const handleDeleteLog = async (id) => {
        if (!window.confirm('Xóa bản ghi này?')) return;
        await supabase.from('fuel_logs').delete().eq('id', id);
        fetchData();
    };

    // --- REPORT LOGIC ---
    const getReportData = () => {
        let filtered = logs.filter(l => {
            const d = new Date(l.log_date);
            const matchYear = d.getFullYear() === Number(reportYear);
            const matchMonth = reportMonth === 'all' ? true : d.getMonth() + 1 === Number(reportMonth);
            return matchYear && matchMonth;
        });

        // 1. Total Cost
        const totalCost = filtered.reduce((sum, l) => sum + l.amount, 0);

        // 2. By Vehicle
        const byVehicleMap = {};
        filtered.forEach(l => {
            const vName = l.vehicles?.name || 'Unknown';
            if (!byVehicleMap[vName]) byVehicleMap[vName] = 0;
            byVehicleMap[vName] += l.amount;
        });
        const byVehicleData = Object.keys(byVehicleMap).map(k => ({ name: k, value: byVehicleMap[k] }));

        // 3. By Month (if viewing Year)
        const byMonthData = [];
        if (reportMonth === 'all') {
            for (let i = 1; i <= 12; i++) {
                const monthSum = filtered
                    .filter(l => new Date(l.log_date).getMonth() + 1 === i)
                    .reduce((sum, l) => sum + l.amount, 0);
                byMonthData.push({ name: `T${i}`, amount: monthSum });
            }
        }

        return { totalCost, byVehicleData, byMonthData, filteredCount: filtered.length };
    };

    const reportData = getReportData();

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Quản lý Nhiên liệu</h1>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius)' }}>
                    <button onClick={() => setActiveTab('logs')} className={`btn ${activeTab === 'logs' ? 'btn-primary' : ''}`} style={activeTab !== 'logs' ? { background: 'transparent' } : {}}>Nhập liệu</button>
                    <button onClick={() => setActiveTab('report')} className={`btn ${activeTab === 'report' ? 'btn-primary' : ''}`} style={activeTab !== 'report' ? { background: 'transparent' } : {}}>Báo cáo</button>
                    <button onClick={() => setActiveTab('vehicles')} className={`btn ${activeTab === 'vehicles' ? 'btn-primary' : ''}`} style={activeTab !== 'vehicles' ? { background: 'transparent' } : {}}>Danh mục Xe</button>
                </div>
            </div>

            {activeTab === 'vehicles' && (
                <div className="card">
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Danh sách Xe</h3>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                        <input
                            className="input-field"
                            placeholder="Tên xe (VD: Honda Airblade, Vinfast VF8...)"
                            value={newVehicleName}
                            onChange={e => setNewVehicleName(e.target.value)}
                        />
                        <button className="btn btn-primary" onClick={handleAddVehicle}><Plus size={16} /> Thêm</button>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {vehicles.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((v, index) => (
                            <li key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem', minWidth: '20px' }}>{(currentPage - 1) * pageSize + index + 1}.</span>
                                    <Car size={16} /> {v.name}
                                </span>
                                <button onClick={() => handleDeleteVehicle(v.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                            </li>
                        ))}
                        {vehicles.length === 0 && <li style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Chưa có xe nào. Hãy thêm mới!</li>}
                    </ul>
                    <Pagination
                        currentPage={currentPage}
                        totalItems={vehicles.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                    />
                </div>
            )}

            {activeTab === 'logs' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                    <div className="card" style={{ height: 'fit-content' }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Ghi Nhận Đổ Xăng</h3>
                        <form onSubmit={handleAddLog} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Chọn Xe</label>
                                <select
                                    className="input-field"
                                    required
                                    value={logForm.vehicle_id}
                                    onChange={e => setLogForm({ ...logForm, vehicle_id: e.target.value })}
                                >
                                    <option value="">-- Chọn xe --</option>
                                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Số tiền (VNĐ)</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    required
                                    placeholder="50000"
                                    value={logForm.amount}
                                    onChange={e => setLogForm({ ...logForm, amount: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Ngày đổ</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    required
                                    value={logForm.log_date}
                                    onChange={e => setLogForm({ ...logForm, log_date: e.target.value })}
                                />
                            </div>
                            <button className="btn btn-primary" type="submit" disabled={!logForm.vehicle_id}>Lưu Thông Tin</button>
                        </form>
                    </div>

                    <div className="card">
                        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Lịch sử Đổ xăng</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                    <th style={{ padding: '0.75rem', width: '50px' }}>STT</th>
                                    <th style={{ padding: '0.75rem' }}>Ngày</th>
                                    <th style={{ padding: '0.75rem' }}>Xe</th>
                                    <th style={{ padding: '0.75rem' }}>Số tiền</th>
                                    <th style={{ padding: '0.75rem' }}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((l, index) => (
                                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{(currentPage - 1) * pageSize + index + 1}</td>
                                        <td style={{ padding: '0.75rem' }}>{new Date(l.log_date).toLocaleDateString('vi-VN')}</td>
                                        <td style={{ padding: '0.75rem' }}>{l.vehicles?.name}</td>
                                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{l.amount.toLocaleString()} đ</td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <button onClick={() => handleDeleteLog(l.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {logs.length === 0 && <tr><td colSpan="5" style={{ padding: '1rem', textAlign: 'center' }}>Chưa có dữ liệu.</td></tr>}
                            </tbody>
                        </table>
                        <Pagination
                            currentPage={currentPage}
                            totalItems={logs.length}
                            pageSize={pageSize}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                </div>
            )}

            {activeTab === 'report' && (
                <div>
                    <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <Filter size={20} color="var(--text-secondary)" />
                        <select
                            className="input-field"
                            style={{ width: '100px' }}
                            value={reportYear}
                            onChange={e => setReportYear(e.target.value)}
                        >
                            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select
                            className="input-field"
                            style={{ width: '150px' }}
                            value={reportMonth}
                            onChange={e => setReportMonth(e.target.value)}
                        >
                            <option value="all">Cả năm</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {/* Summary Card */}
                        <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', padding: '1.5rem', borderRadius: 'var(--radius)', color: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <Fuel size={24} />
                                <span style={{ fontSize: '1rem', fontWeight: 500 }}>Tổng Chi phí Nhiên liệu</span>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                                {reportData.totalCost.toLocaleString()} đ
                            </div>
                            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '0.5rem' }}>
                                {reportData.filteredCount} lần đổ xăng
                            </div>
                        </div>

                        {/* Charts */}
                        <div className="card" style={{ height: '300px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Chi phí theo Loại Xe</div>
                            <ResponsiveContainer width="100%" height="90%">
                                <PieChart>
                                    <Pie
                                        data={reportData.byVehicleData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {reportData.byVehicleData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => value.toLocaleString() + ' đ'} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {reportMonth === 'all' && (
                            <div className="card" style={{ height: '300px', gridColumn: '1 / -1' }}>
                                <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Biểu đồ Chi phí theo Tháng</div>
                                <ResponsiveContainer width="100%" height="90%">
                                    <BarChart data={reportData.byMonthData}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip formatter={(value) => value.toLocaleString() + ' đ'} />
                                        <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
