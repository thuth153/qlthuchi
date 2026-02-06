import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Edit2, Search, TrendingUp, TrendingDown, Calendar, DollarSign, List } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Pagination from '../components/Pagination';

export default function ExpenseManagement() {
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);

    // Filters
    const [filterType, setFilterType] = useState('all'); // 'all', 'income', 'expense'
    const [filterCategory, setFilterCategory] = useState('');
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const [catPage, setCatPage] = useState(1);
    const [catPageSize, setCatPageSize] = useState(20);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterType, filterCategory, filterMonth, filterYear]);

    // Reset category filter when type changes
    useEffect(() => {
        setFilterCategory('');
    }, [filterType]);

    // Form state
    const [formData, setFormData] = useState({
        transaction_date: new Date().toISOString().split('T')[0],
        type: 'expense',
        category_id: '',
        amount: '',
        note: ''
    });

    const [categoryFormData, setCategoryFormData] = useState({
        name: '',
        type: 'expense'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch categories
        const { data: cats } = await supabase
            .from('expense_categories')
            .select('*')
            .eq('user_id', user.id)
            .order('name');

        setCategories(cats || []);

        // Fetch expenses
        const { data: exps } = await supabase
            .from('expenses')
            .select(`
                *,
                category:expense_categories(name, type)
            `)
            .eq('user_id', user.id)
            .order('transaction_date', { ascending: false });

        setExpenses(exps || []);
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const payload = {
            ...formData,
            amount: parseFloat(formData.amount),
            user_id: user.id
        };

        if (editingItem) {
            await supabase.from('expenses').update(payload).eq('id', editingItem.id);
        } else {
            await supabase.from('expenses').insert([payload]);
        }

        setIsModalOpen(false);
        setFormData({
            transaction_date: new Date().toISOString().split('T')[0],
            type: 'expense',
            category_id: '',
            amount: '',
            note: ''
        });
        setEditingItem(null);
        fetchData();
    };

    const handleCategorySubmit = async (e) => {
        e.preventDefault();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (editingCategory) {
            await supabase.from('expense_categories').update(categoryFormData).eq('id', editingCategory.id);
        } else {
            await supabase.from('expense_categories').insert([{ ...categoryFormData, user_id: user.id }]);
        }

        setIsCategoryModalOpen(false);
        setCategoryFormData({ name: '', type: 'expense' });
        setEditingCategory(null);
        fetchData();
    };

    const handleCategoryEdit = (category) => {
        setEditingCategory(category);
        setCategoryFormData({ name: category.name, type: category.type });
        setIsCategoryModalOpen(true);
    };

    const handleCategoryDelete = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa danh mục này? Các giao dịch liên quan sẽ không có danh mục.')) return;
        await supabase.from('expense_categories').delete().eq('id', id);
        fetchData();
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa?')) return;
        await supabase.from('expenses').delete().eq('id', id);
        fetchData();
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData({
            transaction_date: item.transaction_date,
            type: item.type,
            category_id: item.category_id || '',
            amount: item.amount,
            note: item.note || ''
        });
        setIsModalOpen(true);
    };

    // Filter logic
    const filteredExpenses = expenses.filter(item => {
        const matchType = filterType === 'all' || item.type === filterType;
        const matchCategory = !filterCategory || item.category_id === filterCategory;

        const itemDate = new Date(item.transaction_date);
        const matchMonth = filterMonth === 'all' || itemDate.getMonth() + 1 === parseInt(filterMonth);
        const matchYear = filterYear === 'all' || itemDate.getFullYear() === parseInt(filterYear);

        return matchType && matchCategory && matchMonth && matchYear;
    });

    // Calculate summary
    const totalIncome = filteredExpenses.filter(e => e.type === 'income').reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const totalExpense = filteredExpenses.filter(e => e.type === 'expense').reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const balance = totalIncome - totalExpense;

    // Chart data - by category
    // Chart data - by category (Split into Income and Expense)
    const incomeStats = {};
    const expenseStats = {};

    filteredExpenses.forEach(exp => {
        const catName = exp.category?.name || 'Khác';
        const amount = parseFloat(exp.amount);

        if (exp.type === 'income') {
            if (!incomeStats[catName]) incomeStats[catName] = 0;
            incomeStats[catName] += amount;
        } else {
            if (!expenseStats[catName]) expenseStats[catName] = 0;
            expenseStats[catName] += amount;
        }
    });

    const incomePieData = Object.keys(incomeStats).map(key => ({
        name: key,
        value: incomeStats[key]
    }));

    const expensePieData = Object.keys(expenseStats).map(key => ({
        name: key,
        value: expenseStats[key]
    }));

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Quản lý Thu Chi</h1>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn" onClick={() => setIsCategoryManageOpen(true)} style={{ background: 'var(--bg-secondary)', padding: '0.5rem 1rem', border: '1px solid var(--border-color)' }}>
                        <List size={16} /> Quản lý Danh mục
                    </button>
                    <button className="btn" onClick={() => { setEditingCategory(null); setCategoryFormData({ name: '', type: 'expense' }); setIsCategoryModalOpen(true); }} style={{ background: 'var(--bg-secondary)', padding: '0.5rem 1rem', border: '1px solid var(--border-color)' }}>
                        <Plus size={16} /> Thêm Danh mục
                    </button>
                    <button className="btn btn-primary" onClick={() => { setEditingItem(null); setIsModalOpen(true); }} style={{ padding: '0.5rem 1rem' }}>
                        <Plus size={16} /> Thêm Thu/Chi
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--success)', marginBottom: '0.5rem' }}>
                        <TrendingUp size={20} />
                        <span style={{ fontSize: '0.875rem' }}>Tổng Thu</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
                        {totalIncome.toLocaleString()} đ
                    </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>
                        <TrendingDown size={20} />
                        <span style={{ fontSize: '0.875rem' }}>Tổng Chi</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>
                        {totalExpense.toLocaleString()} đ
                    </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <DollarSign size={20} />
                        <span style={{ fontSize: '0.875rem' }}>Số dư</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {balance > 0 ? '+' : ''}{balance.toLocaleString()} đ
                    </div>
                </div>
            </div>

            {/* Charts */}
            {(incomePieData.length > 0 || expensePieData.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    {/* Income Chart */}
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--success)' }}>Phân bổ Thu</h3>
                        {incomePieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={incomePieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={80}
                                        dataKey="value"
                                    >
                                        {incomePieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => value.toLocaleString() + ' đ'} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Không có dữ liệu Thu</div>
                        )}
                    </div>

                    {/* Expense Chart */}
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--danger)' }}>Phân bổ Chi</h3>
                        {expensePieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={expensePieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={80}
                                        dataKey="value"
                                    >
                                        {expensePieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => value.toLocaleString() + ' đ'} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Không có dữ liệu Chi</div>
                        )}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="input-field" style={{ width: 'auto', padding: '0.5rem' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="all">Tất cả</option>
                    <option value="income">Thu</option>
                    <option value="expense">Chi</option>
                </select>
                <select className="input-field" style={{ width: 'auto', padding: '0.5rem' }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="">Tất cả danh mục</option>
                    {categories
                        .filter(cat => filterType === 'all' || cat.type === filterType)
                        .map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name} ({cat.type === 'income' ? 'Thu' : 'Chi'})</option>
                        ))}
                </select>
                <select className="input-field" style={{ width: 'auto', padding: '0.5rem' }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                    <option value="all">Tất cả tháng</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>Tháng {m}</option>
                    ))}
                </select>
                <select className="input-field" style={{ width: 'auto', padding: '0.5rem' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                    <option value="all">Tất cả năm</option>
                    {Array.from({ length: 10 }, (_, i) => 2026 + i).map(y => (
                        <option key={y} value={y}>Năm {y}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
                        <tr>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center', width: '60px' }}>STT</th>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'left' }}>Ngày</th>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'left' }}>Loại</th>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'left' }}>Danh mục</th>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Số tiền</th>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'left' }}>Ghi chú</th>
                            <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center' }}>Đang tải...</td></tr>
                        ) : filteredExpenses.length === 0 ? (
                            <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center' }}>Chưa có dữ liệu</td></tr>
                        ) : (
                            filteredExpenses.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item, index) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {(currentPage - 1) * pageSize + index + 1}
                                    </td>
                                    <td style={{ padding: '1rem' }}>{new Date(item.transaction_date).toLocaleDateString('vi-VN')}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                                            background: item.type === 'income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: item.type === 'income' ? 'var(--success)' : 'var(--danger)'
                                        }}>
                                            {item.type === 'income' ? 'THU' : 'CHI'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>{item.category?.name || 'Khác'}</td>
                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: item.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                                        {item.type === 'income' ? '+' : '-'}{parseFloat(item.amount).toLocaleString()} đ
                                    </td>
                                    <td style={{ padding: '1rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.note || '-'}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                            <button onClick={() => handleEdit(item)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                            <td colSpan="4" style={{ padding: '1rem', textAlign: 'right' }}>TỔNG CỘNG</td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                {(() => {
                                    const sum = filteredExpenses.reduce((acc, curr) => {
                                        return acc + (curr.type === 'income' ? parseFloat(curr.amount) : -parseFloat(curr.amount));
                                    }, 0);
                                    return (
                                        <span style={{ color: sum >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                            {sum > 0 ? '+' : ''}{sum.toLocaleString()} đ
                                        </span>
                                    );
                                })()}
                            </td>
                            <td colSpan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <Pagination
                currentPage={currentPage}
                totalItems={filteredExpenses.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
            />

            {/* Expense Modal */}
            {
                isModalOpen && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
                    }}>
                        <div className="card" style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
                            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>{editingItem ? 'Sửa' : 'Thêm'} Thu/Chi</h2>
                            <form onSubmit={handleSubmit}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Ngày</label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={formData.transaction_date}
                                        onChange={e => setFormData({ ...formData, transaction_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Loại</label>
                                    <select
                                        className="input-field"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        required
                                    >
                                        <option value="income">Thu</option>
                                        <option value="expense">Chi</option>
                                    </select>
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Danh mục</label>
                                    <select
                                        className="input-field"
                                        value={formData.category_id}
                                        onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                                    >
                                        <option value="">-- Chọn danh mục --</option>
                                        {categories.filter(c => c.type === formData.type).map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Số tiền</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        required
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Ghi chú</label>
                                    <textarea
                                        className="input-field"
                                        value={formData.note}
                                        onChange={e => setFormData({ ...formData, note: e.target.value })}
                                        rows="3"
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn" onClick={() => setIsModalOpen(false)} style={{ background: 'var(--bg-secondary)' }}>
                                        Hủy
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        {editingItem ? 'Cập nhật' : 'Thêm'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Category Modal */}
            {
                isCategoryModalOpen && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
                    }}>
                        <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
                            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>{editingCategory ? 'Sửa' : 'Thêm'} Danh mục</h2>
                            <form onSubmit={handleCategorySubmit}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Tên danh mục</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={categoryFormData.name}
                                        onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Loại</label>
                                    <select
                                        className="input-field"
                                        value={categoryFormData.type}
                                        onChange={e => setCategoryFormData({ ...categoryFormData, type: e.target.value })}
                                        required
                                    >
                                        <option value="income">Thu</option>
                                        <option value="expense">Chi</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn" onClick={() => { setIsCategoryModalOpen(false); setEditingCategory(null); }} style={{ background: 'var(--bg-secondary)' }}>
                                        Hủy
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        {editingCategory ? 'Cập nhật' : 'Thêm'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Category Management Modal */}
            {
                isCategoryManageOpen && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
                    }}>
                        <div className="card" style={{ maxWidth: '600px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
                            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Quản lý Danh mục</h2>

                            {categories.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                                    Chưa có danh mục nào. Hãy tạo danh mục mới!
                                </p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                                    <thead style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
                                        <tr>
                                            <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', width: '50px' }}>STT</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'left' }}>Tên</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'left' }}>Loại</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categories.slice((catPage - 1) * catPageSize, catPage * catPageSize).map((cat, index) => (
                                            <tr key={cat.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                    {(catPage - 1) * catPageSize + index + 1}
                                                </td>
                                                <td style={{ padding: '0.75rem', fontWeight: 600 }}>{cat.name}</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                                                        background: cat.type === 'income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                        color: cat.type === 'income' ? 'var(--success)' : 'var(--danger)'
                                                    }}>
                                                        {cat.type === 'income' ? 'THU' : 'CHI'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                        <button
                                                            onClick={() => { setIsCategoryManageOpen(false); handleCategoryEdit(cat); }}
                                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                                                            title="Sửa"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleCategoryDelete(cat.id)}
                                                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                                                            title="Xóa"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            <Pagination
                                currentPage={catPage}
                                totalItems={categories.length}
                                pageSize={catPageSize}
                                onPageChange={setCatPage}
                                onPageSizeChange={setCatPageSize}
                            />

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn" onClick={() => setIsCategoryManageOpen(false)} style={{ background: 'var(--bg-secondary)' }}>
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
