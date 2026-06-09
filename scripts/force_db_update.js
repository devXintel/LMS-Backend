const { Client } = require('pg');
const dns = require('dns');

// Force DNS resolution for Neon host
const NEON_HOST = 'ep-dark-meadow-ahx9aeqj-pooler.c-3.us-east-1.aws.neon.tech';
const NEON_IP = '98.89.62.209'; // Resolved earlier via 8.8.8.8

const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    if (hostname === NEON_HOST) {
        console.log(`[DNS] Forcing resolution: ${hostname} -> ${NEON_IP}`);
        return callback(null, [{ address: NEON_IP, family: 4 }], 4); // Handle callback(null, [{address, family}]) or callback(null, address, family)
    }
    return originalLookup(hostname, options, callback);
};

// Also override lookup for non-callback version or if options is object
const dnsPromise = require('dns').promises;
const originalLookupPromise = dnsPromise.lookup;
dnsPromise.lookup = async (hostname, options) => {
    if (hostname === NEON_HOST) {
        return { address: NEON_IP, family: 4 };
    }
    return originalLookupPromise(hostname, options);
};

const CONNECTION_STRING = "postgresql://neondb_owner:npg_pq7frsvDU9ja@ep-dark-meadow-ahx9aeqj-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function run() {
    const client = new Client({
        connectionString: CONNECTION_STRING,
    });

    try {
        console.log("Connecting to database...");
        await client.connect();
        console.log("Connected successfully!");

        // 1. Create Table
        console.log("Creating 'voice_samples' table if not exists...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS "voice_samples" (
                "id" SERIAL NOT NULL,
                "voice_name" TEXT NOT NULL,
                "gender" TEXT NOT NULL,
                "s3_path" TEXT NOT NULL,
                "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT "voice_samples_pkey" PRIMARY KEY ("id")
            );
        `);
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "voice_samples_voice_name_key" ON "voice_samples"("voice_name");
        `);
        console.log("Table created/verified.");

        // 2. Insert Data
        const voiceName = "Female Voice Sample";
        const gender = "female";
        const s3Path = "female_voice/Audio.wav.ogg";

        console.log(`Inserting/Updating voice sample: ${voiceName}...`);
        await client.query(`
            INSERT INTO "voice_samples" ("voice_name", "gender", "s3_path", "updated_at")
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT ("voice_name") 
            DO UPDATE SET "s3_path" = $3, "updated_at" = NOW();
        `, [voiceName, gender, s3Path]);

        console.log("Success! Female voice sample path stored.");

        // Verify
        const res = await client.query('SELECT * FROM "voice_samples"');
        console.log("Current rows in 'voice_samples':", res.rows);

    } catch (err) {
        console.error("Error during database operation:", err);
    } finally {
        await client.end();
    }
}

run();
