# Hướng dẫn cài đặt Module Quản lý Thu Chi

## Bước 1: Chạy SQL Schema trên Supabase

1. Đăng nhập vào Supabase Dashboard: https://supabase.com/dashboard
2. Chọn project của bạn
3. Vào **SQL Editor** (biểu tượng database bên trái)
4. Tạo một **New Query**
5. Copy toàn bộ nội dung file `supabase_expense_schema.sql` và paste vào
6. Bấm **Run** để thực thi

## Bước 2: Kiểm tra Tables đã tạo

Vào **Table Editor** và kiểm tra 2 tables mới:
- `expense_categories` - Lưu danh mục thu/chi
- `expenses` - Lưu các giao dịch thu/chi

## Bước 3: Chạy ứng dụng

```bash
npm run dev
```

## Tính năng mới

### 1. API Lấy giá chứng khoán
- Đã thay thế TCBS bằng SSI iBoard API và VNDirect API
- Tự động fallback nếu một API không hoạt động

### 2. Theme Sáng/Tối
- Bấm icon Sun/Moon ở góc phải header để chuyển đổi
- Theme được lưu tự động vào localStorage

### 3. Quản lý Thu Chi
- Truy cập qua menu "Thu Chi" trong Sidebar
- Tạo danh mục thu/chi tùy chỉnh
- Thêm/sửa/xóa giao dịch thu/chi
- Lọc theo loại, danh mục, khoảng thời gian
- Xem biểu đồ phân bố theo danh mục
- Tổng kết thu/chi và số dư

## Lưu ý
- Đảm bảo đã chạy SQL schema trước khi sử dụng tính năng Thu Chi
- Nếu gặp lỗi CORS với API giá chứng khoán, hệ thống sẽ tự động dùng giá đã cache
