const express = require('express');
const app = express();
const fs = require('node:fs/promises');
const formidable = require('express-formidable');

app.use(formidable());

// 设置视图目录
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// 根路径，测试服务器是否正常
app.get('/', (req, res) => {
  console.log('收到根路由請求');
  res.send('服务器正常运行');
});

// 测试 /find 路由，渲染 list.ejs
app.get('/find', (req, res) => {
  const sampleCourses = [
    { _id: '1', course_id: 'CS101', course_name: 'Intro to CS' },
    { _id: '2', course_id: 'MATH101', course_name: 'Calculus I' }
  ];
  res.render('list', { course: sampleCourses });
});

// 其他路由（示范）
app.get('/create', (req, res) => {
  res.status(200).render('create', { user: 'demo' });
});

app.post('/create', (req, res) => {
  // 这里你可以调用实际的处理函数
  res.send('Create post received (示例)');
});

app.get('/details', (req, res) => {
  // 这里也写示范
  res.send('Details page (示例)');
});

app.get('/edit', (req, res) => {
  res.send('Edit page (示例)');
});

app.post('/update', (req, res) => {
  res.send('Update request (示例)');
});

// 404捕获
app.all('*', (req, res) => {
  res.status(404).render('info', { message: `${req.path} - 未找到页面` });
});

// 启动服务器
const port = process.env.PORT || 8099;
app.listen(port, () => {
  console.log(`服务器监听端口 ${port}`);
});

