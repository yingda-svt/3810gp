# List courses
curl -X GET https://three810gp43.onrender.com/api/courses -H "Accept: application/json"

# Create course
curl -X POST https://three810gp43.onrender.com/api/courses
-H "Content-Type: application/json"
-d '{"title":"Math 101","code":"MATH101","teacher":"<teacherId>","schedule":"Mon 10:00","description":"Intro to Math"}'

# Update course
curl -X PUT https://three810gp43.onrender.com/api/courses/<courseId> 
  -H "Content-Type: application/json" 
  -d '{"title":"Advanced Math 101","isActive":true}'

# Delete course
curl -X DELETE https://three810gp43.onrender.com/api/courses/<courseId>