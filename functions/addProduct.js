const { Client } = require('pg');

exports.handler = async function(event, context) {
  // --- CORS preflight ---
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST"
      },
      body: ""
    };
  }

  // --- CORS ---
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  let body;
  let contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';

  // --- Parse input ---
  try {
    if (contentType.includes('application/json')) {
      body = JSON.parse(event.body);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      body = parseURLEncoded(event.body);
    } else if (contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "multipart/form-data is not supported directly. Use application/json or form-urlencoded." })
      };
    } else {
      body = JSON.parse(event.body);
    }
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid request body." })
    };
  }

  // --- Validation ---
  const { title, description, price, category, subCategory, imageurl, password } = body;
  if (!title || !price || !category || !imageurl || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required fields." })
    };
  }
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== ADMIN_PASSWORD) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Unauthorized: Incorrect admin password" })
    };
  }

  // --- Database insert ---
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query(
      `INSERT INTO products (title, description, price, category, subCategory, imageurl)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [title, description, price, category, subCategory, imageurl]
    );
    await client.end();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Database error: " + err.message })
    };
  }
};

// Helper to parse x-www-form-urlencoded
function parseURLEncoded(body) {
  return body.split('&').reduce((acc, entry) => {
    const [k, v] = entry.split('=');
    acc[decodeURIComponent(k)] = decodeURIComponent(v || '');
    return acc;
  }, {});
}
