const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone = null,
      store_name = null,
      business_type = "Grocery / Kirana",
      location = null,
      currency = "INR",
      language = "en",
      voice_language = "en",
      ai_preference = "Standard"
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const normalizedLang = normalizeLanguageCode(language);
    const normalizedVoiceLang = normalizeLanguageCode(voice_language || language);

    const result = await pool.query(
      `INSERT INTO users
       (name, email, password_hash, role, language, phone, store_name, business_type, location, currency, voice_language, ai_preference)
       VALUES ($1, $2, $3, 'OWNER', $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, email, role, language, phone, store_name, business_type, location, currency, voice_language, ai_preference`,
      [
        name,
        email,
        passwordHash,
        normalizedLang,
        phone,
        store_name,
        business_type,
        location,
        currency,
        normalizedVoiceLang,
        ai_preference
      ]
    );

    const user = result.rows[0];

    // Generate JWT token so new owner is immediately authenticated
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.status(201).json({
      message: "Store registered successfully",
      token,
      user,
    });
  } catch (error) {
    console.error("REGISTRATION ERROR:", error);

    res.status(500).json({
      message: "Registration failed",
      error: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        language: user.language,
        store_name: user.store_name,
        business_type: user.business_type,
        location: user.location,
        currency: user.currency,
        voice_language: user.voice_language,
        ai_preference: user.ai_preference,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Login failed",
    });
  }
};

const normalizeLanguageCode = (lang) => {
  if (!lang) return "en";
  const l = String(lang).toLowerCase().trim();
  if (l.startsWith("hi")) return "hi";
  if (l.startsWith("mr") || l.startsWith("mar")) return "mr";
  if (l.startsWith("gu")) return "gu";
  return "en";
};

const updateLanguage = async (req, res) => {
  try {
    const { language } = req.body;
    const normalized = normalizeLanguageCode(language);
    const userId = req.user.id;

    await pool.query(
      "UPDATE users SET language = $1 WHERE id = $2",
      [normalized, userId]
    );

    res.json({
      message: "Language updated successfully",
      language: normalized,
    });
  } catch (error) {
    console.error("UPDATE LANGUAGE ERROR:", error);
    res.status(500).json({
      message: "Failed to update language",
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  updateLanguage,
  normalizeLanguageCode,
};