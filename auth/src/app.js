const express = require("express");
const mongoose = require("mongoose");
const config = require("./config");
const authMiddleware = require("./middlewares/authMiddleware");
const AuthController = require("./controllers/authController");
const MessageBroker = require('./helpers/messageBroker');
const User = require('./models/user')

class App {
  constructor() {
    this.app = express();
    this.authController = new AuthController();
    this.connectDB();
    this.setMiddlewares();
    this.setRoutes();
    this.setUpMessageQueue()
  }

  async connectDB() {
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log("MongoDB connected");
  }

  async disconnectDB() {
    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  }

  async setUpMessageQueue() {
    await MessageBroker.setUpConnection()
  }

  setMiddlewares() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
  }

  setRoutes() {
    this.app.post("/auth/api/v1/login", (req, res) => this.authController.login(req, res));
    this.app.post("/auth/api/v1/register", (req, res) => this.authController.register(req, res));
    this.app.get("/auth/api/v1/dashboard", authMiddleware, this.authController.getProfile);
  }

  start() {
    this.server = this.app.listen(3000, () => console.log("Server started on port 3000"));
  }

  async stop() {
    await mongoose.disconnect();
    this.server.close();
    console.log("Server stopped");
    
    
  }
}

module.exports = App;
