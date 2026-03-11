-- Seed data for LMS (categories + 50 books)

insert into public.categories (name) values
  ('Fiction'),
  ('Non-Fiction'),
  ('Technology'),
  ('Business'),
  ('History'),
  ('Science'),
  ('Self-Development'),
  ('Design'),
  ('Education'),
  ('Comics')
on conflict (name) do nothing;

insert into public.books (title, author, isbn, category_id, stock_total, stock_available)
values
  ('The Silent Shelf', 'A. Rahman', 'LMS-ISBN-0001', (select id from public.categories where name='Fiction'), 5, 5),
  ('Midnight in the Stacks', 'S. Putri', 'LMS-ISBN-0002', (select id from public.categories where name='Fiction'), 3, 3),
  ('Borrowed Time', 'N. Hidayat', 'LMS-ISBN-0003', (select id from public.categories where name='Fiction'), 4, 4),
  ('Paper Trails', 'D. Santoso', 'LMS-ISBN-0004', (select id from public.categories where name='Fiction'), 2, 2),
  ('The Last Bookmark', 'R. Kusuma', 'LMS-ISBN-0005', (select id from public.categories where name='Fiction'), 6, 6),

  ('Atomic Habits of Study', 'M. Pratama', 'LMS-ISBN-0006', (select id from public.categories where name='Self-Development'), 5, 5),
  ('Deep Focus Blueprint', 'T. Wulandari', 'LMS-ISBN-0007', (select id from public.categories where name='Self-Development'), 4, 4),
  ('Confidence by Design', 'A. Nugroho', 'LMS-ISBN-0008', (select id from public.categories where name='Self-Development'), 3, 3),
  ('The Learning Loop', 'S. Lestari', 'LMS-ISBN-0009', (select id from public.categories where name='Education'), 7, 7),
  ('Study Systems That Work', 'B. Mahendra', 'LMS-ISBN-0010', (select id from public.categories where name='Education'), 5, 5),

  ('Practical PostgreSQL', 'K. Wijaya', 'LMS-ISBN-0011', (select id from public.categories where name='Technology'), 6, 6),
  ('Node.js Patterns', 'H. Saputra', 'LMS-ISBN-0012', (select id from public.categories where name='Technology'), 4, 4),
  ('Express in Action', 'F. Amelia', 'LMS-ISBN-0013', (select id from public.categories where name='Technology'), 5, 5),
  ('API Design Handbook', 'I. Maulana', 'LMS-ISBN-0014', (select id from public.categories where name='Technology'), 3, 3),
  ('Secure Web Apps', 'P. Siregar', 'LMS-ISBN-0015', (select id from public.categories where name='Technology'), 4, 4),

  ('The Product Playbook', 'D. Hartono', 'LMS-ISBN-0016', (select id from public.categories where name='Business'), 5, 5),
  ('Startup Metrics 101', 'R. Ananda', 'LMS-ISBN-0017', (select id from public.categories where name='Business'), 3, 3),
  ('Operations Made Simple', 'S. Kurnia', 'LMS-ISBN-0018', (select id from public.categories where name='Business'), 4, 4),
  ('Negotiation Notes', 'A. Sari', 'LMS-ISBN-0019', (select id from public.categories where name='Business'), 2, 2),
  ('Decision-Making Systems', 'M. Arief', 'LMS-ISBN-0020', (select id from public.categories where name='Business'), 6, 6),

  ('Modern Finance Basics', 'T. Aditya', 'LMS-ISBN-0021', (select id from public.categories where name='Business'), 5, 5),
  ('Accounting for Humans', 'N. Salsabila', 'LMS-ISBN-0022', (select id from public.categories where name='Business'), 4, 4),
  ('Marketing Without Noise', 'B. Prakoso', 'LMS-ISBN-0023', (select id from public.categories where name='Business'), 3, 3),
  ('Brand Building Blocks', 'E. Paramita', 'LMS-ISBN-0024', (select id from public.categories where name='Business'), 2, 2),
  ('Sales Conversations', 'Y. Firmansyah', 'LMS-ISBN-0025', (select id from public.categories where name='Business'), 4, 4),

  ('A Short History of Libraries', 'S. Rahayu', 'LMS-ISBN-0026', (select id from public.categories where name='History'), 5, 5),
  ('Cities and Civilizations', 'A. Fajar', 'LMS-ISBN-0027', (select id from public.categories where name='History'), 3, 3),
  ('Empires: A Brief Tour', 'M. Damar', 'LMS-ISBN-0028', (select id from public.categories where name='History'), 4, 4),
  ('The Age of Discovery', 'R. Melati', 'LMS-ISBN-0029', (select id from public.categories where name='History'), 2, 2),
  ('History Through Letters', 'K. Nabila', 'LMS-ISBN-0030', (select id from public.categories where name='History'), 6, 6),

  ('Everyday Physics', 'H. Prameswari', 'LMS-ISBN-0031', (select id from public.categories where name='Science'), 5, 5),
  ('Chemistry in Minutes', 'D. Pranoto', 'LMS-ISBN-0032', (select id from public.categories where name='Science'), 4, 4),
  ('Biology of Habits', 'A. Fadhil', 'LMS-ISBN-0033', (select id from public.categories where name='Science'), 3, 3),
  ('The Logic of Science', 'S. Intan', 'LMS-ISBN-0034', (select id from public.categories where name='Science'), 2, 2),
  ('Data and Experiments', 'R. Ramadhan', 'LMS-ISBN-0035', (select id from public.categories where name='Science'), 6, 6),

  ('Clean UI Foundations', 'V. Ayuningtyas', 'LMS-ISBN-0036', (select id from public.categories where name='Design'), 5, 5),
  ('Design Systems Guide', 'A. Baskoro', 'LMS-ISBN-0037', (select id from public.categories where name='Design'), 4, 4),
  ('Typography Essentials', 'S. Dwi', 'LMS-ISBN-0038', (select id from public.categories where name='Design'), 3, 3),
  ('Color Theory Practical', 'M. Kirana', 'LMS-ISBN-0039', (select id from public.categories where name='Design'), 2, 2),
  ('Layout & Grids', 'R. Naufal', 'LMS-ISBN-0040', (select id from public.categories where name='Design'), 6, 6),

  ('Non-Fiction: True Stories', 'I. Pertiwi', 'LMS-ISBN-0041', (select id from public.categories where name='Non-Fiction'), 5, 5),
  ('Essays on Modern Life', 'D. Akbar', 'LMS-ISBN-0042', (select id from public.categories where name='Non-Fiction'), 4, 4),
  ('Memoir of a Builder', 'S. Halim', 'LMS-ISBN-0043', (select id from public.categories where name='Non-Fiction'), 3, 3),
  ('Notes from the Field', 'A. Zahra', 'LMS-ISBN-0044', (select id from public.categories where name='Non-Fiction'), 2, 2),
  ('Stories Behind Numbers', 'M. Rizki', 'LMS-ISBN-0045', (select id from public.categories where name='Non-Fiction'), 6, 6),

  ('Comic: The Brave Librarian', 'Studio Panel', 'LMS-ISBN-0046', (select id from public.categories where name='Comics'), 8, 8),
  ('Comic: Stack Adventures', 'Panel Works', 'LMS-ISBN-0047', (select id from public.categories where name='Comics'), 6, 6),
  ('Comic: The Missing Book', 'Ink & Paper', 'LMS-ISBN-0048', (select id from public.categories where name='Comics'), 5, 5),
  ('Comic: Return Deadline', 'Drawn Studio', 'LMS-ISBN-0049', (select id from public.categories where name='Comics'), 7, 7),
  ('Comic: Catalog Quest', 'Line Art Co.', 'LMS-ISBN-0050', (select id from public.categories where name='Comics'), 4, 4)
on conflict (isbn) do nothing;

