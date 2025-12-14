// 引入依赖（适配lowdb v7+ 最新版本）
const express = require('express');
const cors = require('cors');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = 3000;

// 配置
app.use(cors()); // 允许跨域
app.use(express.json()); // 解析JSON请求体

// 初始化lowdb（适配v7+版本）
const adapter = new JSONFile('messages.json');
const defaultData = { messages: [] };
const db = new Low(adapter, defaultData);

// 提前读取数据库（首次运行自动创建messages.json）
async function initDB() {
  await db.read();
  // 确保数据结构存在
  if (!db.data.messages) {
    db.data.messages = [];
    await db.write();
  }
}
// 初始化数据库
initDB().then(() => {
  console.log('数据库初始化成功！');
}).catch(err => {
  console.error('数据库初始化失败：', err);
});

// 接口1：获取所有留言
app.get('/api/messages', async (req, res) => {
  try {
    await db.read();
    // 按创建时间倒序返回
    const messages = [...db.data.messages].sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 接口2：提交新留言
app.post('/api/messages', async (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) {
    return res.status(400).json({ success: false, message: '名字和内容不能为空' });
  }
  try {
    await db.read();
    const newMsg = {
      id: uuidv4(),
      name: name,
      content: content,
      createTime: new Date().toISOString()
    };
    // 添加新留言并保存
    db.data.messages.push(newMsg);
    await db.write();
    res.json({ success: true, data: newMsg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 接口3：撤回留言（验证名字）
app.delete('/api/messages/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: '请输入发布者名字' });
  }
  try {
    await db.read();
    // 查找留言
    const msgIndex = db.data.messages.findIndex(msg => msg.id === id);
    if (msgIndex === -1) {
      return res.status(404).json({ success: false, message: '留言不存在' });
    }
    // 验证名字
    if (db.data.messages[msgIndex].name !== name) {
      return res.status(403).json({ success: false, message: '无权限撤回此留言' });
    }
    // 删除留言
    db.data.messages.splice(msgIndex, 1);
    await db.write();
    res.json({ success: true, message: '留言已撤回' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 启动服务
app.listen(port, () => {
  console.log(`后端服务运行在 http://localhost:${port}`);
  console.log('数据库文件：messages.json（自动创建）');
});