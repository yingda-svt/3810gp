
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
  try {
    const user = await db.collection('database_user').findOne({ user_id });
    if (user && user.password === password) {
      req.session.userId = user.user_id;
      req.session.username = user.username;
      req.session.role = user.role;

      req.session.save(err => {
        if (err) console.error('Session save error:', err);
        res.redirect('/list');
      });
    } else {
      res.render('login', { error: 'User ID or password incorrect' });
    }
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).send('Server error');
  }
});

// 路由：登出
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});
    

// 路由：學生課程列表
app.get('/list', requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const username = req.session.username;

    const userDoc = await db.collection('database_user').findOne({ user_id: userId });
    if (!userDoc) {
      return res.status(404).send('User data not found');
    }

    // 取得 user 的 course_id 陣列，不再查詢 datebase_course
    let courseIdsArray = [];
    if (Array.isArray(userDoc?.course_id)) {
      courseIdsArray = userDoc.course_id;
    } else if (userDoc?.course_id != null) {
      courseIdsArray = [userDoc.course_id];
    }

    // 傳遞給前端：只是課程 ID 的陣列
    res.render('list', {
      user: {
        user_id: userId,
        username: username
      },
      course: courseIdsArray // 這是一個 Array，內容是 course_id
    });

  } catch (err) {
    console.error('Error in /list:', err);
    res.status(500).send('Server error: ' + err.message);
  }
});


// 路由：課程詳細
// 假設你有 requireLogin 中介軟體
app.get('/detail', requireLogin, async (req, res) => {
  const courseId = req.query.course_id;
  if (!courseId) {
    return res.redirect('/list');
  }

  try {
    // 取得該課程的所有作業
    const assignments = await db.collection('3810gp.datebase_assignment').find({ course_id: courseId }).toArray();
res.render('detail', {
  course: { course_id: courseId },
  assignments: assignments
});
    });
  } catch (err) {
    console.error('Error in /detail:', err);
    res.status(500).send('Server error');
  }
});


// 路由：提交作業
app.post('/submissions/create', requireLogin, async (req, res) => {
  const { assignmentId, userId } = req.fields;
  const file = req.files.submissionFile;

  if (!file) {
    return res.redirect('/info?message=File upload failed');
  }

  const uploadDir = path.join(__dirname, 'public/uploads');
  const filename = Date.now() + '-' + file.name;
  const newPath = path.join(uploadDir, filename);
  await fsPromises.rename(file.path, newPath);

  await db.collection('database_submission').insertOne({
    assignment_id: assignmentId,
    course_id: req.query.course_id, // 可傳遞或在前端傳入
    user_id: userId,
    submission_date: new Date(),
    file_path: '/uploads/' + filename,
    file_type: file.type,
    file_size: file.size,
    grade: null
  });
  res.redirect('/detail?course_id=' + req.query.course_id);
});

// 路由：刪除提交
app.post('/submissions/delete', requireLogin, async (req, res) => {
  const { submissionId } = req.fields;
  // 先找出要刪除的檔案路徑
  const sub = await db.collection('database_submission').findOne({ _id: ObjectId(submissionId) });
  if (!sub) {
    return res.redirect('/info?message=Submission not found');
  }
  // 刪除檔案
  const filePath = path.join(__dirname, 'public', sub.file_path);
  await fsPromises.unlink(filePath).catch(() => {});
  // 刪除資料庫記錄
  await db.collection('database_submission').deleteOne({ _id: ObjectId(submissionId) });
  res.redirect('/detail?course_id=' + req.query.course_id);
});

// 顯示訊息
app.get('/info', requireLogin, (req, res) => {
  const message = req.query.message || 'Operation completed';
  res.render('info', { message });
});

// 取得所有課程
app.get('/courses', async (req, res) => {
  const courses = await db.collection('database_course').find().toArray();
  res.json(courses);
});

// 建立新課程
app.post('/courses', async (req, res) => {
  const newCourse = req.body; // 需驗證資料
  const result = await db.collection('database_course').insertOne(newCourse);
  res.status(201).json({ id: result.insertedId });
});

// 取得特定課程
app.get('/courses/:id', async (req, res) => {
  const course = await db.collection('database_course').findOne({ _id: ObjectId(req.params.id) });
  if (!course) return res.status(404).json({ message: 'Not found' });
  res.json(course);
});

// 更新課程
app.put('/courses/:id', async (req, res) => {
  await db.collection('database_course').updateOne({ _id: ObjectId(req.params.id) }, { $set: req.body });
  res.json({ message: 'Updated' });
});

// 刪除課程
app.delete('/courses/:id', async (req, res) => {
  await db.collection('database_course').deleteOne({ _id: ObjectId(req.params.id) });
  res.json({ message: 'Deleted' });
});

// 404：用 app.use() 來捕捉所有未定義路由，避免 PathError
app.use((req, res) => {
  res.status(404).render('info', { message: `${req.path} - Not Found` });
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});


























