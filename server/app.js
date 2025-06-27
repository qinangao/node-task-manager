import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient, ObjectId } from "mongodb";

//Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

//Set up EJS as the view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

//add middlewave
app.use(express.json());
app.use(express.static(path.join(__dirname, "static")));

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const dbName = "Nodetask";

let db;
let taskCollection;

//make sure the old and new task have the same id format for client
function transformTaskDocument(doc) {
  if (!doc) return null;
  const task = { ...doc }; ///create a copy of document

  task.id = doc._id.toString(); //Add id field(string) to match MongoDB's _id for client compatibility

  return task;
}

//Get all tasks
app.get("/api/tasks", async (req, res) => {
  try {
    const { complete } = req.query;
    let query = {};

    if (complete !== undefined) {
      const isCompleted = complete === "true";
      query = { complete: isCompleted };
    }
    const tasks = await taskCollection.find(query).toArray();

    const transformedTasks = tasks.map((task) => transformTaskDocument(task));

    res.json(transformedTasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//get single task
app.get("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = new ObjectId(id); //convert string ID to MongoDB ObjejctId

    const task = await taskCollection.findOne({ _id: objectId });

    if (!task) {
      return res.status(404).json({ error: `Task with ID ${id} not found` });
    }

    const transformedTask = transformTaskDocument(task);

    res.json(transformedTask);
  } catch (error) {
    res.status(500).json({ error: "Invalid ID format" });
  }
});

//Create task
app.post("/api/tasks", async (req, res) => {
  try {
    const { title, description, complete } = req.body;
    if (!title) {
      return res.status(404).json({ error: `Title is required` });
    }
    const task = {
      title,
      description: description || "",
      complete: complete || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await taskCollection.insertOne(task);
    const insertedTask = await taskCollection.findOne({
      _id: result.insertedId,
    });
    res.status(201).json(insertedTask);
  } catch (error) {
    return res.status(404).json({ error: `Task with ID ${id} not found` });
  }
});

//Update task
app.put("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, complete } = req.body;

    const objectId = new ObjectId(id);
    //update document with current timestamp
    const updateDoc = {
      $set: { title, description, complete, updatedAt: new Date() },
    };

    const result = await taskCollection.findOneAndUpdate(
      { _id: objectId },
      updateDoc,
      { returnDocument: "after" }
    );
    const updatedTask = result;
    if (!updatedTask) {
      return res.status(404).json({ error: `Task with ID ${id} not found` });
    }

    const transformedTask = transformTaskDocument(updatedTask);
    res.json(transformedTask);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

//Delete task
app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = new ObjectId(id);
    const result = await taskCollection.deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: `Task with ID ${id} not found` });
    }

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, "static", "index.html"));
});

//Connect MongoDB
async function startServer() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    console.log("Connected to MongoDB successfully");
    //Initialize database and collection
    db = client.db(dbName);
    taskCollection = db.collection("tasks");

    //Start the Express server
    app.listen(port, () => {
      console.log(`Server is listening on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to connect MongoDB:", error);
  }
}

//Handle application termination
process.on("SIGINT", async () => {
  await client.close();
  console.log("MongoDB connection closed due to app termination");
  process.exit(0);
});

//start server
startServer();
