import { ObjectId } from 'mongodb'; // Import ObjectId for MongoDB operations
import sha1 from 'sha1'; // Import SHA1 for password hashing
import dbClient from '../utils/db'; // Import the database client
import redisClient from '../utils/redis'; // Import the Redis client

class UsersController {
  // Method to create a new user
  static async postNew(req, res) {
    try {
      const { email, password } = req.body; // Destructure email and password from request body

      // Check for missing email
      if (!email) {
        return res.status(400).json({ error: 'Missing email' });
      }

      // Check for missing password
      if (!password) {
        return res.status(400).json({ error: 'Missing password' });
      }

      // Check if user already exists
      const existingUser = await dbClient.db.collection('users').findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Already exist' });
      }

      // Hash the password for storage
      const hashedPassword = sha1(password);

      // Insert the new user into the database
      const result = await dbClient.db.collection('users').insertOne({
        email,
        password: hashedPassword,
      });

      // Return the created user information
      return res.status(201).json({
        id: result.insertedId,
        email,
      });
    } catch (error) {
      // Catch any unexpected errors
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Method to get the current user information
  static async getMe(req, res) {
    const token = req.headers['x-token']; // Get the token from request headers
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' }); // Return unauthorized if token is missing
    }

    // Retrieve user ID associated with the token from Redis
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' }); // Return unauthorized if user ID not found
    }

    // Find the user in the database
    const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' }); // Return unauthorized if user not found
    }

    // Return the user information
    return res.status(200).json({ id: user._id, email: user.email });
  }
}

export default UsersController; // Export the UsersController class
