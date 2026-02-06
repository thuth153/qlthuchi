import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange
}) {
    const isAll = pageSize >= 1000000;
    const totalPages = isAll ? 1 : Math.ceil(totalItems / pageSize);

    if (totalItems === 0) return null;

    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = isAll ? totalItems : Math.min(currentPage * pageSize, totalItems);

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            borderTop: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Hiển thị:</span>
                <select
                    value={isAll ? 'all' : pageSize}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'all') {
                            onPageSizeChange(1000000);
                        } else {
                            onPageSizeChange(Number(val));
                        }
                        onPageChange(1); // Reset to page 1
                    }}
                    className="input-field"
                    style={{ padding: '0.25rem', width: 'auto' }}
                >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="all">Tất cả</option>
                </select>
            </div>

            <span>
                {startItem}-{endItem} trong {totalItems}
            </span>

            <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="btn"
                    style={{
                        padding: '0.25rem',
                        background: 'transparent',
                        opacity: currentPage === 1 ? 0.5 : 1,
                        cursor: currentPage === 1 ? 'default' : 'pointer'
                    }}
                >
                    <ChevronLeft size={16} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    Trang {currentPage} / {totalPages}
                </div>
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="btn"
                    style={{
                        padding: '0.25rem',
                        background: 'transparent',
                        opacity: currentPage >= totalPages ? 0.5 : 1,
                        cursor: currentPage >= totalPages ? 'default' : 'pointer'
                    }}
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}
