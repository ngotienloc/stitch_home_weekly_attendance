-- 1. Xóa các sinh viên cũ để tránh trùng lặp
delete from auth.users where email != 'teacher@edu.vn' and email not in (select email from auth.users where email like '%teacher%');

-- 2. Kích hoạt extension pgcrypto
create extension if not exists pgcrypto;

-- 3. Tạo bảng tạm chứa thông tin sinh viên để insert đồng thời vào auth.users và auth.identities
create temp table temp_students (
  id uuid default gen_random_uuid(),
  email text,
  full_name text
);

insert into temp_students (email, full_name) values
  ('dangminhthiet@gmail.com', 'Đặng Minh Thiết'),
  ('nguyenhongphuc@gmail.com', 'Nguyễn Hồng Phúc'),
  ('leanhduong@gmail.com', 'Lê Anh Dương'),
  ('nguyenquangnhat@gmail.com', 'Nguyễn Quang Nhật'),
  ('nguyenvannam@gmail.com', 'Nguyễn Văn Nam'),
  ('buitrongnamanh@gmail.com', 'Bùi Trọng Nam Anh'),
  ('lexuanloc@gmail.com', 'Lê Xuân Lộc'),
  ('buinganha@gmail.com', 'Bùi Ngân Hà'),
  ('lequanghuy@gmail.com', 'Lê Quang Huy'),
  ('trannguyenminhduc@gmail.com', 'Trần Nguyễn Minh Đức'),
  ('nguyendangduong@gmail.com', 'Nguyền Đăng Dương'),
  ('hoangvanlong@gmail.com', 'Hoàng Văn Long'),
  ('ngotienloc@gmail.com', 'Ngô Tiến Lộc'),
  ('buituandat@gmail.com', 'Bùi Tuấn đạt'),
  ('nguyenthitramy@gmail.com', 'Nguyễn Thị Trà My'),
  ('nguyenquocanh@gmail.com', 'Nguyễn Quốc Anh'),
  ('dinhthidieulinh@gmail.com', 'Đinh Thị Diệu Linh'),
  ('nguyenthaian@gmail.com', 'Nguyễn Thái An'),
  ('trannamhaiduong@gmail.com', 'Trần Nam Hải Dương'),
  ('vuminhanh@gmail.com', 'Vũ Minh Anh'),
  ('nguyenmanhlinh@gmail.com', 'Nguyễn Mạnh Linh'),
  ('ngocaohuy@gmail.com', 'Ngô Cao Huy'),
  ('doviettien@gmail.com', 'Đỗ Việt Tiến'),
  ('nguyenngonhatlinh@gmail.com', 'Nguyễn Ngô Nhất Linh'),
  ('hoangthihongnhung@gmail.com', 'Hoàng Thị Hồng Nhung'),
  ('duongthingocanh@gmail.com', 'Dương Thị Ngọc Ánh'),
  ('nguyenthuytrang@gmail.com', 'Nguyễn Thùy Trang'),
  ('levanhoangnguyen@gmail.com', 'Lê Văn Hoàng Nguyên'),
  ('doanngocxuan@gmail.com', 'Đoàn Ngọc Xuân'),
  ('doquangdo@gmail.com', 'Đỗ Quang Đô'),
  ('doanxuankhoi@gmail.com', 'Đoàn Xuân Khôi'),
  ('nguyenhoangtuandat@gmail.com', 'Nguyễn Hoàng Tuấn Đạt'),
  ('nguyenminhduc@gmail.com', 'Nguyễn Minh Đức'),
  ('phanquockhanh@gmail.com', 'Phan Quốc Khánh'),
  ('ngotrungnam@gmail.com', 'Ngô Trung Nam'),
  ('dothikhanhlinh@gmail.com', 'Đỗ Thị Khánh Linh'),
  ('buithiminhhieu@gmail.com', 'Bùi Thị Minh Hiếu'),
  ('quanhoanghaidang@gmail.com', 'Quản Hoàng Hải Đăng'),
  ('nguyensontung@gmail.com', 'Nguyễn Sơn Tùng'),
  ('nguyenminhdung@gmail.com', 'Nguyễn Minh Dũng'),
  ('nguyenngoctuan@gmail.com', 'Nguyễn Ngọc Tuấn'),
  ('daohungcuong@gmail.com', 'Đào Hùng Cường'),
  ('trinhphamhaian@gmail.com', 'Trịnh Phạm Hải An'),
  ('nguyenvantuyen@gmail.com', 'Nguyễn Văn Tuyển'),
  ('nguyenbuidaihiep@gmail.com', 'Nguyễn Bùi Đại Hiệp'),
  ('vudangquang@gmail.com', 'Vũ Đăng Quang'),
  ('nguyentienthanh@gmail.com', 'Nguyễn Tiến Thành'),
  ('phamducminh@gmail.com', 'Phạm Đức Minh'),
  ('trananhtrong@gmail.com', 'Trần Anh Trọng'),
  ('nguyenhuyhoang@gmail.com', 'Nguyễn Huy Hoàng'),
  ('daoquangkhai@gmail.com', 'Đào Quang Khải'),
  ('vudangduy@gmail.com', 'Vũ Đăng Duy'),
  ('lamgiaminh@gmail.com', 'Lâm Gia Minh'),
  ('nguyenthithao@gmail.com', 'Nguyễn Thị Thảo'),
  ('daolinhchi@gmail.com', 'Đào Linh Chi'),
  ('maiphuong@gmail.com', 'Mai Phương'),
  ('dangminhphuong@gmail.com', 'Đặng Minh Phương'),
  ('phamhainam@gmail.com', 'Phạm Hải Nam'),
  ('tahuutung@gmail.com', 'Tạ Hữu Tùng');

-- 4. Insert vào auth.users
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud)
select 
  id,
  '00000000-0000-0000-0000-000000000000',
  email,
  crypt('123456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('full_name', full_name),
  false,
  'authenticated',
  'authenticated'
from temp_students;

-- 5. Insert vào auth.identities để liên kết provider đăng nhập
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select 
  id,
  id,
  jsonb_build_object('sub', id, 'email', email, 'email_verified', true, 'phone_verified', false),
  'email',
  id,
  now(),
  now(),
  now()
from temp_students;

-- 6. Dọn dẹp bảng tạm
drop table temp_students;
