
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Calendar, Filter } from 'lucide-react';
import Pagination from '../components/Pagination';

export default function Report() {
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    const [filterSymbol, setFilterSymbol] = useState('');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [symbolStats, setSymbolStats] = useState([]);

    // Pagination
    const [statsPage, setStatsPage] = useState(1);
    const [statsPageSize, setStatsPageSize] = useState(20);
    const [detailsPage, setDetailsPage] = useState(1);
    const [detailsPageSize, setDetailsPageSize] = useState(20);

    // Helper to format large numbers
    const formatCompact = (num) => {
        if (Math.abs(num) >= 1000000000) return (num / 1000000000).toFixed(1) + ' tỷ';
        if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(1) + ' tr';
        if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + ' K';
        return num.toString();
    };

    const formatQuantity = (num) => {
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    };

    // Helper to set quick dates
    const setQuickDate = (type) => { // 'month', 'year', 'ytd'
        const end = new Date();
        const start = new Date();

        if (type === 'month') {
            start.setMonth(end.getMonth() - 1);
        } else if (type === 'year') {
            start.setFullYear(end.getFullYear() - 1);
        } else if (type === 'ytd') {
            start.setMonth(0, 1); // Jan 1st
        }

        setDateEnd(end.toISOString().split('T')[0]);
        setDateStart(start.toISOString().split('T')[0]);
    };

    const calculateReport = async () => {
        if (!dateStart || !dateEnd) {
            alert("Vui lòng chọn khoảng thời gian!");
            return;
        }

        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        const endISO = end.toISOString();

        const { data: allHistory } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .lte('transaction_date', endISO); // Fetch unsorted from DB, we sort in JS

        // Sort by date ascending to process legally
        // If dates are equal, process BUY before SELL to avoid negative balances in intraday trading
        allHistory.sort((a, b) => {
            const dateA = new Date(a.transaction_date);
            const dateB = new Date(b.transaction_date);
            const diff = dateA - dateB;
            if (diff !== 0) return diff;

            // Same date: Priority BUY (-1) < SELL (1)
            if (a.type === 'BUY' && b.type !== 'BUY') return -1;
            if (a.type !== 'BUY' && b.type === 'BUY') return 1;
            return 0;
        });

        // Replay logic
        const portfolio = {};
        let totalBuyValInRange = 0;
        let totalSellValInRange = 0;
        let realizedPLInRange = 0;
        let detailsList = [];

        // Stats Map: { [symbol]: count }
        const statsMap = {};

        // Normalize filter symbol
        const targetSymbol = filterSymbol.trim().toUpperCase();

        allHistory.forEach(t => {
            const sym = t.stock_symbol;

            if (!portfolio[sym]) portfolio[sym] = { qty: 0, cost: 0, avgPrice: 0 };
            const p = portfolio[sym];

            const tDate = new Date(t.transaction_date);
            const inRange = tDate >= new Date(dateStart) && tDate <= end;
            const isTarget = targetSymbol ? sym === targetSymbol : true;

            if (t.type === 'BUY') {
                const currentVal = p.qty * p.avgPrice;
                const newVal = t.quantity * t.price;

                const newQty = p.qty + t.quantity;
                if (newQty > 0) p.avgPrice = (currentVal + newVal) / newQty;
                p.qty = newQty;

                if (inRange && isTarget) {
                    totalBuyValInRange += newVal;
                }
            } else if (t.type === 'SELL') {
                const sellVal = t.quantity * t.price;
                const costVal = t.quantity * p.avgPrice;
                const profit = sellVal - costVal;

                // Snapshot for details BEFORE updating quantity (cost basis is from BEFORE sale)
                if (inRange && isTarget) {
                    totalSellValInRange += sellVal;
                    realizedPLInRange += profit;
                    detailsList.push({
                        ...t,
                        costPrice: p.avgPrice,
                        profit,
                        totalSellValue: sellVal
                    });

                    // Update stats
                    statsMap[sym] = (statsMap[sym] || 0) + 1;
                }

                p.qty -= t.quantity;
            }
        });

        // Sort details by date desc
        detailsList.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

        // Process Stats
        const totalTrades = detailsList.length;
        const statsArray = Object.keys(statsMap).map(sym => ({
            symbol: sym,
            count: statsMap[sym],
            percent: totalTrades > 0 ? (statsMap[sym] / totalTrades) * 100 : 0
        })).sort((a, b) => b.count - a.count);

        setReportData({
            totalBuy: totalBuyValInRange,
            totalSell: totalSellValInRange,
            netFlow: totalSellValInRange - totalBuyValInRange,
            realizedPL: realizedPLInRange,
            roi: totalSellValInRange > 0 ? (realizedPLInRange / (totalSellValInRange - realizedPLInRange)) * 100 : 0,
            details: detailsList
        });
        setSymbolStats(statsArray);
        setStatsPage(1);
        setDetailsPage(1);
        setLoading(false);
    };

    return (
        <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '2rem' }}>Báo cáo Hiệu quả Đầu tư</h1>

            {/* ... Filters Section ... */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setQuickDate('month')} className="btn" style={{ background: 'var(--bg-secondary)', fontSize: '0.875rem' }}>1 Tháng qua</button>
                    <button onClick={() => setQuickDate('year')} className="btn" style={{ background: 'var(--bg-secondary)', fontSize: '0.875rem' }}>1 Năm qua</button>
                    <button onClick={() => setQuickDate('ytd')} className="btn" style={{ background: 'var(--bg-secondary)', fontSize: '0.875rem' }}>Từ đầu năm (YTD)</button>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Mã CK (Tùy chọn)</label>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', padding: '0 0.75rem', border: '1px solid var(--border-color)' }}>
                            <Search size={16} color="var(--text-secondary)" />
                            <input
                                className="input-field"
                                style={{ border: 'none', background: 'transparent' }}
                                value={filterSymbol}
                                onChange={e => setFilterSymbol(e.target.value)}
                                placeholder="Tất cả"
                            />
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Từ ngày</label>
                        <input
                            type="date"
                            className="input-field"
                            value={dateStart}
                            onChange={e => setDateStart(e.target.value)}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Đến ngày</label>
                        <input
                            type="date"
                            className="input-field"
                            value={dateEnd}
                            onChange={e => setDateEnd(e.target.value)}
                        />
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={calculateReport}
                        disabled={loading}
                        style={{ height: '42px', minWidth: '120px' }}
                    >
                        {loading ? 'Đang tính...' : 'Xem Báo cáo'}
                    </button>
                </div>
            </div>

            {reportData && (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Tổng Mua</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatCompact(reportData.totalBuy)}</div>
                        </div>
                        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Tổng Bán</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{formatCompact(reportData.totalSell)}</div>
                        </div>
                        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Lãi/Lỗ Thực</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: reportData.realizedPL >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {reportData.realizedPL > 0 ? '+' : ''}{formatCompact(reportData.realizedPL)}
                            </div>
                        </div>
                        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>ROI</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: reportData.roi >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {reportData.roi.toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    {/* Main Content: Two Columns */}
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

                        {/* Left: Frequency Stats */}
                        <div className="card" style={{ flex: '1', minWidth: '300px', padding: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
                                Cổ phiếu thường xuyên giao dịch
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem', width: '50px' }}>STT</th>
                                        <th style={{ padding: '0.75rem' }}>Mã</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>SLGD</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {symbolStats.slice((statsPage - 1) * statsPageSize, statsPage * statsPageSize).map((stat, index) => (
                                        <tr key={stat.symbol} style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{(statsPage - 1) * statsPageSize + index + 1}</td>
                                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>{stat.symbol}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{stat.count}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{stat.percent.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                    {symbolStats.length === 0 && <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Chưa có giao dịch</td></tr>}
                                </tbody>
                            </table>
                            <Pagination
                                currentPage={statsPage}
                                totalItems={symbolStats.length}
                                pageSize={statsPageSize}
                                onPageChange={setStatsPage}
                                onPageSizeChange={setStatsPageSize}
                            />
                        </div>

                        {/* Right: Detailed Log */}
                        <div className="card" style={{ flex: '2', minWidth: '400px', padding: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
                                Giao dịch CP (Đã bán)
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>
                                            <th style={{ padding: '0.75rem', textAlign: 'center', width: '50px' }}>STT</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Mã</th>
                                            <th style={{ padding: '0.75rem' }}>Giá vốn</th>
                                            <th style={{ padding: '0.75rem' }}>Giá bán</th>
                                            <th style={{ padding: '0.75rem' }}>KLCP</th>
                                            <th style={{ padding: '0.75rem' }}>Lãi (tr)</th>
                                            <th style={{ padding: '0.75rem' }}>TG bán</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.details.slice((detailsPage - 1) * detailsPageSize, detailsPage * detailsPageSize).map((d, index) => (
                                            <tr key={d.id} style={{ borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{(detailsPage - 1) * detailsPageSize + index + 1}</td>
                                                <td style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>{d.stock_symbol}</td>
                                                <td style={{ padding: '0.75rem', color: 'var(--success)' }}>{Math.round(d.costPrice).toLocaleString()}</td>
                                                <td style={{ padding: '0.75rem' }}>{d.price.toLocaleString()}</td>
                                                <td style={{ padding: '0.75rem' }}>{formatQuantity(d.quantity)}</td>
                                                <td style={{ padding: '0.75rem', fontWeight: 600, color: d.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                    {d.profit > 0 ? '+' : ''}{formatCompact(d.profit)}
                                                </td>
                                                <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>{new Date(d.transaction_date).toLocaleDateString('vi-VN')}</td>
                                            </tr>
                                        ))}
                                        {reportData.details.length === 0 && <tr><td colSpan="7" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Không có dữ liệu</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination
                                currentPage={detailsPage}
                                totalItems={reportData.details.length}
                                pageSize={detailsPageSize}
                                onPageChange={setDetailsPage}
                                onPageSizeChange={setDetailsPageSize}
                            />
                        </div>

                    </div>
                </>
            )}
        </div>
    );
}
