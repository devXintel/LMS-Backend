const { Client } = require('pg');

const url = "postgresql://neondb_owner:npg_pq7frsvDU9ja@ep-dark-meadow-ahx9aeqj.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function test() {
    const client = new Client({
        connectionString: url,
    });
    try {
        await client.connect();
        console.log("Connected successfully!");
        const res = await client.query('SELECT NOW()');
        console.log(res.rows[0]);
    } catch (err) {
        console.error("Connection error:", err.message);
    } finally {
        await client.end();
    }
}

test();
