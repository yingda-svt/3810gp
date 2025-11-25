const express = require('express');
const session = require('express-session');
const formidable = require('express-formidable');
const { promises: fsPromises } = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 8099;

// MongoDB 設定
const mongourl = 'mongodb+srv://carolyan360_db_user:01110118@cluster0.55hozbc.mongodb.net/?appName=Cluster0'; // 請填入你的連線字串
const dbName = '3810gp';

let db;
const client = new MongoClient(mongourl);

// 設定 view engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(formidable()); // 解析 form-data

// 自訂 Memory Store（不使用 Express 內建的 MemoryStore）
class CustomMemoryStore extends session.Store {
  constructor() {
    super();
    this.sessions = new Map();
  }
  get(sid, callback) {
    const sess = this.sessions.get(sid);
    callback(null, sess ? JSON.parse(JSON.stringify(sess)) : null);
  }
  set(sid, sess, callback) {
    this.sessions.set(sid, JSON.parse(JSON.stringify(sess)));
    callback && callback(null);
  }
  destroy(sid, callback) {
    this.sessions.delete(sid);
    callback && callback(null);
  }
  touch(sid, sess, callback) {
    this.set(sid, sess, callback);
  }
}

const myStore = new CustomMemoryStore();

// 只保留一個 session 中介軟體，放在最前面
app.use(session({
  secret: 'ole-system-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  store: myStore,
  cookie: { secure: false, maxAge: 24 * 3600 * 1000 }
}));

// 連線MongoDB
(async () => {
  try {
    await client.connect();
    db = client.db(dbName);
    console.log('MongoDB 連線成功');

    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (err) {
    console.error('MongoDB 連線失敗:', err);
    process.exit(1);
  }
})();

// 中介軟體：驗證登入
function requireLogin(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// 路由：首頁
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    res.redirect('/list');
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// 路由：登入
app.post('/login', async (req, res) => {
  const { user_id, password } = req.fields;
  const user = await db.collection('database_user').findOne({ user_id });
  if (user && user.password === password) {
    req.session.userId = user.user_id;
    req.session.username = user.username;
    req.session.role = user.role;

// 路由：登出
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});
    
// 確保 session 寫入完成再導向
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
      res.redirect('/list');
    });
  } else {
    res.render('login', { error: 'User ID or password incorrect' });
  }
});

// 路由：學生課程列表
app.get('/list', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const userDoc = await db.collection('database_user').findOne({ user_id: userId });
  
  // 取得學生名字
  const username = req.session.username; // 從 session 讀取
  
  // 取得學生的課程清單
  const coursesIdArray = userDoc ? userDoc.course : [];
  const courses = await db.collection('database_course').find({ course_id: { $in: coursesIdArray } }).toArray();

  res.render('list', {
    user: {
      user_id: userId,
      username: username
    },
    course: courses
  });
});

app.post('/login', async (req, res) => {
  const { user_id, password } = req.fields;
  const user = await db.collection('database_user').findOne({ user_id });
  if (user && user.password === password) {
    req.session.userId = user.user_id;
    req.session.username = user.username;
    req.session.role = user.role;

    // 確保 session 儲存完再跳轉
    req.session.save(err => {
      if (err) console.error('Session save error:', err);
      res.redirect('/list');
    });
  } else {
    res.render('login', { error: 'User ID or password incorrect' });
  }
});

// 路由：課程詳細
app.get('/detail', requireLogin, async (req, res) => {
  const courseId = req.query._id || req.query.course_id;
  let course;
  try {
    course = await db.collection('database_course').findOne({ _id: ObjectId(courseId) }) ||
             await db.collection('database_course').findOne({ course_id: courseId });
  } catch (err) {
    return res.redirect('/info?message=Course not found');
  }
  if (!course) return res.redirect('/info?message=Course not found');

  const assignments = await db.collection('database_assignment').find({ course_id: course.course_id }).toArray();

  // 檢查是否已提交
  const userId = req.session.userId;
  const assignmentsWithStatus = await Promise.all(assignments.map(async (a) => {
    const sub = await db.collection('datebase_submission').findOne({ assignment_id: a._id, user_id: userId });
    return {
      ...a,
      submitted: !!sub,
      submission: sub
    };
  }));

  res.render('detail', { course, assignments: assignmentsWithStatus });
});

// 路由：上傳作業頁面
app.get('/submissions/create/:assignment_id', requireLogin, async (req, res) => {
  const assignmentId = req.params.assignment_id;
  const assignment = await db.collection('database_assignment').findOne({ _id: ObjectId(assignmentId) });
  res.render('create', { assignment, loggedInUser: { user_id: req.session.userId } });
});

// 路由：提交作業
app.post('/submissions/create', requireLogin, async (req, res) => {
  const { assignmentId, userId } = req.fields;
  const file = req.files.submissionFile;

  if (!file) {
    return res.redirect('/info?message=File upload failed');
  }

  const uploadDir = path.join(__dirname, 'public/uploads');
  const filename = Date.now() + '-' + file.name; // 避免覆蓋
  const newPath = path.join(uploadDir, filename);
  await fsPromises.rename(file.path, newPath);

  await db.collection('datebase_submission').insertOne({
    submission_id: new ObjectId(),
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

// 路由：我的提交
app.get('/submissions/my-submissions', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const submissions = await db.collection('datebase_submission').find({ user_id: userId }).toArray();
  res.render('my-submissions', { submissions, user: { user_id: userId, username: req.session.username } });
});

// 路由：單一提交細節
app.get('/submissions/detail/:submissionId', requireLogin, async (req, res) => {
  const subId = req.params.submissionId;
  const submission = await db.collection('datebase_submission').findOne({ _id: ObjectId(subId), user_id: req.session.userId });
  if (!submission) return res.redirect('/info?message=Submission not found');
  res.render('detail', { submission });
});

// 路由：刪除提交
app.get('/submissions/delete/:submission_id', requireLogin, async (req, res) => {
  const subId = req.params.submission_id;
  const submission = await db.collection('datebase_submission').findOne({ _id: ObjectId(subId), user_id: req.session.userId });
  if (!submission) return res.redirect('/info?message=Submission not found');
  res.render('delete', { submission });
});

app.post('/submissions/delete', requireLogin, async (req, res) => {
  const { submissionId } = req.fields;
  await db.collection('datebase_submission').deleteOne({ _id: ObjectId(submissionId), user_id: req.session.userId });
  res.redirect('/info?message=Submission deleted');
});

// 顯示訊息
app.get('/info', requireLogin, (req, res) => {
  const message = req.query.message || 'Operation completed';
  res.render('info', { message });
});

// 404：用 app.use() 來捕捉所有未定義路由，避免 PathError
app.use((req, res) => {
  res.status(404).render('info', { message: `${req.path} - Not Found` });
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});




