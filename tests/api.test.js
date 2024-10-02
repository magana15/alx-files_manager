import { expect } from 'chai';
import request from 'chai-http';
import RedisClient from '../utils/redis'; // Adjust the import path as necessary
import dbClient from '../utils/db'; // Adjust the import path as necessary
import app from '../server'; // Assuming the Express app is exported from server.js

chai.use(request);

describe('combined Tests', () => {
  let redisClient;

  before(async () => {
    // Initialize Redis client
    redisClient = new RedisClient();
    await redisClient.connect();
    // Initialize Database client
    await dbClient.connect();
  });

  after(async () => {
    // Clean up
    await redisClient.disconnect();
    await dbClient.disconnect();
  });

  // Tests for Redis Client
  describe('redis Client', () => {
    it('should set and get a value', async () => {
      await redisClient.set('testKey', 'testValue');
      const value = await redisClient.get('testKey');
      expect(value).to.equal('testValue');
    });

    it('should delete a key and return null', async () => {
      await redisClient.set('deleteKey', 'deleteValue');
      await redisClient.delete('deleteKey');
      const value = await redisClient.get('deleteKey');
      expect(value).to.be.null; // Assuming `get` returns null for non-existent keys
    });

    it('should return null for non-existent keys', async () => {
      const value = await redisClient.get('nonExistentKey');
      expect(value).to.be.null;
    });

    it('should not throw error when trying to get non-existent key', async () => {
      const value = await redisClient.get('anotherNonExistentKey');
      expect(value).to.be.null;
    });
  });

  // Tests for Database Client
  describe('database Client', () => {
    it('should count users in the collection', async () => {
      const count = await dbClient.countDocuments('users'); // Assuming you have a method for counting
      expect(count).to.be.a('number');
    });

    it('should insert a user and then find it', async () => {
      const user = { email: 'insertTest@example.com', password: 'test123' };
      await dbClient.collection('users').insertOne(user); // Assuming this method exists
      const foundUser = await dbClient.collection('users').findOne({ email: user.email });
      expect(foundUser).to.not.be.null;
      expect(foundUser.email).to.equal(user.email);
    });

    it('should return the correct count of files in the collection', async () => {
      const count = await dbClient.countDocuments('files');
      expect(count).to.be.a('number');
    });

    it('should delete a user and return null', async () => {
      await dbClient.collection('users').deleteOne({ email: 'insertTest@example.com' });
      const foundUser = await dbClient.collection('users').findOne({ email: 'insertTest@example.com' });
      expect(foundUser).to.be.null;
    });
  });

  // Tests for API Endpoints
  describe('aPI Endpoints', () => {
    it('gET /status should return server status', async () => {
      const res = await request(app).get('/status');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'OK');
    });

    it('gET /stats should return statistics', async () => {
      const res = await request(app).get('/stats');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('usersCount');
      expect(res.body).to.have.property('filesCount');
    });

    it('pOST /users should create a new user', async () => {
      const res = await request(app)
        .post('/users')
        .send({ email: 'newUser@example.com', password: 'password123' });
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('message', 'User created');
    });

    it('gET /connect should establish a connection', async () => {
      const res = await request(app).get('/connect');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message', 'Connected');
    });

    it('gET /disconnect should disconnect', async () => {
      const res = await request(app).get('/disconnect');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message', 'Disconnected');
    });

    it('gET /users/me should return current user', async () => {
      const res = await request(app).get('/users/me');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('email'); // Assuming the user is authenticated
    });

    it('pOST /files should upload a file', async () => {
      const res = await request(app)
        .post('/files')
        .attach('file', 'path/to/test/file.jpg'); // Adjust file path
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('message', 'File uploaded');
    });

    it('gET /files/:id should return a specific file', async () => {
      const res = await request(app).get('/files/1'); // Rep with valid file ID
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('id', '1'); // Adjust according to response structure
    });

    it('gET /files should return paginated files', async () => {
      const res = await request(app).get('/files?page=1&limit=10');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('files').that.is.an('array');
      expect(res.body).to.have.property('totalPages').that.is.a('number');
    });

    it('pUT /files/:id/publish should publish a file', async () => {
      const res = await request(app).put('/files/1/publish'); // Rep with a valid file ID.
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message', 'File published');
    });

    it('pUT /files/:id/unpublish should unpublish a file', async () => {
      const res = await request(app).put('/files/1/unpublish'); // Replace with a valid file ID
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message', 'File unpublished');
    });

    it('gET /files/:id/data should return file data', async () => {
      const res = await request(app).get('/files/1/data'); // Replace with a valid file ID
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('data'); // Adjust according to response structure
    });
  });
});
