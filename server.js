const express = require('express');
const path = require('path');
const session = require('express-session');
const formidable = require('express-formidable');
const fs = require('fs');

const app = express();

// 資料夾與資料
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// 模擬資料
const mockUsers = [
  { user_id: 'student1', password: '123', username: 'Test Student', role: 'student' },
  { user_id: 'teacher1', password: '123', username: 'Test Teacher', role: 'teacher' }
];

const mockCourses = [
  { _id: '1', course_id: 'CS101', course_name: 'Introduction to Programming' },
  { _id: '2', course_id: 'MATH201', course_name: 'Advanced Mathematics' }
];

const mockAssignments = [
  { assignment_id: 'ASS001', title: 'Programming Assignment 1', course_name: 'Introduction to Programming', due_date: new Date('2025-12-31') }
];

const mockSubmissions = [];

// 中介層設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(formidable());

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// 會員驗證
const requireLogin = (req, res, next) => {
  if (req.session.userId) return next();
  res.redirect('/login');
};

// 頁面路由
app.get('/', (req, res) => {
  res.redirect('/list');
});

// login
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});
app.post('/login', (req, res) => {
  const { user_id, password } = req.fields;
  const user = mockUsers.find(u => u.user_id === user_id && u.password === password);
  if (user) {
    req.session.userId = user.user_id;
    req.session.username = user.username;
    req.session.role = user.role;
    res.redirect('/list');
  } else {
    res.render('login', { error: 'Invalid user ID or password' });
  }
});
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// 列表頁
app.get('/list', requireLogin, (req, res) => {
  res.render('list', {
    user: { user_id: req.session.userId, username: req.session.username },
    course: mockCourses
  });
});

// 詳細頁（課程）
app.get('/detail', requireLogin, (req, res) => {
  const idParam = req.query._id || req.query.course_id;
  let course = mockCourses.find(c => c._id === idParam);
  if (!course && idParam) {
    course = mockCourses.find(c => c.course_id === idParam);
  }
  if (!course) return res.redirect('/info?message=Course not found');

  // 模擬一個提交
  const submission = {
    submission_id: 'SUB-' + Date.now(),
    assignment_title: 'Sample Assignment',
    course_name: course.course_name,
    assignment_due_date: new Date('2025-12-31'),
    submission_date: new Date(),
    file_path: 'sample.pdf',
    file_type: 'application/pdf',
    file_size: 102400,
    grade: null
  };
  res.render('detail', { submission });
});

// 新增提交（Create）
app.get('/submissions/create', requireLogin, (req, res) => {
  res.render('create', { assignments: mockAssignments });
});
app.post('/submissions/create', requireLogin, (req, res) => {
  const { assignmentId } = req.fields;
  const assignment = mockAssignments.find(a => a.assignment_id === assignmentId);
  const fileName = req.files && req.files.submissionFile ? req.files.submissionFile.name : 'no-file';

  // 儲存檔案
  if (req.files && req.files.submissionFile) {
    const oldPath = req.files.submissionFile.path;
    const newPath = path.join(uploadDir, fileName);
    fs.renameSync(oldPath, newPath);
  }

  const newSub = {
    submission_id: 'SUB-' + Date.now(),
    assignment_id: assignmentId,
    assignment_title: assignment ? assignment.title : 'Unknown',
    course_name: assignment ? assignment.course_name : 'Unknown',
    assignment_due_date: assignment ? assignment.due_date : null,
    submission_date: new Date(),
    file_path: fileName,
    file_type: req.files.submissionFile ? req.files.submissionFile.type : 'unknown',
    file_size: req.files.submissionFile ? req.files.submissionFile.size : 0,
    grade: null,
    user_id: req.session.userId
  };
  mockSubmissions.push(newSub);
  res.redirect('/info?message=Submission created');
});

// 我的提交
app.get('/submissions/my-submissions', requireLogin, (req, res) => {
  const mySubs = mockSubmissions.filter(s => s.user_id === req.session.userId);
  res.render('my-submissions', { submissions: mySubs });
});

// 提交詳細（查看）
app.get('/submissions/detail/:submissionId', requireLogin, (req, res) => {
  const sub = mockSubmissions.find(s => s.submission_id === req.params.submissionId && s.user_id === req.session.userId);
  if (sub) res.render('detail', { submission: sub });
  else res.redirect('/info?message=Submission not found');
});

// 刪除提交
app.get('/submissions/delete/:submissionId', requireLogin, (req, res) => {
  const sub = mockSubmissions.find(s => s.submission_id === req.params.submissionId && s.user_id === req.session.userId);
  if (sub) res.render('delete', { submission: sub });
  else res.redirect('/info?message=Submission not found');
});
app.post('/submissions/delete', requireLogin, (req, res) => {
  const { submissionId } = req.fields;
  const index = mockSubmissions.findIndex(s => s.submission_id === submissionId && s.user_id === req.session.userId);
  if (index !== -1) {
    mockSubmissions.splice(index, 1);
    res.redirect('/info?message=Deleted');
  } else {
    res.redirect('/info?message=Deletion failed');
  }
});

// 文件下載（示意）
app.get('/submissions/download/:submissionId', requireLogin, (req, res) => {
  const sub = mockSubmissions.find(s => s.submission_id === req.params.submissionId && s.user_id === req.session.userId);
  if (sub && sub.file_path !== 'no-file') {
    const filePath = path.join(uploadDir, sub.file_path);
    res.download(filePath);
  } else {
    res.redirect('/info?message=File not found');
  }
});

// 顯示訊息頁
app.get('/info', requireLogin, (req, res) => {
  res.render('info', { message: req.query.message || 'Operation completed' });
});

// 文件上傳與刪除（你可以加入前述檔案上傳/刪除的路由）
// 例如：
app.post('/upload', (req, res) => {
  if (!req.files || !req.files.file) return res.status(400).send('No file uploaded');
  const file = req.files.file;
  const savePath = path.join(uploadDir, file.name);
  fs.renameSync(file.path, savePath);
  res.send('File uploaded');
});
app.post('/delete-file', (req, res) => {
  const filename = req.fields.filename;
  fs.unlink(path.join(uploadDir, filename), err => {
    if (err) return res.status(500).send('Delete error');
    res.send('File deleted');
  });
});

// 監聽
const PORT = process.env.PORT || 8099;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
