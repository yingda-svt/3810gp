/* 
Controllers - express modules
-----------------------------
express-formiddable: https://www.npmjs.com/package/express-formidable
- express-formidable can basically parse form types, including application/x-www-form-urlencoded, application/json, and multipart/form-data.
-----------------------------
fs/promises: https://nodejs.org/zh-tw/learn/manipulating-files/reading-files-with-nodejs
-----------------------------
*/
const express = require('express');
const app = express();
const fs = require('node:fs/promises');
const formidable = require('express-formidable'); 
app.use(formidable());

/* Model - mongodb modules
mongodb ^6.9: https://www.npmjs.com/package/mongodb
*/
const { MongoClient, ObjectId } = require("mongodb");
const mongourl = '';
const client = new MongoClient(mongourl); 
const dbName = 'project_samples';
const collectionName = "bookings";

// Views
app.set('view engine', 'ejs');

const insertDocument = async (db, doc) => {
    var collection = db.collection(collectionName);
    let results = await collection.insertOne(doc);
	console.log("insert one document:" + JSON.stringify(results));
    return results;

}

const findDocument = async (db, criteria) => {
	let findResults = [];
	let collection = db.collection(collectionName);
	console.log(`findCriteria: ${JSON.stringify(criteria)}`);
   	findResults = await collection.find(criteria).toArray();
	console.log(`findDocument: ${findResults.length}`);
	console.log(`findResults: ${JSON.stringify(findResults)}`);
	return findResults;
};

const updateDocument = async (db, criteria, updateDoc) => {
    let updateResults = [];
	let collection = db.collection(collectionName);
	console.log(`updateCriteria: ${JSON.stringify(criteria)}`);
   	updateResults = await collection.updateOne(criteria,{$set : updateDoc});
	console.log(`updateResults: ${JSON.stringify(updateResults)}`);
	return updateResults;
}

const handle_Create = async (req, res) => {
	await client.connect();
	console.log("Connected successfully to server");
    const db = client.db(dbName);
    let newDoc = {
        bookingid: req.fields.bookingid,
        mobile: req.fields.mobile
	};

	if (req.files.filetoupload && req.files.filetoupload.size > 0) {
		const data = await fsPromises.readFile(req.files.filetoupload.path);
		newDoc.photo = Buffer.from(data).toString('base64');
	}
	await insertDocument(db, newDoc);
    res.redirect('/');
}
	/* create.js
	<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Upload Homework Submission</title>
</head>
<body>
    <h1>Upload Homework Submission</h1>
    <form action="/submissions/create" method="POST" enctype="multipart/form-data">
        <!-- Select Assignment (linked to Course via assignment_id in Database) -->
        <p>
            <label for="assignmentId">Select Assignment:</label>
            <select name="assignmentId" id="assignmentId" required>
                <% if (assignments && assignments.length > 0) { %>
                    <% assignments.forEach(assignment => { %>
                        <option value="<%= assignment.assignment_id %>">
                            <%= assignment.title %> (Course: <%= assignment.course_name %> | Due: <%= new Date(assignment.due_date).toLocaleDateString() %>)
                        </option>
                    <% }) %>
                <% } else { %>
                    <option disabled>No assignments available for your courses</option>
                <% } %>
            </select>
        </p>

        <!-- Upload Submission File -->
        <p>
            <label for="submissionFile">Upload Homework File:</label>
            <input type="file" name="submissionFile" id="submissionFile" accept=".pdf,.doc,.docx,.txt,.jpg,.png" required>
            <br>
            <small>Supported formats: PDF, Word, TXT, Images (Max size: 10MB)</small>
        </p>

        <!-- Hidden Fields: Link to Logged-in User & Auto-set Submission Date (handled by backend) -->
        <input type="hidden" name="userId" value="<%= loggedInUser.user_id %>">
        <button type="submit">Submit Homework</button>
    </form>
    <p><a href="/dashboard">Back to Student Dashboard</a></p>
</body>
</html>
	*/


const handle_Find = async (res, criteria) => {
	await client.connect();
	console.log("Connected successfully to server");
	const db = client.db(dbName);
    const docs = await findDocument(db, criteria);
	await client.close();
    console.log("Closed DB connection");
    res.status(200).render('list',{nBookings: docs.length, bookings: docs});
    
    /* list.ejs
	<html>
		<body>
		    <H2>Bookings (<%= nBookings %>)</H2>
		    <ul>
		        <% for (var b of bookings) { %>
		        <li>Booking ID: <a href="/details?_id=<%= b._id %>"><%= b.bookingid %></a></li>
		        <% } %>
		    </ul>
		</body>
	</html>
		*/
}

const handle_Details = async (res, criteria) => {
    await client.connect();
	console.log("Connected successfully to server");
	const db = client.db(dbName);
    /* use Document ID for query */
    let DOCID = {};
    DOCID['_id'] = new ObjectId(criteria._id);
	const docs = await findDocument(db, DOCID); 
	await client.close();
    console.log("Closed DB connection");
    res.status(200).render('details', {booking: docs[0]});
    
    /* details.ejs
	<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Submission Details - <%= submission.assignment_title %></title>
</head>
<body>
    <h1>Homework Submission Details</h1>
    
    <p><strong>Associated Assignment:</strong> <%= submission.assignment_title %></p>
    <p><strong>Course Name:</strong> <%= submission.course_name %></p>
    <p><strong>Assignment Due Date:</strong> <%= new Date(submission.assignment_due_date).toLocaleDateString() %></p>
    <p><strong>Your Submission Date:</strong> <%= new Date(submission.submission_date).toLocaleString() %></p>
    <p><strong>Submitted File Path:</strong> <%= submission.file_path %></p>
    <p><strong>File Type:</strong> <%= submission.file_type || "Unknown" %></p>
    <p><strong>File Size:</strong>
        <% 
            const sizeInKB = (submission.file_size / 1024).toFixed(2);
            const sizeInMB = (sizeInKB / 1024).toFixed(2);
            const readableSize = sizeInMB >= 1 ? `${sizeInMB} MB` : `${sizeInKB} KB`;
        %>
        <%= readableSize %>
    </p>
    <p><strong>Grade:</strong> <%= submission.grade || "Your submission is pending grading" %></p>

    <p>
        <a href="/submissions/download/<%= submission.submission_id %>">Download Submitted File</a> |
        <a href="/submissions/delete/<%= submission.submission_id %>">Delete This Submission</a>
    </p>

    <p>
        <a href="/submissions/my-submissions">Back to My Submissions</a> |
        <a href="/dashboard">Back to Student Dashboard</a>
    </p>
</body>
</html>
    */
}

const handle_Edit = async (res, criteria) => {
    await client.connect();
	console.log("Connected successfully to server");
	const db = client.db(dbName);
    /* use Document ID for query */
    let DOCID = {};
    DOCID['_id'] = new ObjectId(criteria._id)
	const docs = await findDocument(db, DOCID); 
	await client.close();
    console.log("Closed DB connection");
    res.status(200).render('edit',{booking: docs[0]});
    /* edit.ejs
	<html>
		<body>
		    <form action="/update" method="POST" enctype="multipart/form-data">
		        Booking ID: <input name="bookingid" value=<%= booking.bookingid %>><br>
		        Mobile: <input name="mobile" value=<%= booking.mobile %> /><br>
		        <input type="file" name="filetoupload"><br>
		        <input type="hidden" name="_id" value=<%= booking._id %>>
		        <input type="submit" value="update">  
		    </form>
		</body>
	</html>
    */
}

const handle_Update = async (req, res, criteria) => {
	await client.connect();
	console.log("Connected successfully to server");
	const db = client.db(dbName);
        var DOCID = {};
        DOCID['_id'] = new ObjectId(req.fields._id);
        var updateDoc = {};
        updateDoc['bookingid'] = req.fields.bookingid;
        updateDoc['mobile'] = req.fields.mobile;
        if (req.files.filetoupload.size > 0) {
			const data = await fs.readFile(req.files.filetoupload.path, { encoding: 'base64' });
			updateDoc['photo'] = new Buffer.from(data);
            const results = await updateDocument(db, DOCID, updateDoc);
			await client.close();
    		console.log("Closed DB connection");
			res.status(200).render('info', {message: `Updated ${results.modifiedCount} document(s)`})
        } else {
            const results = await updateDocument(db, DOCID, updateDoc);
			await client.close();
    		console.log("Closed DB connection");
			res.status(200).render('info', {message: `Updated ${results.modifiedCount} document(s)`})
        }
	    /* delete.ejs
			<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Confirm Submission Deletion</title>
</head>
<body>
    <h1>Confirm Homework Submission Deletion</h1>
    <div>
        <h3>Warning!</h3>
        <p>This action cannot be undone. You will permanently delete the following submission:</p>
    </div>

    <!-- Display Submission Details (linked to Assignment & User via Database) -->
    <div>
        <p><strong>Associated Assignment:</strong> <%= submission.assignment_title %></p>
        <p><strong>Course:</strong> <%= submission.course_name %></p>
        <p><strong>Submission Date:</strong> <%= new Date(submission.submission_date).toLocaleString() %></p>
        <p><strong>File Path:</strong> <%= submission.file_path %></p>
        <p><strong>Current Grade:</strong> <%= submission.grade || "Not graded yet" %></p>
    </div>

    <form action="/submissions/delete" method="POST">
        <!-- Hidden Field: Submission ID to Target Deletion -->
        <input type="hidden" name="submissionId" value="<%= submission.submission_id %>">
        <button type="submit">Confirm Delete</button>
        <a href="/submissions/my-submissions">Cancel (Back to My Submissions)</a>
    </form>
</body>
</html>
            */
}

app.get('/', (req,res) => {
    res.redirect('/find');
})

app.get('/create', (req,res) => {
    res.status(200).render('create',{user: 'demo'})
})

app.post('/create', (req, res) => {
    handle_Create(req, res);
})

app.get('/find', (req,res) => {
    handle_Find(res, req.query.docs);
})

app.get('/details', (req,res) => {
    handle_Details(res, req.query);
})

app.get('/edit', (req,res) => {
    handle_Edit(res, req.query);
})

app.post('/update', (req,res) => {
    handle_Update(req, res, req.query);
})

app.get('/{*splat}', (req,res) => {
    //res.status(404).send(`${req.path} - Unknown request!`);
    res.status(404).render('info', {message: `${req.path} - Unknown request!` });
    /* info.ejs
	<html>
		<body>
			<b><%= message %></b>
			<p><a href="/">home</a></p>
		</body>
	</html>
    */
})

app.listen(app.listen(process.env.PORT || 8099));

