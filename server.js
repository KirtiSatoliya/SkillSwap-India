const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL || '*' })); // Update with frontend URL if needed
app.use(helmet()); // Adds security headers

// Rate limiter (for login)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    msg: 'Too many login attempts. Please try again after 15 minutes.'
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB
mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Auth Schema
const AuthUserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String
});
const AuthUser = mongoose.model('AuthUser', AuthUserSchema);

// 📝 Testimonial Schema
const testimonialSchema = new mongoose.Schema({
  name: String,
  message: String,
  date: { type: Date, default: Date.now }
});
const Testimonial = mongoose.model('Testimonial', testimonialSchema);

// Skill Profile Schema
const SkillUserSchema = new mongoose.Schema({
  name: String,
  city: String,
  teach: String,
  learn: String,
  mode: String,
  email: String,
  story: String
});
const SkillUser = mongoose.model('SkillUser', SkillUserSchema);

// Register
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await AuthUser.findOne({ email });
  if (existing) return res.status(400).json({ msg: 'Email already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new AuthUser({ name, email, password: hashedPassword });
  await user.save();

  res.json({ msg: 'User registered successfully' });
});

// Login
app.post('/api/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = await AuthUser.findOne({ email });

  if (!user) return res.status(400).json({ msg: 'User not found' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  res.json({ token, user: { name: user.name, email: user.email } });
});

// ➕ Add testimonial
app.post('/api/testimonials', async (req, res) => {
  const { name, message } = req.body;
  const newTestimonial = new Testimonial({ name, message });
  await newTestimonial.save();
  res.status(201).json({ msg: 'Thanks for your feedback!' });
});

// 📤 Get all testimonials
app.get('/api/testimonials', async (req, res) => {
  const all = await Testimonial.find({}).sort({ date: -1 });
  res.json(all);
});

// Create profile
app.post('/api/users', async (req, res) => {
  const user = new SkillUser(req.body);
  await user.save();
  res.status(201).json({ message: 'User saved successfully' });
});

// Update profile
app.put('/api/users/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const updatedData = req.body;

    const user = await SkillUser.findOneAndUpdate({ email }, updatedData, { new: true });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    res.json({ msg: 'Profile updated successfully', user });
  } catch (err) {
    res.status(500).json({ msg: 'Error updating profile', error: err.message });
  }
});

// Delete profile
app.delete('/api/users/:email', async (req, res) => {
  try {
    await SkillUser.deleteOne({ email: req.params.email });
    res.json({ msg: 'Profile deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Error deleting profile' });
  }
});

// Find matches
app.get('/api/users/match/:skill', async (req, res) => {
  const skill = req.params.skill.toLowerCase();
  const matches = await SkillUser.find({ teach: { $regex: skill, $options: 'i' } });
  res.json(matches);
});

// Get all users
app.get('/api/users/match/all', async (req, res) => {
  const all = await SkillUser.find({});
  res.json(all);
});

// ===================================
// 🔐 Password Reset Functionality
// ===================================

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS
  }
});

// Step 1: Request reset link
app.post('/api/reset-request', async (req, res) => {
  const { email } = req.body;
  const user = await AuthUser.findOne({ email });

  if (!user) return res.status(404).json({ msg: 'Email not registered' });

  const token = jwt.sign({ id: user._id }, process.env.RESET_SECRET, { expiresIn: '15m' });

  const resetLink = `${process.env.CLIENT_URL}/reset-password.html?token=${token}`;

  await transporter.sendMail({
    from: `SkillSwap India <${process.env.EMAIL}>`,
    to: email,
    subject: 'SkillSwap Password Reset',
    html: `<p>Click below to reset your password:</p><a href="${resetLink}">${resetLink}</a>`
  });

  res.json({ msg: 'Password reset link sent to your email.' });
});

// Step 2: Reset password with token
app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.RESET_SECRET);
    const hashed = await bcrypt.hash(password, 10);

    await AuthUser.findByIdAndUpdate(decoded.id, { password: hashed });

    res.json({ msg: 'Password updated successfully' });
  } catch (err) {
    res.status(400).json({ msg: 'Invalid or expired reset link' });
  }
});

// ==============================
// 🤝 Connect Request Functionality
// ==============================

// 1. Schema
const connectRequestSchema = new mongoose.Schema({
  from: String,  // sender email
  to: String,    // receiver email
  message: String,
  status: { type: String, default: 'pending' } // 'pending', 'accepted', 'rejected'
}, { timestamps: true });

const ConnectRequest = mongoose.model('ConnectRequest', connectRequestSchema);

// 2. Send Connect Request
app.post('/api/connect', async (req, res) => {
  const { from, to, message } = req.body;
  const request = new ConnectRequest({ from, to, message });
  await request.save();
  res.json({ msg: 'Connect request sent!' });
});

// 3. Get incoming requests for a user
app.get('/api/connect/received/:email', async (req, res) => {
  const requests = await ConnectRequest.find({ to: req.params.email });
  res.json(requests);
});

// 4. Accept/Reject request
app.put('/api/connect/respond/:id', async (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ msg: 'Invalid status' });
  }

  await ConnectRequest.findByIdAndUpdate(req.params.id, { status });
  res.json({ msg: `Request ${status}` });
});


// 404 Handler
app.use((req, res) => {
  res.status(404).json({ msg: 'API route not found' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
