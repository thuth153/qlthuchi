
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function TransactionForm({ isOpen, onClose, onSubmit, initialData }) {
    const [formData, setFormData] = useState({
        stock_symbol: '',
        transaction_date: new Date().toISOString().split('T')[0],
        type: 'BUY',
        quantity: '',
        price: '',
        note: '',
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                transaction_date: initialData.transaction_date.split('T')[0]
            });
        } else {
            setFormData({
                stock_symbol: '',
                transaction_date: new Date().toISOString().split('T')[0],
                type: 'BUY',
                quantity: '',
                price: '',
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            stock_symbol: formData.stock_symbol.toUpperCase(),
            quantity: Number(formData.quantity),
            price: Number(formData.price)
        });
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{initialData ? 'Sửa Giao dịch' : 'Thêm Giao dịch Mới'}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Mã CK</label>
                            <input
                                className="input-field"
                                value={formData.stock_symbol}
                                onChange={e => setFormData({ ...formData, stock_symbol: e.target.value })}
                                required
                                placeholder="VNM"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Ngày</label>
                            <input
                                type="date"
                                className="input-field"
                                value={formData.transaction_date}
                                onChange={e => setFormData({ ...formData, transaction_date: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Loại Giao dịch</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <label style={{
                                flex: 1, padding: '0.75rem', borderRadius: 'var(--radius)',
                                background: formData.type === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-primary)',
                                border: formData.type === 'BUY' ? '1px solid var(--success)' : '1px solid var(--border-color)',
                                cursor: 'pointer', textAlign: 'center', fontWeight: 600, color: formData.type === 'BUY' ? 'var(--success)' : 'var(--text-secondary)'
                            }}>
                                <input
                                    type="radio" name="type" value="BUY"
                                    checked={formData.type === 'BUY'}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    style={{ display: 'none' }}
                                />
                                MUA
                            </label>
                            <label style={{
                                flex: 1, padding: '0.75rem', borderRadius: 'var(--radius)',
                                background: formData.type === 'SELL' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-primary)',
                                border: formData.type === 'SELL' ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                                cursor: 'pointer', textAlign: 'center', fontWeight: 600, color: formData.type === 'SELL' ? 'var(--danger)' : 'var(--text-secondary)'
                            }}>
                                <input
                                    type="radio" name="type" value="SELL"
                                    checked={formData.type === 'SELL'}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    style={{ display: 'none' }}
                                />
                                BÁN
                            </label>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Số lượng</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                required
                                min="1"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Giá (VND)</label>
                            <input
                                type="number"
                                className="input-field"
                                value={formData.price}
                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                required
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} className="btn" style={{ background: 'transparent', color: 'var(--text-secondary)' }}>
                            Hủy
                        </button>
                        <button type="submit" className="btn btn-primary">
                            {initialData ? 'Cập nhật' : 'Thêm mới'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
