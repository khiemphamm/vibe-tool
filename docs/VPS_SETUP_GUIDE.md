# 🚀 Hướng dẫn Cài đặt & Tối ưu VPS (Ubuntu)

Tài liệu này hướng dẫn bạn cách thiết lập VPS Ubuntu để chạy **Small Earth Server** một cách ổn định nhất sử dụng Docker.

---

## 1. Đề xuất Cấu hình VPS (Hardware)

Chạy trình duyệt ẩn (Playwright/Chromium) tiêu tốn rất nhiều tài nguyên. Để chạy mượt mà, bạn nên chọn cấu hình sau:

| Thông số | Tối thiểu (1-5 sessions) | Khuyên dùng (10-30 sessions) |
| :--- | :--- | :--- |
| **CPU** | 2 Cores | **4 - 8 Cores** (Ưu tiên xung nhịp cao) |
| **RAM** | 4GB | **8GB - 16GB** (Quan trọng nhất) |
| **SSD** | 20GB | 40GB+ |
| **OS** | Ubuntu 22.04 LTS | **Ubuntu 22.04 / 24.04 LTS** |

> [!TIP]
> **Mẹo nhỏ**: Nếu bạn dùng VPS có RAM ít, hãy bật **Swap** (RAM ảo) để tránh tình trạng sập server khi quá tải.

---

## 2. Chuẩn bị VPS (Ubuntu)

Sau khi mua VPS, hãy đăng nhập qua SSH và chạy các lệnh sau để cập nhật hệ thống:

```bash
sudo apt update && sudo apt upgrade -y
```

### Cài đặt Docker & Docker Compose
Cách nhanh nhất để cài đặt Docker trên Ubuntu:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

---

## 3. Triển khai Small Earth Server

### Bước 1: Copy code lên VPS
Bạn có thể dùng `scp` hoặc `git clone` để đưa thư mục `server/` lên VPS.

### Bước 2: Cấu hình bảo mật
Mở file `docker-compose.yml` trên VPS và thay đổi `API_KEY` để bảo mật:

```yaml
environment:
  - API_KEY=ma-bi-mat-cua-ban  # NHỚ THAY ĐỔI DÒNG NÀY
```

### Bước 3: Chạy Server
Tại thư mục chứa file `docker-compose.yml`, chạy lệnh:

```bash
docker compose up -d --build
```

---

## 4. Tối ưu hóa hiệu năng (Nâng cao)

### Tăng Swap (Nếu RAM thấp)
Nếu VPS của bạn chỉ có 4GB RAM, hãy tạo thêm 4GB Swap:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Kiểm tra tài nguyên
Để xem Server đang tốn bao nhiêu CPU/RAM thực tế, dùng lệnh:
```bash
docker stats vibe-server
```

---

## 5. Xử lý sự cố thường gặp

*   **Lỗi "Unauthorized"**: Kiểm tra xem API Key trong Electron app đã khớp với API Key trong file `.env` hoặc `docker-compose.yml` trên VPS chưa.
*   **Worker bị Stalled**: Do VPS hết RAM hoặc Proxy bị chậm. Hãy thử giảm số lượng sessions hoặc nâng cấp RAM.
*   **Không kết nối được**: Kiểm tra Firewall của VPS (UFW). Cần mở port 3000:
    ```bash
    sudo ufw allow 3000/tcp
    ```

---
*Chúc bạn vận hành hệ thống ổn định!*
