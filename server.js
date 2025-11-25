import { fileURLToPath } from 'url';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb'; // 匯入 ObjectId
import express from 'express';
import session from 'express-session';
import formidable from 'express-formidable';
import MongoStore from 'connect-mongo'; // 用於 MongoDB session 儲存
import { promises as fsPromises } from 'fs'; // 引入 fsPromises

// --- 常數定義 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 獲取 port，優先使用環境變數，否則預設為 3000
const port = process.env.PORT || 3000;

// MongoDB 連線設定
const mongourl = 'mongodb+srv://carolyan360_db_user:01110118@cluster0.55hozbc.mongodb.net/?appName=Cluster0'; // 您的 MongoDB 連線字串
const dbName = '3810gp';
const collectionUser = 'database_user'; // 修正 collection 名稱
const collectionCourse = 'database_course'; // 修正 collection 名稱
const collectionAssignment = 'database_assignment'; // 修正 collection 名稱
const collectionSubmission = 'datebase_submission'; // 保持原名稱，但建議修正為 database_submission

// --- Express 應用程式初始化 ---
const app = express();

// --- MongoDB 連線設定 ---
const client = new MongoClient(mongourl);
let db; // 這個 db 物件將在連線成功後被初始化

// --- Session 設定 (使用 MongoStore) ---
const sessionStore = new MongoStore({
    mongoUrl: mongourl,
    dbName: dbName,
    collectionName: 'sessions' // 用於儲存 sessions 的 collection 名稱
});

// --- 中介軟體 (Middleware) 配置 ---
app.set('view engine', 'ejs'); // 設定 EJS 為模板引擎
app.set('views', path.join(__dirname, 'views')); // 設定視圖文件夾路徑

app.use(express.static('public')); // 提供 'public' 目錄下的靜態文件
app.use(express.urlencoded({ extended: true })); // 解析 URL 編碼的請求體
app.use(express.json()); // 解析 JSON 格式的請求體
app.use(formidable()); // 解析表單數據和文件上傳

app.use(session({
    secret: 'YOUR_SUPER_SECRET_KEY_CHANGE_ME_FOR_PRODUCTION_1234567890', // **請務必更改為強密碼**
    resave: false,
    saveUninitialized: false,
    store: sessionStore, // 使用 MongoDB 作為 session 儲存
    cookie: {
        secure: process.env.NODE_ENV === 'production', // 在生產環境中只透過 HTTPS 傳輸 cookie
        maxAge: 24 * 60 * 60 * 1000 // cookie 有效期為 1 天
    }
}));

// --- 模擬資料 (用於開發和測試，最終應替換為 MongoDB 查詢) ---
// 這些模擬資料僅用於展示結構，實際應用中應從資料庫讀取
const mockUsers = [
    { user_id: 'student1', password: '123', username: 'Test Student', role: 'student' },
    { user_id: 'teacher1', password: '123', username: 'Test Teacher', role: 'teacher' }
];

const mockCourses = [
    { _id: new ObjectId(), course_id: 'CS101', course_name: 'Introduction to Programming' },
    { _id: new ObjectId(), course_id: 'MATH201', course_name: 'Advanced Mathematics' }
];

const mockAssignments = [
    {
        _id: new ObjectId(), // 建議使用 ObjectId 作為 _id
        assignment_id: 'ASS001',
        title: 'Programming Assignment 1',
        course_name: 'Introduction to Programming',
        due_date: new Date('2025-12-31')
    }
];

const mockSubmissions = [
    {
        _id: new ObjectId(), // 建議使用 ObjectId 作為 _id
        submission_id: 'SUB123456',
        assignment_id: 'ASS001', // 連結到 assignment
        assignment_title: 'Programming Assignment 1',
        course_name: 'Introduction to Programming',
        assignment_due_date: new Date('2025-12-31'),
        submission_date: new Date(),
        file_path: 'uploads/file1.pdf',
        file_type: 'application/pdf',
        file_size: 102400, // bytes
        grade: null,
        user_id: 'student1' // 連結到 user
    }
];

// --- 認證中介軟體 ---
const requireLogin = (req, res, next) => {
    if (req.session.userId) {
        return next(); // 使用者已登入，繼續處理請求
    }
    // 使用者未登入，重定向到登入頁面
    res.redirect('/login');
};

// --- 路由 (Routes) ---

// 根目錄: 根據登入狀態跳轉
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/list'); // 已登入，跳轉到課程列表
    } else {
        res.redirect('/login'); // 未登入，跳轉到登入頁面
    }
});

// 登入頁面 (GET)
app.get('/login', (req, res) => {
    res.render('login', { error: null }); // 渲染登入頁面，並傳入錯誤訊息 (初始為 null)
});

// 登入處理 (POST)
app.post('/login', async (req, res) => {
    const { user_id, password } = req.fields;

    try {
        // 確保 db 物件已初始化
        if (!db) {
            console.error("Database not initialized yet.");
            return res.render('login', { error: 'Server error. Please try again later.' });
        }

        // 從資料庫查詢使用者
        const user = await db.collection(collectionUser).findOne({ user_id: user_id });

        if (user && user.password === password) {
            // 驗證成功，設定 session
            req.session.userId = user.user_id;
            req.session.username = user.username;
            req.session.role = user.role;
            console.log(`User logged in: ${user.username} (${user.user_id})`);
            res.redirect('/list'); // 跳轉到課程列表
        } else {
            // 驗證失敗
            res.render('login', { error: 'User ID or password incorrect' });
        }
    } catch (err) {
        console.error('Error during login:', err);
        res.render('login', { error: 'An error occurred during login. Please try again.' });
    }
});

// 登出
app.get('/logout', (req, res) => {
    req.session.destroy((err) => { // 銷毀 session
        if (err) {
            console.error('Session destruction error:', err);
            return res.redirect('/info?message=Error logging out.');
        }
        console.log(`User logged out: ${req.session.username}`);
        res.redirect('/login'); // 重定向到登入頁面
    });
});

// 儀表板 (Dashboard) - 需要登入
app.get('/dashboard', requireLogin, async (req, res) => {
    try {
        // 這裡可以從資料庫獲取更多儀表板相關資料
        // 例如：學生的課程列表、老師的課程列表、待處理的作業等
        // 為了簡化，目前只顯示登入的使用者資訊
        res.render('dashboard', {
            user: {
                user_id: req.session.userId,
                username: req.session.username,
                role: req.session.role
            }
        });
    } catch (err) {
        console.error('Error loading dashboard:', err);
        res.status(500).send('Error loading dashboard.');
    }
});

// 課程列表 (List) - 需要登入
app.get('/list', requireLogin, async (req, res) => {
    try {
        // 確保 db 物件已初始化
        if (!db) {
            console.error("Database not initialized yet.");
            return res.status(500).send("Server error. Database not ready.");
        }
        // 實際應用中，從資料庫獲取課程列表
        const courses = await db.collection(collectionCourse).find({}).toArray();
        res.render('list', {
            user: { user_id: req.session.userId, username: req.session.username },
            course: courses // 使用從資料庫獲取的課程資料
        });
    } catch (err) {
        console.error('Error fetching course list:', err);
        res.status(500).send('Error loading course list.');
    }
});

// 課程詳情頁面 (Detail) - 需要登入
// 此頁面可能用於顯示特定課程的作業和學生的提交情況
app.get('/detail', requireLogin, async (req, res) => {
    const courseIdParam = req.query.course_id; // 假設從 query 參數獲取課程 ID

    if (!courseIdParam) {
        return res.redirect('/info?message=Course ID is required.');
    }

    try {
        // 確保 db 物件已初始化
        if (!db) {
            console.error("Database not initialized yet.");
            return res.status(500).send("Server error. Database not ready.");
        }

        // 1. 獲取課程資訊
        const course = await db.collection(collectionCourse).findOne({ _id: new ObjectId(courseIdParam) }); // 使用 ObjectId 查詢
        if (!course) {
            return res.redirect('/info?message=Course not found.');
        }

        // 2. 獲取與此課程相關的作業
        const assignments = await db.collection(collectionAssignment).find({ course_name: course.course_name }).toArray();

        // 3. 獲取該使用者針對此課程的所有提交記錄
        const userSubmissions = await db.collection(collectionSubmission).find({
            user_id: req.session.userId,
            course_name: course.course_name
        }).toArray();

        // 組織要顯示的數據
        // 這部分邏輯需要根據您的具體需求來決定如何展示
        // 例如，您可以顯示課程資訊、所有作業以及每個作業的提交狀態/分數
        const courseDetails = {
            course: course,
            assignments: assignments.map(assignment => {
                const submission = userSubmissions.find(sub => sub.assignment_id === assignment._id.toString()); // 假設 assignment._id 是字串形式儲存在 submission.assignment_id
                return {
                    ...assignment,
                    submissionStatus: submission ? 'Submitted' : 'Not Submitted',
                    submissionId: submission ? submission._id.toString() : null,
                    grade: submission ? submission.grade : null
                };
            })
        };

        res.render('detail', {
            user: { user_id: req.session.userId, username: req.session.username },
            courseDetails: courseDetails
        });

    } catch (err) {
        console.error('Error fetching course detail:', courseIdParam, err);
        res.status(500).send('Error loading course detail page.');
    }
});


// 提交作業頁面 (Create Submission) - 需要登入
app.get('/submissions/create', requireLogin, async (req, res) => {
    const assignmentId = req.query.assignment_id; // 假設從 query 參數獲取作業 ID

    if (!assignmentId) {
        return res.redirect('/info?message=Assignment ID is required to create a submission.');
    }

    
