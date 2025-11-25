
var 
	express             = require('express'),
    app                 = express(),
    session             = require('express-session'),
	formidable 			= require('express-formidable'),
	fsPromises 			= require('fs').promises;

const path          = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const mongourl = 'mongodb+srv://carolyan360_db_user:01110118@cluster0.55hozbc.mongodb.net/?appName=Cluster0'; // Your MongoDB connection string
const client = new MongoClient(mongourl);
const dbName = '3810gp';
const collectionasm = 'database_assignment';
const collectioncourse = 'database_course';
const collectionuser = 'database_user';
const collectionsub = 'datebase_submission';

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

let db;
client.connect().then(() => {
  db = client.db(dbName);
  console.log('Connected to MongoDB');
});

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
    // 從資料庫取得該 user_id 的資料
    const user = await db.collection(collectionuser).findOne({ user_id: user_id });
    
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

app.get('/list', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const userDoc = await db.collection('database_user').findOne({ user_id: userId });
  const userCourses = userDoc ? userDoc.course : [];

  const courses = await db.collection('database_course').find({ course_id: { $in: userCourses } }).toArray();

  res.render('list', { user: { user_id: userId, username: req.session.username }, course: courses });
});

app.get('/detail', requireLogin, async (req, res) => {
  const courseId = req.query._id || req.query.course_id;
  const course = await db.collection('database_course').findOne({ _id: ObjectId(courseId) }) ||
                 await db.collection('database_course').findOne({ course_id: courseId });
  if (!course) return res.redirect('/info?message=Course not found');

  const assignments = await db.collection('database_assignment').find({ course_id: course.course_id }).toArray();

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


app.get('/submissions/create/:assignment_id', requireLogin, async (req, res) => {
  const assignmentId = req.params.assignment_id;
  const assignment = await db.collection('database_assignment').findOne({ _id: ObjectId(assignmentId) });
  res.render('create', { assignment, loggedInUser: { user_id: req.session.userId } });
});

app.post('/submissions/create', requireLogin, async (req, res) => {
  const { assignmentId, userId } = req.fields;
  const file = req.files.submissionFile;

  // Save file to server (ensure you handle file upload properly)
  const uploadPath = path.join(__dirname, 'public/uploads', file.name);
  await fsPromises.rename(file.path, uploadPath);

  await db.collection('datebase_submission').insertOne({
    submission_id: new ObjectId().toString(),
    assignment_id: assignmentId,
    user_id: userId,
    submission_date: new Date(),
    file_path: '/uploads/' + file.name,
    file_type: file.type,
    file_size: file.size,
    grade: null
  });

  res.redirect('/info?message=Submission successful');
});





app.get('/submissions/my-submissions', requireLogin, (req, res) => {
  const userSubmissions = mockSubmissions.filter(s => s.user_id === req.session.userId);
  res.render('my-submissions', { 
    submissions: userSubmissions,
    user: { user_id: req.session.userId, username: req.session.username }
  });
});

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


// Start server
const port = process.env.PORT || 8099;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

// Use a named parameter for the wildcard
app.all('/*', (req, res) => {
  res.status(404).render('info', { message: `${req.path} - Unknown request!` });
});










