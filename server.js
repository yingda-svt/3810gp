var 
	express             = require('express'),
    app                 = express(),
    session             = require('express-session'),
	formidable 			= require('express-formidable'),
	fsPromises 			= require('fs').promises;

const path          = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const mongourl = 'mongodb+srv://s1404001:14040010@cluster0.llkhaon.mongodb.net/?appName=Cluster0'; // Your MongoDB connection string
const client = new MongoClient(mongourl);
const dbName = 'samples_mflix';
const collectionName = 'comments';

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
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

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
    res.render('login', { error: 'userID or password wrong, try  student1/123' });
  }
});

app.get('/list', requireLogin, (req, res) => {
  res.render('list', { 
    user: { user_id: req.session.userId, username: req.session.username },
    course: mockCourses
  });
});

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
  res.redirect('/login');
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
























