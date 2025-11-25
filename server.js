import { fileURLToPath } from 'url';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';
import express from 'express';
import session from 'express-session';
import formidable from 'express-formidable';
import { promises as fsPromises } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const mongourl = 'mongodb+srv://carolyan360_db_user:01110118@cluster0.55hozbc.mongodb.net/?appName=Cluster0'; // Your MongoDB connection string
const client = new MongoClient(mongourl);
const dbName = '3810gp';
const collectionasm = 'database_assignment';
const collectioncourse = 'database_course';
const collectionuser = 'database_user';
const collectionsub = 'datebase_submission';
let db;

// 在連線成功後，啟動伺服器
client.connect().then(() => {
  db = client.db(dbName);
  console.log('MongoDB connected');
 
// 中间件配置
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(formidable());
app.use(session({
  secret: 'ole-system-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// 模拟数据
const mockUsers = [
  { user_id: 'student1', password: '123', username: 'Test Student', role: 'student' },
  { user_id: 'teacher1', password: '123', username: 'Test Teacher', role: 'teacher' }
];

const mockCourses = [
  { _id: '1', course_id: 'CS101', course_name: 'Introduction to Programming' },
  { _id: '2', course_id: 'MATH201', course_name: 'Advanced Mathematics' }
];

const mockAssignments = [
  { 
    assignment_id: 'ASS001', 
    title: 'Programming Assignment 1', 
    course_name: 'Introduction to Programming',
    due_date: new Date('2025-12-31')
  }
];

const mockSubmissions = [
	{
  submission_id: 'SUB123456',
  assignment_title: 'Programming Assignment 1',
  course_name: 'Introduction to Programming',
  assignment_due_date: new Date('2025-12-31'),
  submission_date: new Date(),
  file_path: 'uploads/file1.pdf',
  file_type: 'application/pdf',
  file_size: 102400, // bytes
  grade: null,
  user_id: 'student1'
}
];

// 认证中间件
const requireLogin = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

// ==================== 页面路由 ====================

app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/list');
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { user_id, password } = req.fields;

  try {
    // **確保 db 物件已經初始化**
    if (!db) {
      console.error("Database not initialized yet.");
      return res.render('login', { error: 'Server error. Please try again later.' });
    }

    const user = await db.collection(collectionuser).findOne({ user_id: user_id }
    
    if (user && user.password === password) {
      // 驗證成功，設定 session
      req.session.userId = user.user_id;
      req.session.username = user.username;
      req.session.role = user.role;      
      res.redirect('/list'); // 或其他頁面
    } else {
      // 驗證失敗
      res.render('login', { error: 'User ID or password incorrect' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.render('login', { error: 'An error occurred. Please try again.' });
  }
});
  

app.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard', { 
    user: { 
      user_id: req.session.userId, 
      username: req.session.username 
    }
  });
});


app.get('/list', requireLogin, (req, res) => {
  res.render('list', { 
    user: { user_id: req.session.userId, username: req.session.username },
    course: mockCourses
  });
});

const submissions = await db.collection('datebase_submission').find({ user_id: req.session.userId }).toArray();

// 取得課程詳情，透過 detail.ejs 顯示 submission 資料
app.get('/detail', requireLogin, (req, res) => {
  // 可能来自 list.ejs 的兩種參數名稱：_id 或 course_id
  const idParam = req.query._id || req.query.course_id;
  console.log('detail idParam:', idParam);

  let course = mockCourses.find(c => c._id === idParam);

  if (!course && idParam) {
    course = mockCourses.find(c => c.course_id === idParam);
  }

  if (!course) {
    return res.redirect('/info?message=Course not found');
  }

  const associatedAssignment = mockAssignments.find(a => a.course_name === course.course_name);

  const submission = {
    submission_id: 'DET-' + course._id,
    assignment_title: course.course_name, // 以課程名稱作為標題，視專案需求調整
    course_name: course.course_name,
    assignment_due_date: associatedAssignment ? associatedAssignment.due_date : null,
    submission_date: new Date(),
    file_path: 'no-file',
    file_type: 'unknown',
    file_size: 0,
    grade: null,
    user_id: req.session.userId
  };

  res.render('detail', { submission: submission });
});
app.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard', { 
    user: { 
      user_id: req.session.userId, 
      username: req.session.username 
    }
  });
});


app.get('/submissions/create', requireLogin, (req, res) => {
  res.render('create', { 
    assignments: mockAssignments,
    loggedInUser: { user_id: req.session.userId }
  });
});



app.post('/submissions/create', requireLogin, (req, res) => {
  const { assignmentId, userId } = req.fields;
  
  const assignment = mockAssignments.find(a => a.assignment_id === assignmentId);
  
  const newSubmission = {
    submission_id: 'SUB' + Date.now(),
    assignment_id: assignmentId,
    user_id: userId,
    submission_date: new Date(),
    file_path: req.files.submissionFile ? req.files.submissionFile.name : 'no-file',
    file_size: req.files.submissionFile ? req.files.submissionFile.size : 0,
    file_type: 'test',
    grade: null,
    assignment_title: assignment ? assignment.title : 'Unknown',
    course_name: assignment ? assignment.course_name : 'Unknown'
  };
  
  mockSubmissions.push(newSubmission);
  res.redirect('/info?message=Assignment submitted successfully! submitted ID: ' + newSubmission.submission_id);
});

app.get('/submissions/my-submissions', requireLogin, (req, res) => {
  const userSubmissions = mockSubmissions.filter(s => s.user_id === req.session.userId);
  res.render('my-submissions', { 
    submissions: userSubmissions,
    user: { user_id: req.session.userId, username: req.session.username }
  });
});

app.get('/submissions/detail/:submissionId', requireLogin, (req, res) => {
  const submission = mockSubmissions.find(s => 
    s.submission_id === req.params.submissionId && s.user_id === req.session.userId
  );
  
  if (submission) {
    res.render('detail', { submission: submission });
  } else {
    res.redirect('/info?message=Submission record not found');
  }
});

app.get('/submissions/delete/:submissionId', requireLogin, (req, res) => {
  const submission = mockSubmissions.find(s => 
    s.submission_id === req.params.submissionId && s.user_id === req.session.userId
  );
  
  if (submission) {
    res.render('delete', { submission: submission });
  } else {
    res.redirect('/info?message=Submission record not found');
  }
});

app.post('/submissions/delete', requireLogin, (req, res) => {
  const { submissionId } = req.fields;
  const index = mockSubmissions.findIndex(s => 
    s.submission_id === submissionId && s.user_id === req.session.userId
  );
  
  if (index !== -1) {
    mockSubmissions.splice(index, 1);
    res.redirect('/info?message=Delete submission successful');
  } else {
    res.redirect('/info?message=Deletion failed: Submission record not found');
  }
});

app.get('/info', requireLogin, (req, res) => {
  const message = req.query.message || 'Operation completed';
  res.render('info', { message: message });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/list');
});
// ==================== RESTful API ====================

app.get('/api/assignments', (req, res) => {
  res.json(mockAssignments);
});

app.post('/api/assignments', (req, res) => {
  const newAssignment = {
    assignment_id: 'ASS' + Date.now(),
    ...req.fields,
    created_at: new Date()
  };
  mockAssignments.push(newAssignment);
  res.status(201).json(newAssignment);
});

app.put('/api/assignments/:id', (req, res) => {
  const assignment = mockAssignments.find(a => a.assignment_id === req.params.id);
  if (assignment) {
    Object.assign(assignment, req.fields);
    res.json(assignment);
  } else {
    res.status(404).json({ error: 'Assignment not found' });
  }
});

app.delete('/api/assignments/:id', (req, res) => {
  const index = mockAssignments.findIndex(a => a.assignment_id === req.params.id);
  if (index !== -1) {
    mockAssignments.splice(index, 1);
    res.json({ message: 'Deletion successful' });
  } else {
    res.status(404).json({ error: 'Assignment not found' });
  }
});



// Use a named parameter for the wildcard
app.all('/*', (req, res) => {
  res.status(404).render('info', { message: `${req.path} - Unknown request!` });
});

 // 啟動伺服器
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}).catch(err => {
  console.error('MongoDB connection error:', err);
});
























