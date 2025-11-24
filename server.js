const express = require('express');
const app = express();
const fs = require('node:fs/promises');
const formidable = require('express-formidable'); 
app.use(formidable());

const { MongoClient, ObjectId } = require('mongodb');
const mongourl = 'mongodb+srv://carolyan360_db_user:01110118@cluster0.55hozbc.mongodb.net/?appName=Cluster0'; // Your MongoDB connection string
const client = new MongoClient(mongourl);
const dbName = 'samples_mflix';
const collectionName = 'comments';

app.set('view engine', 'ejs');

// Helper functions
const insertDocument = async (db, doc) => {
  const collection = db.collection(collectionName);
  const results = await collection.insertOne(doc);
  console.log("Inserted document:", results);
  return results;
};

const findDocument = async (db, criteria) => {
  const collection = db.collection(collectionName);
  console.log(`Finding with criteria: ${JSON.stringify(criteria)}`);
  const results = await collection.find(criteria).toArray();
  console.log(`Found ${results.length} documents`);
  return results;
};

const updateDocument = async (db, criteria, updateDoc) => {
  const collection = db.collection(collectionName);
  const results = await collection.updateOne(criteria, { $set: updateDoc });
  console.log(`Update results: ${JSON.stringify(results)}`);
  return results;
};

// Handlers
const handle_Create = async (req, res) => {
  await client.connect();
  console.log('Connected to MongoDB');
  const db = client.db(dbName);
  const newDoc = {
    bookingid: req.fields.bookingid,
    mobile: req.fields.mobile
  };

  if (req.files.filetoupload && req.files.filetoupload.size > 0) {
    const data = await fs.readFile(req.files.filetoupload.path);
    newDoc.photo = Buffer.from(data).toString('base64');
  }

  await insertDocument(db, newDoc);
  await client.close();
  console.log('Disconnected from MongoDB');
  res.redirect('/');
};

const handle_Find = async (res, criteria) => {
  await client.connect();
  console.log('Connected to MongoDB');
  const db = client.db(dbName);
  const docs = await findDocument(db, criteria);
  await client.close();
  console.log('Disconnected from MongoDB');
  res.status(200).render('list', { nBookings: docs.length, bookings: docs });
};

const handle_Details = async (res, criteria) => {
  await client.connect();
  console.log('Connected to MongoDB');
  const db = client.db(dbName);
  const DOCID = { _id: new ObjectId(criteria._id) };
  const docs = await findDocument(db, DOCID);
  await client.close();
  console.log('Disconnected from MongoDB');
  res.status(200).render('details', { booking: docs[0] });
};

const handle_Edit = async (res, criteria) => {
  await client.connect();
  console.log('Connected to MongoDB');
  const db = client.db(dbName);
  const DOCID = { _id: new ObjectId(criteria._id) };
  const docs = await findDocument(db, DOCID);
  await client.close();
  console.log('Disconnected from MongoDB');
  res.status(200).render('edit', { booking: docs[0] });
};

const handle_Update = async (req, res) => {
  await client.connect();
  console.log('Connected to MongoDB');
  const db = client.db(dbName);
  const DOCID = { _id: new ObjectId(req.fields._id) };
  const updateDoc = {
    bookingid: req.fields.bookingid,
    mobile: req.fields.mobile
  };

  if (req.files.filetoupload && req.files.filetoupload.size > 0) {
    const data = await fs.readFile(req.files.filetoupload.path);
    updateDoc.photo = Buffer.from(data).toString('base64');
  }

  const results = await updateDocument(db, DOCID, updateDoc);
  await client.close();
  console.log('Disconnected from MongoDB');
  res.status(200).render('info', { message: `Updated ${results.modifiedCount} document(s)` });
};

// Routes
app.set('views', __dirname + '/views');

app.get('/', (req,res) => {
    res.redirect('/find');
})

app.get('/find', (req,res) => {
    handle_Find(res, req.query.docs);
})

app.get('/create', (req, res) => {
  res.status(200).render('create', { user: 'demo' });
});

app.post('/create', (req, res) => {
  handle_Create(req, res);
});

app.get('/details', (req, res) => {
  handle_Details(res, req.query);
});

app.get('/edit', (req, res) => {
  handle_Edit(res, req.query);
});

app.post('/update', (req, res) => {
  handle_Update(req, res);
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




