import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // Ensure this is imported
import { calculatePortfolio } from '../utils/calculations';
import { fetchMarketPrices } from '../services/marketData';
import { Wallet, TrendingUp, TrendingDown, DollarSign, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import Pagination from '../components/Pagination';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const StatCard = ({ title, value, subtext, icon: Icon, trend }) => (
    <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{title}</span>
            <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>
                <Icon size={20} />
            </div>
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{value}</div>
        <div style={{ fontSize: '0.875rem', color: trend > 0 ? 'var(--success)' : (trend < 0 ? 'var(--danger)' : 'var(--text-secondary)'), display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {trend > 0 ? <TrendingUp size={14} /> : (trend < 0 ? <TrendingDown size={14} /> : null)}
            {subtext}
        </div>
    </div>
);

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{data.symbol}</p>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>Số lượng: <strong style={{ color: 'var(--text-primary)' }}>{data.quantity.toLocaleString()}</strong></span>
                    <span>Giá: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(data.currentPrice > 0 ? data.currentPrice : data.avgPrice).toLocaleString()} đ</strong></span>
                    <div style={{ marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                        Giá trị: <strong style={{ color: 'var(--primary)' }}>{data.chartValue.toLocaleString()} đ</strong>
                        <span style={{ marginLeft: '4px', fontSize: '0.75rem' }}>({data.allocation.toFixed(1)}%)</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);
    const [holdings, setHoldings] = useState([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const loadData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id);

        if (transactions) {
            const symbols = [...new Set(transactions.map(t => t.stock_symbol))];
            const prices = await fetchMarketPrices(symbols);
            const { summary, holdings } = calculatePortfolio(transactions, prices);
            setSummary(summary);
            setHoldings(holdings);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải dữ liệu...</div>;
    if (!summary) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chưa có dữ liệu giao dịch. Hãy nhập giao dịch mới!</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Tổng quan Danh mục</h1>
                <button onClick={loadData} className="btn" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={18} /> Cập nhật giá
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <StatCard
                    title="Tổng Tài sản"
                    value={summary.totalMarketValue.toLocaleString() + ' đ'}
                    subtext={`Vốn: ${summary.totalInvested.toLocaleString()} đ`}
                    icon={Wallet}
                    trend={1}
                />
                <StatCard
                    title="Tổng Lãi/Lỗ"
                    value={summary.totalPL.toLocaleString() + ' đ'}
                    subtext={`${summary.returnRate.toFixed(2)}%`}
                    icon={TrendingUp}
                    trend={summary.totalPL}
                />
                <StatCard
                    title="Lãi Đã chốt (Realized)"
                    value={summary.totalRealizedPL.toLocaleString() + ' đ'}
                    subtext="Đã hiện thực hóa"
                    icon={DollarSign}
                    trend={summary.totalRealizedPL}
                />
                <StatCard
                    title="Lãi Tạm tính (Unrealized)"
                    value={summary.totalUnrealizedPL.toLocaleString() + ' đ'}
                    subtext="Theo giá thị trường"
                    icon={TrendingDown}
                    trend={summary.totalUnrealizedPL}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                <div className="card" style={{ minHeight: '400px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Phân bổ Tài sản</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={holdings.filter(h => h.chartValue > 0)}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="chartValue"
                                    nameKey="symbol"
                                >
                                    {holdings.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                            {holdings.filter(h => h.chartValue > 0).map((h, i) => (
                                <div key={h.symbol} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }}></div>
                                    {h.symbol}: {h.quantity.toLocaleString()} cp - Giá {Math.round(h.avgPrice).toLocaleString()} ({h.allocation.toFixed(1)}%)
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card" style={{ minHeight: '400px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Chi tiết Danh mục</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem', width: '50px' }}>STT</th>
                                    <th style={{ padding: '0.75rem' }}>Mã</th>
                                    <th style={{ padding: '0.75rem' }}>KL</th>
                                    <th style={{ padding: '0.75rem' }}>Giá Mua TB</th>
                                    <th style={{ padding: '0.75rem' }}>Giá Bán TB</th>
                                    <th style={{ padding: '0.75rem' }}>Tổng Lãi/Lỗ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {holdings.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((h, index) => (
                                    <tr key={h.symbol} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{(currentPage - 1) * pageSize + index + 1}</td>
                                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{h.symbol}</td>
                                        <td style={{ padding: '0.75rem' }}>{h.quantity.toLocaleString()}</td>
                                        <td style={{ padding: '0.75rem' }}>{Math.round(h.avgPrice).toLocaleString()}</td>
                                        <td style={{ padding: '0.75rem' }}>
                                            {h.avgSellPrice > 0 ? Math.round(h.avgSellPrice).toLocaleString() : '-'}
                                        </td>
                                        <td style={{ padding: '0.75rem', color: h.totalPL >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                            {h.totalPL > 0 ? '+' : ''}{h.totalPL.toLocaleString()}
                                            {h.quantity > 0 && h.avgPrice > 0 && (
                                                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                                    ({((h.totalPL / (h.avgPrice * h.quantity)) * 100).toFixed(1)}%)
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Pagination
                            currentPage={currentPage}
                            totalItems={holdings.length}
                            pageSize={pageSize}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
