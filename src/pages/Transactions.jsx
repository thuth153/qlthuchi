
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Upload, Trash2, Edit2, Search, Filter, RefreshCw, ArrowUpRight, ArrowDownRight, Save, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import TransactionForm from '../components/TransactionForm';
import Pagination from '../components/Pagination';
import { calculatePortfolio } from '../utils/calculations';
import { fetchMarketPrices, savePriceToDb } from '../services/marketData';

export default function Transactions() {
    const [activeTab, setActiveTab] = useState('history'); // 'history' | 'portfolio'
    const [data, setData] = useState([]);
    const [portfolioData, setPortfolioData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [updatingPrices, setUpdatingPrices] = useState(false);

    // Price Editing State
    const [editingPriceSymbol, setEditingPriceSymbol] = useState(null);
    const [tempPrice, setTempPrice] = useState('');

    const fileInputRef = useRef(null);

    // Filters
    const [filterSymbol, setFilterSymbol] = useState('');

    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    useEffect(() => {
        fetchTransactions();
        setCurrentPage(1);
    }, [activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterSymbol, filterDateStart, filterDateEnd]);

    const fetchTransactions = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('transaction_date', { ascending: false });

        if (!error) {
            // Calculate Portfolio to get enriched history with PL
            // Use empty prices map for history calculation as current price doesn't affect realized PL
            const { enrichedTransactions } = calculatePortfolio(transactions, {});

            // Map enriched data back to original order (descending)
            const enrichedMap = new Map(enrichedTransactions.map(t => [t.id, t]));

            const dataWithPL = transactions.map(t => {
                const enriched = enrichedMap.get(t.id);
                return enriched ? { ...t, calculatedPL: enriched.calculatedPL } : t;
            });

            setData(dataWithPL);

            if (activeTab === 'portfolio') {
                // Calculate holdings first to know what is active
                // Initialize prices as generic map first to avoid fetching everything
                // We will fetch prices only for active symbols

                // 1. Calc quantity map
                const qtyMap = {};
                transactions.forEach(t => {
                    if (!qtyMap[t.stock_symbol]) qtyMap[t.stock_symbol] = 0;
                    if (t.type === 'BUY') qtyMap[t.stock_symbol] += t.quantity;
                    else qtyMap[t.stock_symbol] -= t.quantity;
                });

                // 2. Filter symbols with qty > 0
                const activeSymbols = Object.keys(qtyMap).filter(s => qtyMap[s] > 0);

                // 3. Fetch prices for these symbols
                const prices = await fetchMarketPrices(activeSymbols);

                // 4. Calculate Portfolio
                const { holdings } = calculatePortfolio(transactions, prices);
                setPortfolioData(holdings);
            }
        }
        setLoading(false);
    };

    const handleRefreshPrices = async () => {
        setUpdatingPrices(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: transactions } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id);

            // 1. Get active symbols
            const qtyMap = {};
            transactions.forEach(t => {
                if (!qtyMap[t.stock_symbol]) qtyMap[t.stock_symbol] = 0;
                if (t.type === 'BUY') qtyMap[t.stock_symbol] += t.quantity;
                else qtyMap[t.stock_symbol] -= t.quantity;
            });

            const activeSymbols = Object.keys(qtyMap).filter(s => qtyMap[s] > 0);

            if (activeSymbols.length === 0) {
                alert('Không có mã chứng khoán nào trong danh mục!');
                setUpdatingPrices(false);
                return;
            }

            // 2. Force fetch from TCBS API (this will also update cache)
            const prices = await fetchMarketPrices(activeSymbols);

            // 3. Update portfolio display
            const { holdings } = calculatePortfolio(transactions, prices);
            setPortfolioData(holdings);

            // Count how many prices were successfully fetched
            const successCount = Object.values(prices).filter(p => p > 0).length;
            alert(`Đã cập nhật giá cho ${successCount}/${activeSymbols.length} mã chứng khoán từ TCBS!`);
        } catch (error) {
            console.error('Error refreshing prices:', error);
            alert('Có lỗi khi cập nhật giá. Vui lòng thử lại!');
        } finally {
            setUpdatingPrices(false);
        }
    };

    const handleAddStart = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };

    const handleEditStart = (item) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    // Price Edit Handlers
    const startEditPrice = (item) => {
        setEditingPriceSymbol(item.symbol);
        setTempPrice(item.currentPrice);
    };

    const cancelEditPrice = () => {
        setEditingPriceSymbol(null);
        setTempPrice('');
    };

    const saveNewPrice = async (symbol) => {
        const price = Number(tempPrice);
        if (!price || price < 0) return alert("Giá không hợp lệ");

        // Update DB
        await savePriceToDb(symbol, price);

        // Update Local State immediately
        setPortfolioData(prev => prev.map(p => {
            if (p.symbol === symbol) {
                const newVal = price * p.quantity;
                const costVal = p.avgPrice * p.quantity;
                return {
                    ...p,
                    currentPrice: price,
                    marketValue: newVal,
                    unrealizedPL: newVal - costVal
                };
            }
            return p;
        }));

        setEditingPriceSymbol(null);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) return;
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (!error) fetchTransactions();
        else alert('Error: ' + error.message);
    };

    const handleSubmit = async (formData) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (editingItem) {
            const { error } = await supabase.from('transactions').update({ ...formData }).eq('id', editingItem.id);
            if (error) alert(error.message);
        } else {
            const { error } = await supabase.from('transactions').insert([{ ...formData, user_id: user.id }]);
            if (error) alert(error.message);
        }
        setIsModalOpen(false);
        fetchTransactions();
    };

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

            const { data: { user } } = await supabase.auth.getUser();
            const newTransactions = [];

            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;
                const [symbol, buyPrice, sellPrice, quantity, pl, dateStr] = row;

                let transDate = new Date();
                if (dateStr) {
                    if (typeof dateStr === 'number') transDate = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    else transDate = new Date(dateStr);
                }

                if (symbol && quantity && buyPrice) {
                    newTransactions.push({
                        user_id: user.id, stock_symbol: symbol, transaction_date: transDate.toISOString(),
                        type: 'BUY', quantity: Number(quantity), price: Number(buyPrice)
                    });
                }
                if (symbol && quantity && sellPrice) {
                    newTransactions.push({
                        user_id: user.id, stock_symbol: symbol, transaction_date: transDate.toISOString(),
                        type: 'SELL', quantity: Number(quantity), price: Number(sellPrice)
                    });
                }
            }

            if (newTransactions.length > 0) {
                const { error } = await supabase.from('transactions').insert(newTransactions);
                if (error) alert('Error: ' + error.message);
                else {
                    alert(`Imported ${newTransactions.length} items!`);
                    fetchTransactions();
                }
            }
        };
        reader.readAsBinaryString(file);
    };

    // Filter Logic
    const filteredData = data.filter(item => {
        const matchSymbol = filterSymbol ? item.stock_symbol.includes(filterSymbol.toUpperCase()) : true;
        let matchDate = true;
        const itemDate = new Date(item.transaction_date).getTime();
        if (filterDateStart) matchDate = matchDate && (itemDate >= new Date(filterDateStart).getTime());
        if (filterDateEnd) matchDate = matchDate && (itemDate <= new Date(filterDateEnd).setHours(23, 59, 59));
        return matchSymbol && matchDate;
    });

    const filteredPortfolio = portfolioData.filter(item => {
        const matchSymbol = filterSymbol ? item.symbol.includes(filterSymbol.toUpperCase()) : true;
        return matchSymbol && item.quantity > 0;
    });

    const currentList = activeTab === 'history' ? filteredData : filteredPortfolio;
    const paginatedData = currentList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Quản lý Đầu tư</h1>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius)' }}>
                    <button
                        onClick={() => setActiveTab('history')}
                        className="btn"
                        style={{
                            background: activeTab === 'history' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'history' ? '#fff' : 'var(--text-secondary)',
                            padding: '0.5rem 1rem', fontSize: '0.875rem'
                        }}
                    >
                        Lịch sử Giao dịch
                    </button>
                    <button
                        onClick={() => setActiveTab('portfolio')}
                        className="btn"
                        style={{
                            background: activeTab === 'portfolio' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'portfolio' ? '#fff' : 'var(--text-secondary)',
                            padding: '0.5rem 1rem', fontSize: '0.875rem'
                        }}
                    >
                        Danh mục Hiện tại
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
                    <Search size={18} color="var(--text-secondary)" />
                    <input
                        className="input-field"
                        style={{ padding: '0.5rem' }}
                        placeholder="Tìm Mã CK..."
                        value={filterSymbol}
                        onChange={e => setFilterSymbol(e.target.value)}
                    />
                </div>
                {activeTab === 'history' && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Từ:</span>
                            <input type="date" className="input-field" style={{ padding: '0.5rem' }} value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Đến:</span>
                            <input type="date" className="input-field" style={{ padding: '0.5rem' }} value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} />
                        </div>
                    </>
                )}

                <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 0.5rem' }}></div>

                {activeTab === 'history' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleExcelUpload} style={{ display: 'none' }} />
                        <button className="btn" onClick={() => fileInputRef.current.click()} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.5rem 1rem' }}>
                            <Upload size={16} /> Import
                        </button>
                        <button className="btn btn-primary" onClick={handleAddStart} style={{ padding: '0.5rem 1rem' }}>
                            <Plus size={16} /> Thêm Mới
                        </button>
                    </div>
                )}
                {activeTab === 'portfolio' && (
                    <button
                        className="btn btn-primary"
                        onClick={handleRefreshPrices}
                        disabled={updatingPrices}
                        style={{ padding: '0.5rem 1rem' }}
                    >
                        <RefreshCw size={16} style={{ animation: updatingPrices ? 'spin 1s linear infinite' : 'none' }} />
                        {updatingPrices ? 'Đang cập nhật...' : 'Cập nhật Giá'}
                    </button>
                )}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
                        {activeTab === 'history' ? (
                            <tr>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center', width: '50px' }}>STT</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Mã CK</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Ngày</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Loại</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Số lượng</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Giá Khớp</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Tổng giá trị</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Thao tác</th>
                            </tr>
                        ) : (
                            <tr>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center', width: '50px' }}>STT</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Mã CK</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Khối lượng Giữ</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Giá Vốn TB</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Giá Thị trường</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Lãi/Lỗ Tạm tính</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Lãi/Lỗ Đã chốt</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Đang tải dữ liệu...</td></tr>
                        ) : paginatedData.length === 0 ? (
                            <tr><td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Không có dữ liệu phù hợp</td></tr>
                        ) : (
                            activeTab === 'history' ? (
                                paginatedData.map((item, index) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            {(currentPage - 1) * pageSize + index + 1}
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{item.stock_symbol}</td>
                                        <td style={{ padding: '1rem' }}>{new Date(item.transaction_date).toLocaleDateString('vi-VN')}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                                                background: item.type === 'BUY' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: item.type === 'BUY' ? 'var(--success)' : 'var(--danger)'
                                            }}>
                                                {item.type === 'BUY' ? 'MUA' : 'BÁN'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{item.quantity.toLocaleString()}</td>
                                        <td style={{ padding: '1rem' }}>{item.price.toLocaleString()}</td>
                                        <td style={{ padding: '1rem' }}>{(item.quantity * item.price).toLocaleString()}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => handleEditStart(item)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                paginatedData.map((item, index) => (
                                    <tr key={item.symbol} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            {(currentPage - 1) * pageSize + index + 1}
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{item.symbol}</td>
                                        <td style={{ padding: '1rem' }}>
                                            {item.quantity.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '1rem' }}>{Math.round(item.avgPrice).toLocaleString()}</td>

                                        {/* Editable Current Price */}
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>
                                            {editingPriceSymbol === item.symbol ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <input
                                                        autoFocus
                                                        type="number"
                                                        className="input-field"
                                                        style={{ width: '80px', padding: '0.25rem' }}
                                                        value={tempPrice}
                                                        onChange={e => setTempPrice(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') saveNewPrice(item.symbol); else if (e.key === 'Escape') cancelEditPrice(); }}
                                                    />
                                                    <button onClick={() => saveNewPrice(item.symbol)} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer' }}><Save size={16} /></button>
                                                    <button onClick={cancelEditPrice} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><X size={16} /></button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ color: 'var(--primary)' }}>{item.currentPrice.toLocaleString()}</span>
                                                    <button
                                                        onClick={() => startEditPrice(item)}
                                                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.5 }}
                                                        title="Sửa giá thị trường"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>

                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: item.unrealizedPL >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                {item.quantity > 0 ? (
                                                    <>
                                                        {item.unrealizedPL >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                                                        {Math.abs(item.unrealizedPL).toLocaleString()}
                                                        <span style={{ fontSize: '0.75rem', marginLeft: '2px' }}>
                                                            ({((item.unrealizedPL / (item.avgPrice * item.quantity)) * 100).toFixed(1)}%)
                                                        </span>
                                                    </>
                                                ) : '-'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ color: item.realizedPL >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                {item.realizedPL.toLocaleString()}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )
                        )}
                    </tbody>
                    {/* Summary Footer for History Tab */}
                    {activeTab === 'history' && !loading && (
                        <tfoot>
                            <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                                <td style={{ padding: '1rem' }}>TỔNG CỘNG</td>
                                <td style={{ padding: '1rem' }}></td>
                                <td style={{ padding: '1rem' }}></td>
                                <td style={{ padding: '1rem' }}></td>
                                <td style={{ padding: '1rem' }}>
                                    {filteredData.reduce((sum, item) => sum + (item.type === 'BUY' ? item.quantity : -item.quantity), 0).toLocaleString()}
                                </td>
                                <td style={{ padding: '1rem' }}></td>
                                <td style={{ padding: '1rem' }}>
                                    {/* Calculated PL Sum (only for Sells shown in list) */}
                                    {(() => {
                                        const sumPL = filteredData.reduce((sum, item) => sum + (item.calculatedPL || 0), 0);
                                        return (
                                            <span style={{ color: sumPL >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                {sumPL > 0 ? '+' : ''}{sumPL.toLocaleString()}
                                            </span>
                                        );
                                    })()}
                                </td>
                                <td style={{ padding: '1rem' }}></td>
                            </tr>
                        </tfoot>
                    )}

                    {/* Summary Footer for Portfolio Tab */}
                    {activeTab === 'portfolio' && !loading && (
                        <tfoot>
                            <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                                <td style={{ padding: '1rem' }}>TỔNG CỘNG</td>
                                <td style={{ padding: '1rem' }}></td>
                                <td style={{ padding: '1rem' }}></td> {/* Quantity - Optional */}
                                <td style={{ padding: '1rem' }}></td> {/* Avg Cost */}
                                <td style={{ padding: '1rem' }}> {/* Market Value Total (under Market Price) */}
                                    {filteredPortfolio.reduce((sum, item) => sum + (item.marketValue || 0), 0).toLocaleString()}
                                </td>
                                <td style={{ padding: '1rem' }}> {/* Unrealized PL Total */}
                                    {(() => {
                                        const sumUnrealized = filteredPortfolio.reduce((sum, item) => sum + (item.unrealizedPL || 0), 0);
                                        return (
                                            <span style={{ color: sumUnrealized >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                {sumUnrealized > 0 ? '+' : ''}{sumUnrealized.toLocaleString()}
                                            </span>
                                        );
                                    })()}
                                </td>
                                <td style={{ padding: '1rem' }}> {/* Realized PL Total */}
                                    {(() => {
                                        const sumRealized = filteredPortfolio.reduce((sum, item) => sum + (item.realizedPL || 0), 0);
                                        return (
                                            <span style={{ color: sumRealized >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                {sumRealized > 0 ? '+' : ''}{sumRealized.toLocaleString()}
                                            </span>
                                        );
                                    })()}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={activeTab === 'history' ? filteredData.length : filteredPortfolio.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
            />

            <TransactionForm
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                initialData={editingItem}
            />
        </div>
    );
}
