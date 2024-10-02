import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import Queue from 'bull';
//this line
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing or invalid type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: parentId });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileDocument = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileDocument);
      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }
	  const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
   if (fileDocument.type === 'image') {
      await fileQueue.add({ userId: fileDocument.userId, fileId: fileDocument._id });
    }

    return res.status(201).json(fileDocument);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const fileName = uuidv4();
    const filePath = path.join(folderPath, fileName);

    const fileBuffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filePath, fileBuffer);

    fileDocument.localPath = filePath;
    const result = await dbClient.db.collection('files').insertOne(fileDocument);

    return res.status(201).json({
      id: result.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
      localPath: filePath,
    });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: fileId, userId });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = 0, page = 0 } = req.query;
    const files = await dbClient.db.collection('files').aggregate([
      { $match: { parentId, userId } },
      { $skip: page * 20 },
      { $limit: 20 },
    ]).toArray();

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: fileId, userId });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne(
      { _id: fileId, userId },
      { $set: { isPublic: true } },
    );

    const updatedFile = await dbClient.db.collection('files').findOne({ _id: fileId, userId });
    return res.status(200).json(updatedFile);
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: fileId, userId });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne(
      { _id: fileId, userId },
      { $set: { isPublic: false } },
    );

    const updatedFile = await dbClient.db.collection('files').findOne({ _id: fileId, userId });
    return res.status(200).json(updatedFile);
  }

  static async getFile(req, res) {
    const fileId = req.params.id;
    const size = req.query.size || null;
    const token = req.headers['x-token'] || null;

    const file = await dbClient.db.collection('files').findOne({ _id: fileId });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    const userId = token ? await redisClient.get(`auth_${token}`) : null;
    if (!file.isPublic && (!userId || userId !== file.userId)) {
      return res.status(404).json({ error: 'Not found' });
    }
    // check here
    let { localPath } = file;
    if (size && [100, 250, 500].includes(parseInt(size, 10))) {
      localPath = `${file.localPath}_${size}`;
    }

    const mimeType = mime.lookup(file.name) || 'application/octet-stream';

    fs.readFile(localPath, (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Error reading file' });
      }

      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(data);
    });
  }
}

export default FilesController;
