const express = require('express');
const session = require('express-session');
const formidable = require('express-formidable');
const fsPromises = require('fs').promises;
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

const mongourl = 'mongodb+srv://carolyan360_db_user:01110118@cluster0.55hozbc.mongodb.net/?appName=Cluster0';
const client = new MongoClient(mongourl);
const dbName = '3810gp';

const collectionuser = 'database_user';
const collectioncourse = 'database_course';
const collectionasm = 'database_assignment';
const collectionsub = 'datebase_submission'; // 你之前打錯了，改正

let db;
client.connect().then(() => {
  db = client.db(dbName);
  console.log('MongoDB connected');
});

// 設定 EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 靜態資料夾
app.use(express.static('public'));

// 解析
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(formidable());

// Session
app.use(session({
  secret: 'ole-system-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24*3600*1000 }
}));


// 需要登入的 middleware
const requireLogin = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};

// 1. 首頁
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/list');
  } else {
    res.redirect('/login');
  }
});

// 2. 登入
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { user_id, password } = req.fields;
  try {
    const user = await db.collection(collectionuser).findOne({ user_id });
    if (user && user.password === password) {
      req.session.userId = user.user_id;
      req.session.username = user.username;
      req.session.role = user.role;
      res.redirect('/list');
    } else {
      res.render('login', { error: 'User ID or password incorrect' });
    }
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Error occurred, try again' });
  }
});

// 3. 登出
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// 4. 顯示學生課程列表
app.get('/list', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const user = await db.collection(collectionuser).findOne({ user_id: userId });
  const coursesIdArray = user ? user.course : [];

  const courses = await db.collection(collectioncourse).find({ course_id: { $in: coursesIdArray } }).toArray();

  res.render('list', { user: { user_id: userId, username: req.session.username }, course: courses });
});

// 5. 顯示課程中的作業
app.get('/detail', requireLogin, async (req, res) => {
  const courseIdParam = req.query._id || req.query.course_id;
  let course;
  try {
    course = await db.collection(collectioncourse).findOne({ _id: ObjectId(courseIdParam) }) ||
             await db.collection(collectioncourse).findOne({ course_id: courseIdParam });
  } catch (err) {
    return res.redirect('/info?message=Course not found');
  }
  if (!course) return res.redirect('/info?message=Course not found');

  const assignments = await db.collection(collectionasm).find({ course_id: course.course_id }).toArray();

  // 對每個作業，檢查是否已提交
  const userId = req.session.userId;
  const assignmentsWithStatus = await Promise.all(assignments.map(async (a) => {
    const sub = await db.collection(collectionsub).findOne({ assignment_id: a._id, user_id: userId });
    return {
      ...a,
      submitted: !!sub,
      submission: sub
    };
  }));

  res.render('detail', { course, assignments: assignmentsWithStatus });
});

// 6. 進入上傳作業頁面
app.get('/submissions/create/:assignment_id', requireLogin, async (req, res) => {
  const assignmentId = req.params.assignment_id;
  const assignment = await db.collection(collectionasm).findOne({ _id: ObjectId(assignmentId) });
  res.render('create', { assignment, loggedInUser: { user_id: req.session.userId } });
});

// 7. 上傳作業
app.post('/submissions/create', requireLogin, async (req, res) => {
  const { assignmentId, userId } = req.fields;
  const file = req.files.submissionFile;

  if (!file) {
    return res.redirect('/info?message=File upload failed');
  }

  const uploadDir = path.join(__dirname, 'public/uploads');
  const filename = Date.now() + '-' + file.name; // 加點時間戳避免重複
  const newPath = path.join(uploadDir, filename);

  // 移動檔案
  await fsPromises.rename(file.path, newPath);

  // 儲存檔案資訊到資料庫
  await db.collection(collectionsub).insertOne({
    submission_id: new ObjectId().toString(),
    assignment_id: assignmentId,
    user_id: userId,
    submission_date: new Date(),
    file_path: '/uploads/' + filename,
    file_type: file.type,
    file_size: file.size,
    grade: null
  });

  res.redirect('/info?message=Submission successful');
});

// 9. 查看單個提交細節
app.get('/submissions/detail/:submissionId', requireLogin, async (req, res) => {
  const subId = req.params.submissionId;
  const submission = await db.collection(collectionsub).findOne({ _id: ObjectId(subId), user_id: req.session.userId });
  if (!submission) return res.redirect('/info?message=Submission not found');

  res.render('detail', { submission });
});

// 10. 刪除提交
app.get('/submissions/delete/:submission_id', requireLogin, async (req, res) => {
  const subId = req.params.submission_id;
  const submission = await db.collection(collectionsub).findOne({ _id: ObjectId(subId), user_id: req.session.userId });
  if (!submission) return res.redirect('/info?message=Submission not found');
  res.render('delete', { submission });
});

app.post('/submissions/delete', requireLogin, async (req, res) => {
  const { submissionId } = req.fields;
  await db.collection(collectionsub).deleteOne({ _id: ObjectId(submissionId), user_id: req.session.userId });
  res.redirect('/info?message=Submission deleted');
});

// 11. 顯示訊息
app.get('/info', requireLogin, (req, res) => {
  const message = req.query.message || 'Operation completed';
  res.render('info', { message });
});

// 12. 其他
const port = process.env.PORT || 8099;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// 404
app.all('/*', (req, res) => {
  res.status(404).render('info', { message: `${req.path} - Not Found` });
});


