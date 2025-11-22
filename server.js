const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy: DiscordStrategy } = require('@oauth-everything/passport-discord');
const cookieSession = require('cookie-session');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'secret'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));
app.use(passport.initialize());
app.use(passport.session());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  username: String,
  globalName: String, // Note: Updated from deprecated 'discriminator' for modern Discord API
  avatar: String,
  accessToken: String,
  refreshToken: String
});

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  image: String
});

const purchaseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Purchase = mongoose.model('Purchase', purchaseSchema);

// Passport Setup
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ discordId: profile.id });
    if (user) {
      user.accessToken = accessToken;
      user.refreshToken = refreshToken;
      await user.save();
    } else {
      user = new User({
        discordId: profile.id,
        username: profile.username,
        globalName: profile.global_name, // Note: Using 'global_name' instead of deprecated 'discriminator'
        avatar: profile.avatar,
        accessToken,
        refreshToken
      });
      await user.save();
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// Routes

// Authentication Routes
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', passport.authenticate('discord', {
  failureRedirect: '/'
}), (req, res) => {
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

app.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

// Product Routes
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/products', async (req, res) => {
  // This is for admin to add products, but for simplicity, no auth check
  const product = new Product(req.body);
  try {
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/buy/:productId', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const purchase = new Purchase({
      user: req.user._id,
      product: product._id
    });
    await purchase.save();
    res.json({ message: 'Purchase successful', purchase });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Serve static files
app.use(express.static(__dirname));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
